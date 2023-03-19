import "../../lib/String";

import { AbiArray, AbiStruct, AbiStructField, AbiType } from "../../types";
import {
  CastableToIdentifierOrLiteral,
  CastableToYulExpression,
  definitelyExpression,
  isConstant,
  makeYulIdentifier,
  makeYulLiteral,
  smartAdd,
  YulBlock,
  YulExpression,
  YulFunctionDefinition,
  YulIdentifier,
  YulNode,
  YulSwitch,
  YulVariableDeclaration,
} from "../../ast-rewriter/yul";
import {
  InlineAssembly,
  replaceNode,
  SourceUnit,
  VariableDeclaration,
} from "solc-typed-ast";

import {
  AbiReferenceType,
  extractTypes,
  getHighLevelTypeString,
  isArray,
  isReferenceType,
  isValueType,
  maxReferenceTypeDepth,
  toTypeName,
} from "../../type-utils";
import { Factory } from "../../ast-rewriter/Factory";
import { FixedReferenceTypeProcessor } from "../abi-decode/fixed-ref";
import { NodeQ } from "../../ast-rewriter/NodeQ";
import { PendingDynamicCopy, PendingDynamicPointer } from "./utils";
import { PointerRoundUp32Mask } from "../../code-gen/offsets";
import { toHex } from "../../lib/bytes";
import { TypeCheck } from "../../ast-rewriter/types";

const toScopedName = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join("_");

/*
x
    const isInvalid = this.$.xor(
      this.$.calldataload(cdPtrHead),
      nextCalldataTailOffset
    );
    const tailSize = this.roundUpAndAdd32(
      this.cdLoadOffset(cdPtrParent, nextCalldataTailOffset)
    );
    return {
      isInvalid,
      tailSize,
    };
handleDynamicTypeInternal(
  name: string,
  tailPointerMemory: YulExpression,
  tailPointerCalldata: YulExpression,
) {
  if (bytes) {
    const length = this.let(`${name}_len`, this.roundUpAndAdd32(this.calldataload(tailPointerCalldata)))
    this.copy(tailPointerMemory, tailPointerCalldata, length);
    this.set(this.nextTailOffset, this.nextTailOffset.add(length))
  }
}

*/

type NamedAbiType<T extends AbiType = AbiType> = { type: T; name: string };

const expr = definitelyExpression;
type Expressiony = CastableToYulExpression;

type CopierCtx = {
  mPtrParent: YulExpression;
  cdPtrParent: YulExpression;
  block: YulBlock;
  strict: boolean;
  tailOffsetCalldata: YulExpression;
  tailOffsetMemory: YulExpression;
  isInvalid?: YulIdentifier;
};

function getTypeDataPtrs(ctx: CopierCtx, { type, name }: NamedAbiType) {
  const mPtrHead = ctx.mPtrParent.smartAdd(type.memoryHeadOffset);
  const cdPtrHead = ctx.cdPtrParent.smartAdd(type.calldataHeadOffset);
  if (!isReferenceType(type)) {
    return { mPtrHead, cdPtrHead };
  }

  const setIsInvalid = (expr: YulExpression) => {
    if (!ctx.isInvalid) {
      ctx.isInvalid = ctx.block.let(`is_invalid`, expr);
      return;
    }
    ctx.block.set(ctx.isInvalid, ctx.isInvalid.or(expr));
  };

  const mPtrTail = ctx.block.let(
    `${name}_ptr`,
    ctx.mPtrParent.smartAdd(ctx.tailOffsetMemory)
  );
  ctx.block.appendChild(mPtrHead.mstore(mPtrTail));
  let cdPtrTail: YulExpression;
  if (type.dynamic) {
    const offset = cdPtrHead.calldataload();
    if (ctx.strict) {
      const offsetId = ctx.block.let(`${name}_cd_offset`, offset);
      setIsInvalid(offsetId.eq(ctx.tailOffsetCalldata));
      cdPtrTail = ctx.cdPtrParent.smartAdd(ctx.tailOffsetCalldata);
    } else {
      cdPtrTail = ctx.cdPtrParent.smartAdd(offset);
    }
  }
  return { mPtrHead, cdPtrHead, mPtrTail, cdPtrTail };
}

