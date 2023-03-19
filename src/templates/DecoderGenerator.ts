/* eslint-disable no-dupe-class-members */
/* eslint-disable no-useless-constructor */
import { arrJoiner } from "../lib/text";
import { compileSolFunction } from "../ast-rewriter/compile";
import { getInputGetterFunctionName } from "../tables/function-io";
import { toHex } from "../lib/bytes";

import {
  AbiArray,
  AbiEnum,
  AbiFunction,
  AbiStruct,
  AbiType,
  ArrayJoinInput,
  Include,
} from "../types";
import {
  AbiReferenceType,
  extractTypes,
  getHighLevelTypeString,
  getParamDefinition,
  isReferenceType,
  isValueType,
  maxReferenceTypeDepth,
  toTypeName,
} from "../type-utils";
import { BlockWrapper } from "../ast-rewriter/yul/BlockWrapper";
import {
  CastableToYulExpression,
  definitelyExpression,
  isConstant,
  makeYulIdentifier,
  makeYulLiteral,
  resolveConstantValue,
  YulBlock,
  YulExpression,
  YulFunctionDefinition,
  YulIdentifier,
} from "../ast-rewriter/yul";
import { cloneDeep, findIndex } from "lodash";
import {
  combineSequentialCopies,
  combineSequentialDynamicCopies,
  PendingCopy,
  PendingDynamicCopy,
  PendingDynamicPointer,
  PendingPointer,
} from "./abi-decode/utils";
import {
  expressionGt,
  expressionGte,
  expressionLt,
} from "../ast-rewriter/yul/mathjs";
import { Factory } from "../ast-rewriter/Factory";
import { SourceUnit } from "solc-typed-ast";

/*
bytes[] arr;
arr ptr = 0;
arr length = 32;
arr[0] = 64;

copy(0, 0, add(32, bytes.length))

copy.dst += 

*/

export class DecoderGenerator extends BlockWrapper {
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
  calldataTailOffset: YulExpression;
  currentCdOffset: YulExpression;
  pointers: PendingDynamicPointer[] = [];
  copies: PendingDynamicCopy[] = [];

  varName(suffix: string) {
    return [this.name, suffix].join("_");
  }

