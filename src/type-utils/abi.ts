import "../lib/String";
import { Factory } from "../ast-rewriter/Factory";
import { FileContext } from "../code-gen/context";
// import { getMaxUintForField } from "../code-gen/fields";
import { getMaxUintForField } from "../code-gen/stack-packer/fields";
import { NodeQ } from "../ast-rewriter/NodeQ";
import { parseCode } from "../parser";
import { toHex } from "../lib/bytes";
import {
  AbiArray,
  AbiElementaryType,
  AbiFunction,
  AbiStruct,
  AbiStructField,
  AbiType,
} from "../types";
import {
  getAssemblyRoundUpAndAddExpression,
  getAssemblyRoundUpExpression,
  PointerRoundUp32Mask,
} from "../code-gen/offsets";
import {
  canBeSequentiallyCopied,
  DynamicBytes,
  extractTypes,
  isReferenceType,
  isSequentiallyCopyableDynamic,
  isStatic,
  isValueType,
  setActualSizes,
} from "./type-check";
import _, {
  countBy,
  find,
  findIndex,
  findLastIndex,
  range,
  sumBy,
  takeWhile,
  without,
} from "lodash";
import {
  CastableToIdentifierOrLiteral,
  CastableToYulExpression,
  YulAssignment,
  YulBlock,
  YulExpression,
  YulForLoop,
  YulFunctionDefinition,
  YulIdentifier,
  YulLiteral,
  YulNode,
  YulNodeFactory,
} from "../ast-rewriter/yul";
import {
  ASTWriter,
  DefaultASTWriterMapping,
  LatestCompilerVersion,
  PrettyFormatter,
  SourceUnit,
  VariableDeclaration,
} from "solc-typed-ast";
import { findFirstAndLastIndex } from "../lib/array";
import { getHighLevelTypeString } from "../tables/function-io";

export type AbiPositionData = {
  headOffset: number;
  baseTailOffset?: number;
  hasDynamicLength?: boolean;
  dynamicDepth?: number;
};

export type AbiTypeWithPosition = AbiType & AbiPositionData;

const Loaders = {
  memory: (ref: string) => `mload(ref)`,
  calldata: (ref: string) => `calldataload(ref)`,
};

const load = (ref: string, location: keyof typeof Loaders) =>
  Loaders[location](ref);

const getLoadParameter = (context: FileContext, node: AbiElementaryType) => {
  // const isInvalid;
  // `calldatacopy(${})`
  if (!node.dynamic) {
    return {
      getInvalidExpression: (ref: string) =>
        `gt(${ref}, ${getMaxUintForField(node)})`,
    };
  }

  return {
    getLength: (ref: string, loc: "memory" | "calldata") => load(ref, loc),
    // Length rounded up to nearest word, used for calculating offsets
    // and allocating memory
    getBytesUsed: (ref: string, loc: "memory" | "calldata") =>
      getAssemblyRoundUpExpression(context, load(ref, loc)),
    // Length rounded up to second next word, used to skip adding 32 to length
    // when checking next offset
    getTotalBytesUsed: (ref: string, loc: "memory" | "calldata") =>
      getAssemblyRoundUpAndAddExpression(context, load(ref, loc)),
  };
};

type Sizes = {
  minimumSize: number;
  size?: number;
};

// push ptr, push cdptr, push length, calldatacopy
const getCopyCost = (numFields: number) => 12 + 3 * numFields;

const getWriteHeadCost = (types: AbiType[], constantCdPtr?: boolean) => {
  const cdOffsetCost = constantCdPtr ? 0 : 6;
  return types.reduce((cost, type) => {
    if (type.dynamic) return cost;
    let words = type.size / 32;
    if (type.headOffset === 0) {
      // push cdptr, calldataload, push ptr, mstore
      cost += 12;
      words--;
    }
    // push cdptr, (push offset, add)?, calldataload, push ptr, push offset, add, mstore
    return cost + (18 + cdOffsetCost) * words;
  }, 0);
};
//  {
// push ptr, push cdptr, push length, calldatacopy
// return 12 + 3 * numFields;
// push cdptr, calldataload, push ptr, mstore
// push cdptr, push offset, add, calldataload, push ptr, push offset, add, mstore
// }