export abstract class Copier {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    public factory: Factory,
    public sourceUnit: SourceUnit,
    public block: YulBlock,
    public type: AbiStruct | AbiArray,
    cdPtrParent: YulExpression = makeYulLiteral(0),
    mPtrParent: YulExpression = makeYulLiteral(0),
    public useNamedConstants?: boolean,
    public strict?: boolean
  ) {
    this.cdPtrParent = cdPtrParent;
    this.mPtrParent = mPtrParent;
    this.tailOffsetMemory = makeYulLiteral(type.memberHeadSizeMemory);
    this.tailOffsetCalldata = makeYulLiteral(type.memberHeadSizeCalldata);
  }

  cdPtrParent: YulExpression;
  mPtrParent: YulExpression;
  tailOffsetMemory: YulExpression;
  tailOffsetCalldata: YulExpression;
  isInvalid?: YulIdentifier;

  originalBlock?: YulBlock;
  $ = this.factory.yul;
  push = this.block.appendChild;
  let = this.block.let;
  set = this.block.set;

  get root() {
    // // let parent: YulBlock["parent"] | YulSwitch | YulBlock = this.block.parent;
    // let block:
    //   | Exclude<YulBlock["parent"], InlineAssembly>
    //   | YulSwitch
    //   | YulBlock = this.block;
    // while (block.parent && !(block.parent instanceof InlineAssembly)) {
    //   block = block.parent;
    // }
    // if (
    //   !(block.parent instanceof InlineAssembly) ||
    //   !(block instanceof YulBlock)
    // ) {
    //   throw Error(`Could not find root InlineAssembly node for YulBlock`);
    // }
    return this.block.rootBlock;
  }

  increaseTailOffsetMemory(amt: YulExpression) {
    if (this.tailOffsetMemory) {
      const newOffset = this.tailOffsetMemory.smartAdd(amt);
      if (this.tailOffsetMemory instanceof YulIdentifier) {
        this.set(this.tailOffsetMemory, newOffset);
      } else {
        this.tailOffsetMemory = newOffset;
      }
    }
  }

  increaseTailOffsetCalldata(amt: YulExpression) {
    if (this.tailOffsetCalldata) {
      const newOffset = this.tailOffsetCalldata.smartAdd(amt);
      if (this.tailOffsetCalldata instanceof YulIdentifier) {
        this.set(this.tailOffsetCalldata, newOffset);
      } else {
        this.tailOffsetCalldata = newOffset;
      }
    }
  }

  setIsInvalid(expr: YulExpression) {
    if (!this.isInvalid) {
      this.isInvalid = this.let(`is_invalid`, expr);
      return;
    }
    this.set(this.isInvalid, this.isInvalid.or(expr));
  }

  enterFn(
    name: string,
    parameters: (string | YulIdentifier)[],
    returnParameters: (string | YulIdentifier)[]
  ) {
    this.originalBlock = this.block;
    const fn = this.$.makeYulFunctionDefinition(
      name,
      parameters,
      returnParameters,
      undefined,
      this.root
    );
    this.block.insertAtBeginning(fn);
    this.block = fn.body;

    return fn;
  }

  exitFn() {
    if (!this.originalBlock) {
      throw Error(`Can not exit`);
    }
    this.block = this.originalBlock;
    this.originalBlock = undefined;
  }

  wordsToBytes = (node: Expressiony) => expr(node).mul(32);

  addWordOffset = (node: Expressiony) => expr(node).add(32);

  wordsToBytesAdd32 = (words: Expressiony) => expr(words).mul(32).add(32);

  cdLoad = (ptr: Expressiony, offset: Expressiony) =>
    expr(ptr).add(offset).calldataload();

  findConstant = (name: string): VariableDeclaration | undefined =>
    NodeQ.from(this.sourceUnit).find("VariableDeclaration", { name })[0];

  roundUp32 = (node: YulNode) =>
    this.$.and(this.$.add(node, 31), this.roundUpMask);

  roundUpAndAdd32 = (node: YulNode) =>
    this.$.and(this.$.add(node, 63), this.roundUpMask);

  getConstant(name: string, value: string | number) {
    if (this.useNamedConstants) {
      return this.factory.getYulConstant(this.sourceUnit, name, value);
    }
    return this.$.literal(value);
  }

  getSizeConstant(type: AbiType) {
    const name = toTypeName(type);
    if (type.dynamic) {
      throw Error(`Can not get size constant for dynamic type ${name}`);
    }
    return this.getConstant(toScopedName(name, "size"), type.bytes);
  }

  getTypeDataPtrs({ type, name }: NamedAbiType) {
    const mPtrHead = this.mPtrParent.smartAdd(type.memoryHeadOffset);
    const cdPtrHead = this.cdPtrParent.smartAdd(type.calldataHeadOffset);
    if (!isReferenceType(type)) {
      return { mPtrHead, cdPtrHead };
    }

    const mPtrTail = this.let(
      `${name}_ptr`,
      this.mPtrParent.smartAdd(this.tailOffsetMemory)
    );
    this.push(mPtrHead.mstore(mPtrTail));
    let cdPtrTail: YulExpression;
    if (type.dynamic) {
      const offset = cdPtrHead.calldataload();
      if (this.strict) {
        const offsetId = this.let(`${name}_cd_offset`, offset);
        this.setIsInvalid(offsetId.eq(this.tailOffsetCalldata));
        cdPtrTail = this.cdPtrParent.smartAdd(this.tailOffsetCalldata);
      } else {
        cdPtrTail = this.cdPtrParent.smartAdd(offset);
      }
    }
    return { mPtrHead, cdPtrHead, mPtrTail, cdPtrTail };
  }

  buildCopyDynamicArray(
    length: YulIdentifier,
    mPtrHead: YulIdentifier,
    cdPtrHead: YulExpression
  ) {
    /*   `let tailOffset :=  mul(arrLength, 0x20)`,
    `let mPtrTail := add(mPtrHead, tailOffset)`,
    `let totalOffset := tailOffset`,
    `let isInvalid := 0`, */
  }

  getTypeSizes(type: AbiType, name: string) {
    const msize = type.memoryHeadSize + type.memoryTailSize;
    const cdsize = type.calldataHeadSize + type.calldataTailSize;
    if (msize === cdsize) {
      const size = this.getConstant(`${name}_size`, msize);
      return { msize: size, cdsize: size };
    }
    return {
      msize: this.getConstant(`${name}_msize`, msize),
      cdsize: this.getConstant(`${name}_cdsize`, cdsize),
    };
  }

  getAccessCalldataArray = (
    cdPtrDataOrLength: YulExpression,
    { type, name }: NamedAbiType<AbiArray>,
    strict?: boolean
  ) => {
    let dataOffsetId: YulIdentifier;
    let dataOffset: YulExpression;
    let cdPtrData: YulExpression;
    let readArrayLength: YulExpression;
    // let assignOffsetId: YulVariableDeclaration;
    const assignments: YulVariableDeclaration[] = [];
    if (type.length) {
      readArrayLength = this.$.literal(type.length);
      const assignDataPtr = this.$.let(`${name}_cd_data_ptr`, cdPtrData);
      assignments.push(assignDataPtr);
      cdPtrData = assignDataPtr.variables[0] as YulIdentifier;
    } else {
      const assignLengthPtr = this.$.let(`${name}_cd_length_ptr`, cdPtrData);
      assignments.push(assignLengthPtr);
      const lengthPtr = assignLengthPtr.variables[0] as YulIdentifier;
      readArrayLength = lengthPtr.calldataload();

      const assignDataPtr = this.$.let(
        `${name}_cd_data_ptr`,
        lengthPtr.add(32)
      );
      assignments.push(assignDataPtr);
      cdPtrData = assignDataPtr.variables[0] as YulIdentifier;
    }
  };

  copyToFrom({ type, name }: NamedAbiType) {
    if (!type.dynamic) {
      const ptrs = this.getTypeDataPtrs({ type, name });
      if (isValueType(type)) {
        this.push(this.$.calldatacopy(ptrs.mPtrHead, ptrs.cdPtrHead, 32));
      } else {
        const fn = FixedReferenceTypeProcessor.getAST(
          this.block,
          type as AbiStruct | AbiArray,
          name,
          true,
          makeYulIdentifier("cdPtr"),
          undefined,
          true
        );
        this.push(this.$.mstore(ptrs.mPtrHead, fn.call([ptrs.cdPtrHead])));
      }
    } else {
      if (isArray(type)) {
      }
    }
  }

  getFnDecodeDynamicArray({ type, name }: NamedAbiType) {}

  getFnCopyDynLenFixSizeArr({
    type,
    name,
  }: AbiStructField & { type: AbiArray }) {
    if (type.baseType.dynamic) {
      throw Error(
        `Can not handle dynamic baseType in getFnCopyDynLenFixSizeArr`
      );
    }
    const mPtrLength = makeYulIdentifier("mPtrLength");
    const cdPtrLength = makeYulIdentifier("cdPtrLength");
    // const totalSize =
    const fn = this.block.addFunction(
      `abi_decode_${getHighLevelTypeString(type)}`,
      [mPtrLength, cdPtrLength],
      []
    );
    const lengthId = this.let(`${name}_length`, cdPtrLength.calldataload());
  }

  copySimpleDynamicLengthArray(
    { type, name }: AbiStructField & { type: AbiArray },
    {
      cdPtrHead,
      cdPtrTail,
      mPtrHead,
      mPtrTail,
    }: ReturnType<this["getTypeDataPtrs"]>
  ) {
    const { length, baseType } = type;
    if (length) throw Error(`Not expecting length`);
    if (type.dynamicChildrenDepth > 1) {
      throw Error(
        `Can not derive simple length expression for type with ${type.dynamicChildrenDepth} levels of unknown length children`
      );
    }
    if (baseType.dynamic) {
      throw Error("Can not handle dynamic baseType yet");
    }

    if (isValueType(baseType)) {
      const lengthId = this.let(`${name}_length`, cdPtrTail.calldataload());
      const tailSize = this.let(`${name}_tail_size`, lengthId.mul(32).add(32));
      this.push(this.$.calldatacopy(mPtrTail, cdPtrTail, tailSize));
      this.increaseTailOffsetCalldata(tailSize);
      this.increaseTailOffsetMemory(tailSize);
      return;
    }
    const lengthId = this.let(`${name}_length`, cdPtrTail.calldataload());

    if (maxReferenceTypeDepth(baseType) === 1) {
      const tailSize = this.let(`${name}_tail_size`, lengthId.mul(32).add(32));
      const forLoop = this.$.makeYulForLoop(undefined, makeYulLiteral(1));
      const offset = forLoop.pre.let(`offset`, 0);
      this.push(this.$.calldatacopy(mPtrTail, cdPtrTail, tailSize));
      this.increaseTailOffsetCalldata(tailSize);
      this.increaseTailOffsetMemory(tailSize);
      return;
    }

    type CTX = {
      mPtrHead?: YulExpression;
      mPtrTail?: YulExpression;
      mPtrTailNext?: YulExpression;
      cdPtrHead?: YulExpression;
      totalOffset?: YulExpression;
      offset?: YulExpression;
      tailOffset?: YulExpression;
    };
    /* 
      // let assignDataPtr: YulVariableDeclaration;

      // const offset = cdPtrParent.smartAdd(type.calldataHeadOffset)
      // if (type.dynamic) {
      //   dataOffset = offset.calldataload()
      //   if (strict) {
      //     const assignOffsetId = this.$.let(`${name}_cd_head_offset`, dataOffset)
      //     assignments.push(assignOffsetId);
      //     dataOffsetId = assignOffsetId.variables[0] as YulIdentifier;
      //     cdPtrData = cdPtrParent.smartAdd(dataOffsetId);
      //   } else {
      //     cdPtrData = cdPtrParent.smartAdd(dataOffset);
      //   }
      // } else {
      //   cdPtrData = offset
      // } */

    const consumeIndividually = maxReferenceTypeDepth(baseType) > 1;
    let fn: YulFunctionDefinition;
    if (consumeIndividually) {
      fn = FixedReferenceTypeProcessor.getAST(
        this.block,
        baseType as AbiStruct | AbiArray,
        name,
        true,
        makeYulIdentifier("cdPtr"),
        makeYulIdentifier("mPtr"),
        true
      );
    }

    const condition = (ctx: CTX) => {
      if (baseType.dynamic) {
        return ctx.offset.lt(ctx.tailOffset);
      }
      return ctx.mPtrHead.lt(ctx.mPtrTail);
    };

    const loopBody = (body: YulBlock, ctx: CTX) => {
      if (baseType.dynamic) {
        const headPtr = ctx.mPtrHead.smartAdd(ctx.offset);
        const tailPtr = ctx.mPtrHead.smartAdd(ctx.totalOffset);
        body.appendChild(this.$.mstore(headPtr, tailPtr));
        /*
        `  let cdOffsetItemLength := calldataload(add(cdPtrHead, offset))`,
      `  isInvalid := or(isInvalid, xor(cdOffsetItemLength, totalOffset))`,
      `  let cdPtrItemLength := add(cdPtrHead, cdOffsetItemLength)`,
      `  let paddedLength := and(add(calldataload(cdPtrItemLength), 63), OnlyFullWordMask)`,
      `  totalOffset := add(totalOffset, paddedLength)`,
       */
        // mstore(add(mPtrHead, offset), add(mPtrHead, totalOffset))
      } else {
      }
      if (consumeIndividually) {
        fn.call([]);
      }
    };

    if (!consumeIndividually) {
      // this.push(this.$.calldatacopy());
    }
  }

  // handleSimpleType(field: NamedAbiType & { type: AbiReferenceType }) {
  //   const { type, name } = field;

  //   if (type.dynamicChildrenDepth > 1) {
  //     throw Error(
  //       `Can not derive simple length expression for type with ${type.dynamicChildrenDepth} levels of unknown length children`
  //     );
  //   }
  //   const { cdPtrHead, cdPtrTail, mPtrHead, mPtrTail } =
  //     this.getTypeDataPtrs(field);
  //   if (!type.dynamic) {
  //     FixedReferenceTypeProcessor.getAST(
  //       this.block,
  //       type as AbiArray | AbiStruct,
  //       name,
  //       true,
  //       cdPtrHead,
  //       mPtrTail
  //     );
  //     this.increaseTailOffsetMemory(
  //       this.getConstant(
  //         getHighLevelTypeString(type) + "_tail_size",
  //         (type as AbiArray | AbiStruct).memoryTailSize
  //       )
  //     );
  //     return;
  //   }
  //   switch (type.meta) {
  //     case "array": {
  //       const { baseType, length } = type;
  //       if (!length) {
  //         const lengthId = this.let(`${name}_length`, cdPtrTail.calldataload());
  //         if (isValueType(baseType)) {
  //           const tailSize = this.let(
  //             `${name}_tail_size`,
  //             lengthId.mul(32).add(32)
  //           );
  //           this.push(mPtrTail.calldatacopy(cdPtrTail, tailSize));
  //           this.increaseTailOffsetCalldata(tailSize);
  //           this.increaseTailOffsetMemory(tailSize);
  //           return;
  //         }

  //         const canCopyFullTail = maxReferenceTypeDepth(baseType) === 1;
  //         const { msize, cdsize } = this.getTypeSizes(
  //           baseType,
  //           toTypeName(baseType)
  //         );

  //         const cdPtrHeadInner = this.let(
  //           `${name}_cd_head_inner`,
  //           cdPtrTail.add(32)
  //         );
  //         const mPtrHeadInner = this.let(
  //           `${name}_head_inner`,
  //           mPtrTail.add(32)
  //         );
  //         const tailOffset = lengthId.mul(32);
  //         const totalOffset;
  //         const forloop = this.$.makeYulForLoop(undefined, makeYulLiteral(0));

  //         const offset = forloop.pre.let("m_head_offset", 0);
  //         forloop.condition = offset.lt(tailOffset);
  //         forloop.post.set(offset, offset.add(32));
  //         return arrayLength.mul(this.getSizeConstant(type.baseType));
  //       }
  //     }
  //     // case "elementary":
  //   }
  // }
  /*     this.push(
      this.$.mstore(mPtrHead, this.$.smartAdd(mPtrParent, nextMemoryTailOffset))
    );
    const isInvalid = this.$.xor(
      this.$.calldataload(cdPtrHead),
      nextCalldataTailOffset
    );
    const tailSize = this.roundUpAndAdd32(
      this.cdLoadOffset(cdPtrParent, nextCalldataTailOffset)
    ); */

  bytes() {
    const size = this.roundUpAndAdd32(this.$.calldataload(0));
    const zero = makeYulLiteral(0);
    const copy = { dst: zero, src: zero, size };
    /*
    if (forLoop.find("calldatacopy")) {
      copy(

      )
    }
    */
  }

  createBasicArrayLoop(
    { type, name }: NamedAbiType<AbiArray>,
    {
      cdPtrHead,
      cdPtrTail,
      mPtrHead,
      mPtrTail,
    }: ReturnType<this["getTypeDataPtrs"]> // handleLoop: (mPtr: YulExpression, cdPtr: YulExpression, )
  ) {
    const lName = toScopedName(name, `length`);
    // const arrLength =
    //   type.length !== undefined
    //     ? this.getConstant(lName, type.length)
    //     : this.let(lName, cdPtrTail.calldataload());
    // const mPtrHead =
    let returnPtr: YulExpression;
    let mPtrMemberHead: YulExpression;
    /*
    If fixed length:
    - get ptr to head
    If dynamic length:
    - get ptr to length
    - write length
    - get ptr to head = lengthptr + 32
    
    */
    if (type.length) {
    }
    const forloop = this.$.makeYulForLoop(undefined, makeYulLiteral(0));
    // const tailOffset = this.let(`m_tail_offset`, length.mul(32));
    const offset = forloop.pre.let("m_head_offset", 0);
  }

  getArrayAccessors({ type, name }: NamedAbiType<AbiArray>) {
    if (!type.dynamic) {
      throw Error(
        `getArrayAccessors should only be called with dynamic arrays`
      );
    }

    /// Pointer to the head of the first array element.
    const getInnerHeadPointer = (ptrTail: YulExpression) =>
      type.length ? ptrTail : ptrTail.smartAdd(32);
  }

  getOffsetExpression(
    ptr: CastableToYulExpression,
    offset: CastableToYulExpression,
    fieldName?: string,
    ptrSuffix?: string
  ) {
    const ptrAsConst = this.$.resolveConstantValue(ptr, true);
    const offsetAsConst = this.$.resolveConstantValue(offset, true);
    if (ptrAsConst !== undefined && offsetAsConst !== undefined) {
      return this.getConstant(
        toScopedName(fieldName, ptrSuffix, "ptr"),
        toHex(ptrAsConst + offsetAsConst)
      );
    }
    if (offsetAsConst && !(offset instanceof YulIdentifier)) {
      const offsetNode = this.getConstant(
        toScopedName(fieldName, "offset"),
        toHex(offsetAsConst)
      );
      return smartAdd(ptr, offsetNode);
    }
    return smartAdd(ptr, offset);
  }

  get roundUpMask() {
    return this.getConstant("OnlyFullWordMask", PointerRoundUp32Mask);
  }

  handleBytes(
    lengthName: string | YulIdentifier,
    tailPointerMemory: YulExpression,
    tailPointerCalldata: YulExpression
  ) {
    const length = this.set(
      lengthName,
      this.roundUpAndAdd32(tailPointerCalldata.calldataload())
    );
    this.$.calldatacopy(tailPointerMemory, tailPointerCalldata, length);
    return length;
  }
}