  constructor(
    public factory: Factory,
    public sourceUnit: SourceUnit,
    public block: YulBlock,
    public type: AbiStruct | AbiArray,
    public useNamedConstants?: boolean,
    public name = ""
  ) {
    super(factory, sourceUnit, block, useNamedConstants);
    this.memoryTailOffset = definitelyExpression(type.memberHeadSizeMemory);
    this.calldataTailOffset = definitelyExpression(type.memberHeadSizeCalldata);
    if (type.dynamic) {
      this.memoryTailOffset = block.let(
        this.varName("mPtrTail"),
        this.memoryTailOffset
      );
      this.calldataTailOffset = block.let(
        this.varName("cdPtrTail"),
        this.calldataTailOffset
      );
    }
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

  protected static processArray(
    array: AbiArray,
    name: string = toTypeName(array),
    typeScopeName = toTypeName(array)
  ) {
    const decoder = new DecoderGenerator(array.memberHeadSizeMemory, name);
    const { baseType } = array;
    if (isValueType(baseType)) {
      decoder.addCopy(array, "");
      return;
    }
    const baseDecoder = DecoderGenerator.process(
      baseType as AbiStruct | AbiArray,
      `${name}[x]`
    );
    if (baseDecoder.memoryTailOffset !== baseType.memoryTailSize) {
      throw Error(
        `Decoder ${toTypeName(
          baseType
        )} Error: offset != baseType tailSize | Decoder ${
          baseDecoder.memoryTailOffset
        } vs baseType ${baseType.memoryTailSize}`
      );
    }
    const headSize = array.memberHeadSizeMemory;
    const consumeIndividually = maxReferenceTypeDepth(baseType) > 1;
    if (!consumeIndividually) {
      baseDecoder.copies = [
        {
          dst: 0,
          src: 0,
          size: baseType.calldataHeadSize * array.length,
          names: [`${name}[0:${array.length}]`],
        },
      ];
      baseDecoder.memoryTailOffset = baseDecoder.copies[0].size;
    }
    for (let i = 0; i < array.length; i++) {
      const replaceIndex = (str: string) =>
        str.replace(`${name}[x]`, `${name}[${i}]`);

      const dstOffset = 32 * i;
      const valueOffset = headSize + i * baseType.memoryTailSize;
      decoder.addPtr(dstOffset, valueOffset, `${name}[${i}]`);
      if (consumeIndividually) {
        decoder.currentCdOffset = i * baseType.calldataHeadSize;
        decoder.consume(baseDecoder, replaceIndex);
      }
    }
    if (!consumeIndividually) {
      decoder.consume(baseDecoder);
    }
    // decoder.combineCopies();
    return decoder;
  }

  protected static processStruct(
    struct: AbiStruct | AbiFunction["input"],
    name: string = toTypeName(struct as AbiType),
    typeScopeName = toTypeName(struct as AbiType),
    skipPointers = false
  ) {
    const decoder = new DecoderGenerator(
      skipPointers ? 0 : struct.memberHeadSizeMemory,
      name
    );
    const types = extractTypes(struct.fields);
    if (!types.some(isReferenceType)) {
      // Copy entire struct
      decoder.copies.push({
        dst: makeYulLiteral(0),
        src: makeYulLiteral(0),
        size: makeYulLiteral(struct.calldataHeadSize),
        names: [name],
      });
      return decoder;
    } else {
      types.forEach((type, i) => {
        if (type.meta === "array" || type.meta === "struct") {
          decoder.addPtrAuto(type, struct.fields[i].name);
          decoder.currentCdOffset = makeYulLiteral(type.calldataHeadOffset);
          decoder.consumeType(
            type,
            struct.fields[i].name,
            [typeScopeName, struct.fields[i].name].join("_")
          );
        } else {
          decoder.addCopy(type, struct.fields[i].name);
        }
      });
    }
    // decoder.combineCopies();
    return decoder;
  }

  consumeType(
    type: AbiStruct | AbiArray,
    name?: string,
    typeScopeName?: string
  ) {
    this.consume(DecoderGenerator.process(type, name, typeScopeName));
  }

  consume(
    decoder: Include<
      DecoderGenerator,
      ["copies", "memoryTailOffset", "pointers"]
    >,
    nameChangeFn: (str: string) => string = (str: string) => str
  ) {
    const changeNames = (str: string | string[] | undefined) => {
      if (str === undefined) return undefined;
      if (Array.isArray(str)) {
        return str.map(changeNames);
      }
      return nameChangeFn(str);
    };
    for (const ptr of decoder.pointers) {
      this.pointers.push({
        dst: ptr.dst.smartAdd(this.memoryTailOffset),
        value: ptr.value.smartAdd(this.memoryTailOffset),
        name: changeNames(ptr.name),
      });
    }
    for (const copy of decoder.copies) {
      this.copies.push({
        dst: this.memoryTailOffset.smartAdd(copy.dst),
        src: this.currentCdOffset.smartAdd(copy.src),
        size: copy.size,
        names: changeNames(copy.names),
      });
    }
    this.memoryTailOffset = this.memoryTailOffset.smartAdd(
      decoder.memoryTailOffset
    );
  }
}

type DecoderASTOptions = (
  | { loadMemoryPointer: true; mPtr?: undefined }
  | { loadMemoryPointer?: undefined | false; mPtr: YulExpression }
) & {
  block: YulBlock;

  type: AbiStruct | AbiArray;

  name: string;

  cdPtr: number | YulExpression;

  /**
   * Whether to add a decoder function to the current block.
   * If false, adds the decoding logic to the current block.
   */
  addFunction?: boolean;
};

function decoderToAST({
  loadMemoryPointer,
  mPtr: _mPtr,
  cdPtr: _cdPtr,
  name,
  type,
  block,
  addFunction,
}: DecoderASTOptions) {
  const constantCdPtr = isConstant(_cdPtr);
  const mPtrId = makeYulIdentifier(`mPtr`);

  if (loadMemoryPointer && !addFunction) {
    throw Error(`Can not load mPtr outside function`);
  }

  const mPtr = loadMemoryPointer ? mPtrId : _mPtr;
  const cdPtr = constantCdPtr
    ? makeYulLiteral(resolveConstantValue(_cdPtr, false))
    : makeYulIdentifier(`cdPtr`);

  let body = block;
  let fn: YulFunctionDefinition;
  if (addFunction) {
    fn = block.addFunction(
      `abi_decode_${getHighLevelTypeString(type)}`,
      [],
      []
    );

    body = fn.body;
    if (!constantCdPtr) fn.parameters.push(cdPtr as YulIdentifier);
    if (loadMemoryPointer) fn.returnVariables.push(mPtrId as YulIdentifier);
    else fn.parameters.push(mPtrId as YulIdentifier);

    if (loadMemoryPointer) {
      body.set(mPtrId, makeYulLiteral(64).mload());
    }
  }
  const decoder = this.process(type, name, toTypeName(type));
  const { pointers, copies } = applyOffsets(
    decoder.pointers,
    decoder.copies,
    mPtr,
    cdPtr
  );
  addSortedAndDocumentedPointersAndCopies(body, pointers, copies);
  if (loadMemoryPointer) {
    body.appendChild(mPtr.mstore(mPtr.smartAdd(decoder.memoryTailOffset)));
  }

  if (addFunction) {
    return fn;
  }
}

function addSortedAndDocumentedPointersAndCopies(
  body: YulBlock,
  ptrs: PendingDynamicPointer[],
  copies: PendingDynamicCopy[]
) {
  ptrs.forEach((ptr) => {
    const copyThatWouldOverwrite = findIndex(copies, ({ dst, size }) => {
      return (
        expressionGte(ptr.dst, dst) === 1 &&
        expressionLt(ptr.dst, dst.smartAdd(size)) === 1
      );
    });
    if (copyThatWouldOverwrite > -1) {
      const [{ src, dst, size, names }] = copies.splice(
        copyThatWouldOverwrite,
        1
      );
      const copy = dst.calldatacopy(src, size);
      if (names && names.length) {
        copy.documentation = [`Copy data for ${names.join(",")}`];
        if (ptr.name) {
          copy.documentation.push(
            `Copy first because it will write to the same position as the ptr to ${ptr.name}`
          );
        }
      }
      body.appendChild(copy);
    }
    const { dst, value, name } = ptr;
    const expr = dst.mstore(value);
    if (name) {
      expr.documentation = `Write pointer for ${name}`;
    }
    body.appendChild(expr);
  });
  copies.forEach(({ src, dst, size, names }) => {
    const copy = dst.calldatacopy(src, size);
    if (names && names.length) {
      copy.documentation = `// Copy data for ${names.join(",")}`;
    }
    body.appendChild(copy);
  });
}

function applyOffsets(
  _pointers: PendingDynamicPointer[],
  _copies: PendingDynamicCopy[],
  mOffset: CastableToYulExpression,
  cdOffset: CastableToYulExpression
) {
  const pointers: PendingDynamicPointer[] = [..._pointers]
    .sort((a, b) => expressionGt(a.dst, b.dst))
    .map((ptr) => ({
      dst: ptr.dst.smartAdd(mOffset),
      value: ptr.value.smartAdd(mOffset),
      name: ptr.name,
    }));
  const copies = combineSequentialDynamicCopies(
    _copies.map((copy) => ({
      dst: copy.dst.smartAdd(mOffset),
      src: copy.src.smartAdd(cdOffset),
      size: copy.size,
      names: [...copy.names],
    }))
  );

  return { pointers, copies };
}