const toScopedName = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join("_");

class CalldataCopier {
  constants: YulIdentifier[] = [];
  ptr: CastableToYulExpression;
  cdPtr: CastableToYulExpression;

  asmBlock: YulBlock;
  factory: Factory = new Factory();
  writer: ASTWriter = new ASTWriter(
    DefaultASTWriterMapping,
    new PrettyFormatter(4, 0),
    LatestCompilerVersion
  );

  yul = this.factory.yul;
  ["$"] = this.factory;

  constructor(
    public fn: AbiFunction,
    public sourceUnit?: SourceUnit,
    public useNamedConstants?: boolean,
    public strict?: boolean,
    constantMemPtr?: number
  ) {
    setActualSizes(fn);
    if (!sourceUnit) {
      this.sourceUnit = this.factory.makeSourceUnit("", 0, "", new Map());
    }
    this.ptr = constantMemPtr ?? "mPtr";
    this.cdPtr = /* this.input.dynamic ? "cdPtr" : */ 4;
    this.asmBlock = this.factory.makeYulBlock([]);
    this.ptr = constantMemPtr || this.dup(this.yul.mload(64), "mPtr");
  }

  get input() {
    return this.fn.input;
  }

  printCode() {
    const fn = this.factory.defineFunction(
      this.sourceUnit.id,
      `copy${this.fn.name}Data`
    );
    fn.vBody = this.factory.makeBlock([
      this.factory.makeInlineAssembly([], undefined, this.asmBlock as any),
    ]);
    this.sourceUnit.appendChild(fn);
    console.log(this.writer.write(this.sourceUnit));
  }

  findConstant(name: string): VariableDeclaration | undefined {
    return NodeQ.from(this.sourceUnit).find("VariableDeclaration", { name })[0];
  }

  getConstant(value: string | number, name: string) {
    if (this.useNamedConstants) {
      let existingConstant = this.findConstant(name);
      if (!existingConstant) {
        existingConstant = this.factory.makeConstantUint256(
          name,
          value,
          this.sourceUnit.id
        );
        this.sourceUnit.appendChild(existingConstant);
      }
      return this.yul.identifierFor(existingConstant);
    }
    return this.yul.literal(value);
  }

  get roundUpMask() {
    return this.getConstant(PointerRoundUp32Mask, "OnlyFullWordMask");
  }

  roundUp32(node: YulNode) {
    return this.yul.and(this.yul.add(node, 31), this.roundUpMask);
  }

  roundUpAndAdd32(node: YulNode) {
    return this.yul.and(this.yul.add(node, 63), this.roundUpMask);
  }

  dup(node: CastableToIdentifierOrLiteral, name: string) {
    if (this.yul.isConstant(node) || typeof node !== "object") {
      return this.getConstant(this.yul.resolveConstantValue(node), name);
    }
    if (node.nodeType === "YulIdentifier") {
      return node;
    }
    this.asmBlock.statements.push(this.yul.let(name, node));
    return this.yul.identifier(name);
  }

  let(node: CastableToIdentifierOrLiteral, name: string) {
    if (this.yul.isConstant(node)) {
      if (typeof node !== "object") node = this.yul.literal(node);
    }
    this.asmBlock.statements.push(this.yul.let(name, node as YulNode));
    return this.yul.identifier(name);
  }

  getConstantIfPossible(
    node: CastableToIdentifierOrLiteral,
    name: string
  ): YulNode {
    const value = this.yul.resolveConstantValue(node);
    return value !== undefined
      ? this.getConstant(value, name)
      : (node as YulNode);
  }