function getSimpleCopyCode(
  block: YulBlock,
  type: AbiType,
  // cdPtrParent: YulExpression,
  cdPtr: YulExpression,
  mPtr: YulExpression
) {
  switch (type.meta) {
    case "elementary": {
      block.appendChild(mPtr.calldatacopy(cdPtr, mPtr));
    }
    case "array": {
    }
  }
}

class StructProcessor {}

class ArrayLoop {
  mPtrHead: YulExpression;
  cdPtrHead: YulExpression;
  lengthNode?: YulExpression;
  mPtrTail: YulExpression;
  /**
   * Offset to tail in memory, relative to `mPtrHead`
   */
  mOffsetTail?: YulExpression;

  constructor(
    public block: YulBlock,
    public mPtrOuterTail: YulExpression,
    public cdPtrOuterTail: YulExpression,
    public type: AbiArray,
    public name: string
  ) {
    if (!type.length) {
      this.lengthNode = block.let(
        this.varSuffix("length"),
        cdPtrOuterTail.calldataload()
      );
      this.mPtrHead = mPtrOuterTail.smartAdd(32);
      this.cdPtrHead = cdPtrOuterTail.smartAdd(32);
    } else {
      this.mPtrHead = mPtrOuterTail;
      this.cdPtrHead = cdPtrOuterTail;
    }
    this.mOffsetTail = makeYulLiteral(32).smartMul(
      this.type.length || this.lengthNode
    );
    this.mPtrTail = this.mPtrHead.smartAdd(this.mOffsetTail);
  }

  get baseType() {
    return this.type.baseType;
  }

  get lengthRefInternal() {
    return this.type.length || this.lengthNode;
  }

  get hasMemPtrs() {
    return isReferenceType(this.baseType);
  }

  get hasCdPtrs() {
    return this.baseType.dynamic;
  }

  /**
   * Distance between members in the head in calldata.
   * 32 for dynamic types, otherwise the size of the type
   */
  get calldataStride(): YulExpression {
    return this.baseType.dynamic
      ? makeYulLiteral(32)
      : makeYulLiteral(this.baseType.calldataHeadSize);
  }

  get shouldSumSizes() {
    return this.baseType.dynamic && this.baseType.canCopyTail;
  }

  process() {
    if (!this.hasMemPtrs) {
      this.block.appendChild(
        this.mPtrOuterTail.calldatacopy(
          this.cdPtrHead,
          makeYulLiteral(32).smartMul(this.lengthRefInternal)
        )
      );
      return;
    }
    if (!this.type.length) {
      this.block.appendChild(this.mPtrOuterTail.mstore(this.lengthNode));
    }
  }

  varSuffix(suffix: string) {
    return [this.name, suffix].join("_");
  }

  loopInternal() {
    if (this.baseType.dynamic) {
    }
  }

  addLoopIdentifiers() {
    this.mPtrHead = this.block.let(this.varSuffix(`mPtrHead`), this.mPtrHead);
    if (this.type.dynamic) {
      this.mOffsetTail = this.block.let(
        this.varSuffix("tailOffset"),
        this.mOffsetTail
      );
      this.mPtrTail = this.block.let(
        this.varSuffix("mPtrTail"),
        this.mPtrHead.smartAdd(this.mOffsetTail)
      );
    }
  }