  getOffsetExpression(
    ptr: CastableToIdentifierOrLiteral,
    offset: CastableToIdentifierOrLiteral,
    fieldName?: string,
    ptrSuffix?: string
  ) {
    const ptrAsConst = this.yul.resolveConstantValue(ptr, true);
    const offsetAsConst = this.yul.resolveConstantValue(offset, true);
    // if (isZero(ptrAsConst)) {}
    if (ptrAsConst !== undefined && offsetAsConst !== undefined) {
      return this.getConstant(
        toHex(ptrAsConst + offsetAsConst),
        toScopedName(fieldName, ptrSuffix, "ptr")
      );
    }
    if (offsetAsConst && !(offset instanceof YulIdentifier)) {
      const offsetNode = this.getConstant(
        toHex(offsetAsConst),
        toScopedName(fieldName, "offset")
      );
      return this.yul.add(ptr, offsetNode);
    }

    return this.yul.add(ptr, offset);

    // const constantPointer = this.yul.isConstant(ptr);
    // const value = constantPointer ? this.yul.addConstants(ptr, offset) : offset;
    // const name = toScopedName(
    //   fieldName,
    //   constantPointer && ptrSuffix,
    //   constantPointer ? "ptr" : "offset"
    // );
    // const offsetNode = this.getConstant(value, name);
    // return constantPointer ? offsetNode : this.yul.add(ptr, offsetNode);
  }

  // for bytes:
  // given head ptr in cd, head ptr in memory and expected offset
  // if strict:
  // return or(currentValidityCheck, isStrictlyEncoded)
  // return reference to length
  buildCopyArrayFixedBaseTypeStrict(
    type: AbiArray | AbiElementaryType,
    fieldName: string,
    mPtrParent: CastableToYulExpression,
    cdPtrParent: CastableToYulExpression,
    offsetHead: CastableToYulExpression,
    mOffsetLength: CastableToYulExpression,
    addWord?: boolean,
    strict?: boolean
  ): {
    // headPtr: YulNode;
    mPtrHead: YulExpression;
    cdPtrHead: YulExpression;
    mPtrLength: YulExpression;
    cdPtrLength: YulExpression;

    isInvalid: YulExpression;
    repairPointer: YulExpression;
    // Rounded length for bytes, otherwise bytes length
    tailBytes: YulExpression;

    // roundedLength: YulNode;
  } {
    // bytes is ptr in memory:
    // mstore(headPtr, add(headPtr, lengthOffset))
    const mPtrHead = this.dup(
      this.yul.smartAdd(mPtrParent, offsetHead),
      toScopedName(fieldName, "head_offset")
    );
    // Verify head is where it should be
    const cdPtrHead = this.dup(
      this.yul.smartAdd(cdPtrParent, offsetHead),
      toScopedName(fieldName, "cd_head_offset")
    );

    // If strict, length offset for memory and calldata are the same
    // and identifier exists. If not, load it from calldata and cache
    // on the stack.
    const cdOffsetLength = (
      strict ? this.dup : this.getConstantIfPossible
    ).bind(this)(
      strict ? mOffsetLength : this.yul.calldataload(cdPtrHead),
      toScopedName(fieldName, "length_cd_offset")
    );

    const cdPtrLength = (strict ? this.getConstantIfPossible : this.dup).call(
      this,
      this.yul.smartAdd(cdPtrParent, cdOffsetLength),
      toScopedName(fieldName, "length_cd_ptr")
    );
    const repairPointer = this.yul.mstore(
      mPtrHead,
      this.yul.smartAdd(mPtrHead, mOffsetLength)
    );
    const isInvalid = this.yul.xor(cdOffsetLength, mOffsetLength);
    const readLength = this.yul.calldataload(cdPtrLength);

    // let offset := add(calldataload(cdPtr + 60), cdPtr)
    // valid :=
    let tailBytes: YulExpression;
    if (type.meta === "array") {
      const length = addWord ? this.yul.smartAdd(readLength, 1) : readLength;
      tailBytes = this.yul.mul(length, 32);
    } else {
      tailBytes = (addWord ? this.roundUpAndAdd32 : this.roundUp32).call(
        this,
        readLength
      );
    }

    // const mPtrLength = this.yul.add(mPtrParent, mOffsetLength);
    const _this = this;
    return {
      mPtrHead,
      cdPtrHead,
      repairPointer,
      isInvalid,
      tailBytes,
      cdPtrLength,
      get mPtrLength() {
        return _this.yul.add(mPtrParent, mOffsetLength);
      },
    };
  }