  get nextTail() {
    return 0;
    if (this.baseType.dynamic) {
    }
    // const next = this.mPtrHead.smartAdd
  }

  getNextCdPtr() {}
}

class BasicDecoder {
  /**
   * @todo Define block for class
   *
   * Make `memoryTailOffset` and `currentCdOffset` readonly with `increaseX` fns.
   *
   * First time that a value is set to memoryTailOffset or currentCdOffset
   * which is not a constant, insert an identifier and begin pushing `sets`
   * for each change.
   *
   * For `consumeType`, if type is
   */
  memoryTailOffset: YulExpression;
  currentCdOffset: YulExpression;
  pointers: PendingDynamicPointer[] = [];
  copies: PendingDynamicCopy[] = [];

  constructor(
    memoryTailOffset: CastableToYulExpression,
    public name = "",
    public typeScopeName = ""
  ) {
    this.memoryTailOffset = definitelyExpression(memoryTailOffset);
    this.currentCdOffset = makeYulLiteral(0);
  }

  addPtr(
    dst: CastableToYulExpression,
    value: CastableToYulExpression,
    name?: string
  ) {
    this.pointers.push({
      dst: definitelyExpression(dst),
      value: definitelyExpression(value),
      name,
    });
  }

  addPtrAuto(type: AbiType, _name: string = toTypeName(type)) {
    const name = [this.name, _name].filter(Boolean).join(".");
    this.addPtr(type.memoryHeadOffset, this.memoryTailOffset, name);
  }

  addCopy(type: AbiType, _name: string = toTypeName(type)) {
    const name = [this.name, _name].filter(Boolean).join(".");
    const writeToTail = isReferenceType(type);
    const dst = writeToTail
      ? this.memoryTailOffset
      : definitelyExpression(type.memoryHeadOffset);
    this.copies.push({
      dst,
      src: definitelyExpression(type.calldataHeadOffset),
      size: definitelyExpression(type.calldataHeadSize),
      names: [name],
    });
    if (writeToTail) {
      this.memoryTailOffset = this.memoryTailOffset.smartAdd(
        type.calldataHeadSize
      );
    }
  }
}

// function processStruct(
//   struct: AbiStruct,
//   name: string = toTypeName(struct as AbiType),
//   typeScopeName = toTypeName(struct as AbiType)
// ) {
//   const decoder = new BasicDecoder(
//     skipPointers ? 0 : struct.memberHeadSizeMemory,
//     name
//   );
//   const types = extractTypes(struct.fields);

//   types.forEach((type, i) => {
//     if (type.meta === "array" || type.meta === "struct") {
//       decoder.addPtrAuto(type, struct.fields[i].name);
//       decoder.currentCdOffset = type.calldataHeadOffset;
//       decoder.consumeType(
//         type,
//         struct.fields[i].name,
//         [typeScopeName, struct.fields[i].name].join("_")
//       );
//     } else {
//       decoder.addCopy(type, struct.fields[i].name);
//     }
//   });
//   // decoder.combineCopies();
//   return decoder;
// }

/*
MixedType[2]

let head = add(parent, head)
let arrHead := add(head, cdl(head))


*/

/**
 * Get functions for:
 * - (cdPtrHead) => cdPtrHeadNext
 *    - For dynamic arrays of fixed-size, will not be +32
 * - (mPtrHead) =>
 */
function getArrayLoop(type: AbiArray) {
  const { baseType } = type;
}