  getSequential(fields: AbiStructField[]) {
    // const firstStaticIndex = findIndex(types, isStatic);
    // const lastStaticIndex = findLastIndex(types, isStatic);
    // const staticMembers = types.slice(firstStaticIndex, lastStaticIndex);
    // const first = findIndex(types, canBeSequentiallyCopied);
    const sequentialMembers = takeWhile(fields, (field) =>
      canBeSequentiallyCopied(field.type)
    );
    // const indices = range(first, first + sequentialMembers.length);
    const startOffset = sequentialMembers[0]?.headOffset;
    const minimumBytes = sumBy(sequentialMembers, "minimumBytes");

    return {
      sequentialMembers,
      // includedIndices: indices,
      // excludedIndices: without(range(0, types.length), ...indices),
      startOffset,
      minimumBytes,
      numDynamic: _.filter(sequentialMembers, "dynamic").length,
    };
    // const firstSequentialDynamicIndex = findIndex(types, isSequentiallyCopyableDynamic);
    // const sequentialDynamic = takeWhile(
    //   types.slice(Math.max(firstSequentialDynamicIndex, 0)),
    //   isSequentiallyCopyableDynamic
    // );
    // if (firstStaticIndex < 0 && sequentialDynamic.length > 1) {
    //   return {
    //     members: sequentialDynamic,
    //   }
    // }
    // const staticCost = getCopyCost(sumBy(staticMembers, "minimumBytes"));
    // const sequentialCost = getCopyCost(sumBy(sequentialMembers, "minimumBytes"));
    // const sequentialDynamicCost = getCopyCost(sumBy(sequentialDynamic, "minimumBytes"));
    // if (sequentialCost < staticCost + sequentialDynamicCost) {
    //   return {
    //     start: types.indexOf()
    //   }
    // }
  }

  getSequentialCopyKind(fields: AbiStructField[]) {
    // const copies: { beginDynamic; members: AbiType[]; }[] = [];
    const types = extractTypes(fields);
    const [firstStaticIndex, lastStaticIndex] = findFirstAndLastIndex(
      types,
      isStatic
    );
    if (firstStaticIndex < 0) return undefined;
    const staticMembers = types.slice(firstStaticIndex, lastStaticIndex + 1);
    const sequential = takeWhile(
      types.slice(firstStaticIndex),
      canBeSequentiallyCopied
    );
    if (sequential.length === staticMembers.length) {
      /*  return {
        from: 
      }; */
    }
    const sequentialDynamic = takeWhile(
      types.slice(lastStaticIndex + 1),
      isSequentiallyCopyableDynamic
    );

    // const firstSequentialDynamicIndex = findIndex(
    // types,
    // isSequentiallyCopyableDynamic
    // );

    const staticBytes = sumBy(staticMembers, "minimumBytes");
    const sequentialBytes = sumBy(sequential, "minimumBytes");
    const sequentialDynamicBytes = sumBy(sequentialDynamic, "minimumBytes");

    // const sequentialDynamicFields = types.slice
  }

  getCopyStaticHeadMembers(
    name: string,
    fields: AbiStructField[],
    mPtr: CastableToIdentifierOrLiteral,
    cdPtr: CastableToIdentifierOrLiteral
  ) {
    const types = fields.map((field) => field.type);

    const constantCdPtr = this.yul.isConstant(cdPtr);
    console.log(types);
    const firstStaticIndex = findIndex(types, isStatic);
    const lastStaticIndex = findLastIndex(types, isStatic);
    if (lastStaticIndex === -1) {
      return;
    }

    /*
    If head has some dynamic members,
    compare cost of 2 copies to cost
    */
    const staticHeadTypes = types.slice(firstStaticIndex, lastStaticIndex + 1);
    const headCopyBytes = sumBy(staticHeadTypes, "bytes");
    const headCopyCost = getCopyCost(headCopyBytes / 32);
    const writeCost = getWriteHeadCost(staticHeadTypes, constantCdPtr);
    console.log({ headCopyCost, writeCost });
    const headCopyType = headCopyCost < writeCost ? "copy" : "write";

    if (headCopyType === "copy") {
      const suffix = firstStaticIndex > 0 && fields[firstStaticIndex].name;

      const length = this.getConstant(
        headCopyBytes,
        toScopedName(name, "static_head_size")
      );
      const { headOffset } = types[firstStaticIndex];
      const offsetName = toScopedName(name, suffix);
      const dst = this.getOffsetExpression(mPtr, headOffset, offsetName);
      const src = this.getOffsetExpression(cdPtr, headOffset, offsetName, "cd");
      this.asmBlock.statements.push(this.yul.calldatacopy(dst, src, length));
    } else {
      for (const type of staticHeadTypes) {
        const field = fields.find((field) => field.type === type);
        const fieldName = toScopedName(name, field.name);
        const dst = this.getOffsetExpression(mPtr, type.headOffset, fieldName);
        const src = this.yul.calldataload(
          this.getOffsetExpression(cdPtr, type.headOffset, fieldName, "cd")
        );
        this.asmBlock.statements.push(this.yul.mstore(dst, src));
      }
    }
  }

  buildRevertCheck(condition: CastableToYulExpression) {
    return this.yul.if(condition, this.yul.revert(0, 0));
  }

  buildCopyDynamicMembers(scopeName: string, strict?: boolean) {
    // console.log(strict);
    const numDynamic = this.fn.input.fields.filter(
      (f) => f.type.dynamic
    ).length;
    const {
      input: { fields, memberHeadBytes },
    } = this.fn;
    const nextTailOffset =
      numDynamic > 1
        ? this.let(memberHeadBytes, "nextTailOffset")
        : this.getConstant(
            memberHeadBytes,
            toScopedName(scopeName, "tail_offset")
          );

    const lastDynamic = findLastIndex(fields, (f) => f.type.dynamic);
    let isInvalidNode: CastableToYulExpression;
    fields.forEach((field, i) => {
      if (isSequentiallyCopyableDynamic(field.type)) {
        const { isInvalid, repairPointer, tailBytes, mPtrLength, cdPtrLength } =
          this.buildCopyArrayFixedBaseTypeStrict(
            field.type,
            field.name,
            this.ptr,
            this.cdPtr,
            field.type.headOffset,
            nextTailOffset,
            strict
          );
        this.asmBlock.statements.push(repairPointer);
        const lengthRef = strict ? tailBytes : this.dup(tailBytes, "tailSize");
        console.log(lengthRef);
        if (numDynamic > 1) {
          this.asmBlock.statements.push(
            this.yul.assignment(
              nextTailOffset as YulIdentifier,
              this.yul.add(nextTailOffset, lengthRef)
            )
          );
        }
        if (strict) {
          if (numDynamic > 1) {
            if (field.type.isFirstDynamicType) {
              isInvalidNode = this.dup(isInvalid, "isInvalid");
            } else {
              this.asmBlock.statements.push(
                this.yul.assignment(
                  isInvalidNode as YulIdentifier,
                  this.yul.or(isInvalidNode, isInvalid)
                )
              );
            }
          }
          if (i === lastDynamic) {
            this.asmBlock.statements.push(this.buildRevertCheck(isInvalid));
          }
        } else {
          this.asmBlock.statements.push(
            this.yul.calldatacopy(mPtrLength, cdPtrLength, lengthRef)
          );
        }
      }
    });
  }

  builyCopySequential(scopeName: string) {
    const {
      sequentialMembers: fields,
      numDynamic,
      // startOffset,
      // minimumBytes,
    } = this.getSequential(this.fn.input.fields);

    const {
      input: { memberHeadBytes },
    } = this.fn;
    const nextTailOffset =
      numDynamic > 1
        ? this.let(memberHeadBytes, "nextTailOffset")
        : this.getConstant(
            memberHeadBytes,
            toScopedName(scopeName, "tail_offset")
          );

    const [firstDynamic, lastDynamic] = findFirstAndLastIndex(
      fields,
      (f) => f.type.dynamic
    );
    let isInvalidNode: YulNode;
    // @todo
    fields.slice(firstDynamic).forEach((field, i) => {
      if (isSequentiallyCopyableDynamic(field.type)) {
        const { isInvalid, repairPointer, tailBytes, mPtrLength, cdPtrLength } =
          this.buildCopyArrayFixedBaseTypeStrict(
            field.type,
            field.name,
            this.ptr,
            this.cdPtr,
            field.type.headOffset,
            nextTailOffset,
            true
          );
        this.asmBlock.statements.push(repairPointer);
        const lengthRef = tailBytes;
        console.log(lengthRef);
        if (numDynamic > 1) {
          this.asmBlock.statements.push(
            this.yul.assignment(
              nextTailOffset as YulIdentifier,
              this.yul.add(nextTailOffset, lengthRef)
            )
          );
        }
        if (numDynamic > 1) {
          if (field.type.isFirstDynamicType) {
            isInvalidNode = this.dup(isInvalid, "isInvalid");
          } else {
            this.asmBlock.statements.push(
              this.yul.assignment(
                isInvalidNode as YulIdentifier,
                this.yul.or(isInvalidNode, isInvalid)
              )
            );
          }
        }
        if (i === lastDynamic) {
          this.asmBlock.statements.push(this.buildRevertCheck(isInvalid));
        }
      }
    });
  }

  getCopyCode(strict?: boolean) {
    this.getCopyStaticHeadMembers(
      this.fn.name,
      this.fn.input.fields,
      this.ptr,
      this.cdPtr
    );
    this.buildCopyDynamicMembers(this.fn.name, strict);
  }
}

// function getCopyStaticHeadMembers(
//   param: AbiStruct,
//   ptrReference: string,
//   cdPtrReference: string | number
// ) {
//   const constantCdPtr = typeof cdPtrReference === "number";
//   let headCopyType: "copy" | "write" = "copy";
//   const lastStaticIndex = findLastIndex(
//     param.fields,
//     (field) => !field.type.dynamic
//   );
//   if (lastStaticIndex === -1) {
//     return;
//   }
//   if (param.dynamic) {
//     const copyCost = getCopyCost(lastStaticIndex + 1);
//     const writeCost = getWriteHeadCost(param, constantCdPtr);
//     headCopyType = copyCost < writeCost ? "copy" : "write";
//   }
//   if (headCopyType === "copy") {
//   }
// }

const {
  structs: [myStruct],
  functions: [myFunction],
} = parseCode(`
struct MyData {
  // uint64[2] arr;
  bytes arr;
  uint256 b;
  uint64[3] c;
}

function myFunction(
  bytes calldata arr,
  uint256 b,
  uint256 c
) pure {}
`);

const copier = new CalldataCopier(myFunction, undefined, true);
// copier.getCopyStaticHeadMembers("", myStruct as AbiStruct, 0, 4);
copier.getCopyCode();
copier.printCode();
// getCopyCode(myStruct as AbiStruct, "0x04");
