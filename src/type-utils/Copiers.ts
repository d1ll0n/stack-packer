import "../lib/String";
import { AbiArray, AbiFunction, AbiStruct, AbiType } from "../types";
import { DynamicBytes, isReferenceType, isValueType } from "./type-check";
import { Factory } from "../ast-rewriter/Factory";
import { getHighLevelTypeString } from "../tables/function-io";
import { NodeQ } from "../ast-rewriter/NodeQ";
import { PointerRoundUp32Mask } from "../code-gen/offsets";

import {
  CastableToIdentifierOrLiteral,
  CastableToYulExpression,
  YulBlock,
  YulExpression,
  YulIdentifier,
  YulLiteral,
  YulNode,
  YulNodeFactory,
  YulSwitch,
} from "../ast-rewriter/yul";
import { getDecodeFunctionDynamicArrayFixedTuple } from "../templates/abi-decode/dyn-arr-fixed-ref";
import {
  InlineAssembly,
  SourceUnit,
  VariableDeclaration,
} from "solc-typed-ast";
import { toHex } from "../lib/bytes";

const toScopedName = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join("_");

export type AbiPositionData = {
  headOffset: number;
  baseTailOffset?: number;
  hasDynamicLength?: boolean;
  dynamicDepth?: number;
};

export type AbiTypeWithPosition = AbiType & AbiPositionData;

type StrictDecodeContext = {
  mPtrParent: CastableToYulExpression;
  cdPtrParent: CastableToYulExpression;
  mPtrHead: CastableToYulExpression;
  cdPtrHead: CastableToYulExpression;
  /**
   * @property nextCalldataTailOffset
   * @description Next offset in calldata
   */
  nextCalldataTailOffset?: CastableToYulExpression;
  /**
   * @property nextMemoryTailOffset
   * @description Next offset in memory
   */
  nextMemoryTailOffset?: CastableToYulExpression;
};

/*

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

abstract class Copier<T extends AbiType<false, false, true>> {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    public factory: Factory,
    public sourceUnit: SourceUnit,
    public block: YulBlock,
    public name: string,
    public type: T,
    public useNamedConstants?: boolean
  ) {}

  originalBlock?: YulBlock;
  $ = this.factory.yul;
  push = this.block.appendChild;
  let = this.block.let;
  set = this.block.set;

  get root() {
    // let parent: YulBlock["parent"] | YulSwitch | YulBlock = this.block.parent;
    let block:
      | Exclude<YulBlock["parent"], InlineAssembly>
      | YulSwitch
      | YulBlock = this.block;
    while (block.parent && !(block.parent instanceof InlineAssembly)) {
      block = block.parent;
    }
    if (
      !(block.parent instanceof InlineAssembly) ||
      !(block instanceof YulBlock)
    ) {
      throw Error(`Could not find root InlineAssembly node for YulBlock`);
    }
    return block;
  }

  abstract get canJoinPreviousCopy(): boolean;

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

  wordsToBytes(node: CastableToYulExpression) {
    return this.$.mul(32, node);
  }

  addWordOffset(node: CastableToYulExpression) {
    return this.$.add(32, node);
  }

  arrayWordsToTailBytes(arrayWordLength: CastableToYulExpression) {
    return this.addWordOffset(this.wordsToBytes(arrayWordLength));
  }

  cdLoadOffset(ptr: CastableToYulExpression, offset: CastableToYulExpression) {
    return this.$.calldataload(this.$.add(ptr, offset));
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
      return this.$.identifierFor(existingConstant);
    }
    return this.$.literal(value);
  }

  getOffsetExpression(
    ptr: CastableToIdentifierOrLiteral,
    offset: CastableToIdentifierOrLiteral,
    fieldName?: string,
    ptrSuffix?: string
  ) {
    const ptrAsConst = this.$.resolveConstantValue(ptr, true);
    const offsetAsConst = this.$.resolveConstantValue(offset, true);
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
      return this.$.add(ptr, offsetNode);
    }

    return this.$.add(ptr, offset);
  }

  get roundUpMask() {
    return this.getConstant(PointerRoundUp32Mask, "OnlyFullWordMask");
  }

  roundUp32(node: YulNode) {
    return this.$.and(this.$.add(node, 31), this.roundUpMask);
  }

  roundUpAndAdd32(node: YulNode) {
    return this.$.and(this.$.add(node, 63), this.roundUpMask);
  }
}

type PendingCopy = {
  dst: CastableToYulExpression;
  src: CastableToYulExpression;
  size: CastableToYulExpression;
};

export interface CopyContext {
  $: YulNodeFactory;
  mPtrParent: CastableToYulExpression;
  cdPtrParent: CastableToYulExpression;
  tailCopyOngoing?: PendingCopy;

  nextCalldataTailOffset: CastableToYulExpression;
  nextMemoryTailOffset: CastableToYulExpression;

  mPtrHead: CastableToYulExpression;
  cdPtrHead: CastableToYulExpression;
  isInvalid?: YulIdentifier;

  endCurrentCopy?: () => void;
}

class TupleCopier extends Copier<AbiStruct | AbiFunction> {
  tuple: AbiFunction["input"] | AbiStruct;
  nextCalldataTailOffset?: CastableToYulExpression;
  nextMemoryTailOffset?: CastableToYulExpression;
  tailCopyOngoing?: PendingCopy;
  isInvalid?: YulExpression;

  checkIsInvalid() {
    if (this.isInvalid) {
      this.push(this.$.if(this.isInvalid, this.$.revert(0, 0)));
      this.isInvalid = undefined;
    }
  }

  endCurrentCopy() {
    if (this.tailCopyOngoing) {
      const { dst, src, size } = this.tailCopyOngoing;
      if (size !== 0) {
        this.push(this.$.calldatacopy(dst, src, size));
      }
    }
    this.tailCopyOngoing = undefined;
  }

  constructor(
    public factory: Factory,
    public sourceUnit: SourceUnit,
    public block: YulBlock,
    public name: string,
    public type: AbiStruct | AbiFunction,
    public mPtrParent?: CastableToYulExpression,
    public cdPtrParent?: CastableToYulExpression,
    public useNamedConstants?: boolean
  ) {
    super(factory, sourceUnit, block, name, type, useNamedConstants);
    this.tuple = type.meta === "function" ? type.input : type;
    this.nextCalldataTailOffset = this.tuple.memberHeadSizeCalldata;
    this.nextMemoryTailOffset = this.tuple.memberHeadSizeMemory;

    if (this.tuple.memberHeadSizeCalldata === this.tuple.memberHeadSizeMemory) {
      this.tailCopyOngoing = {
        dst: mPtrParent,
        src: cdPtrParent,
        size: this.tuple.memberHeadSizeCalldata,
      };
    }
    if (!mPtrParent) {
      const freeMemoryPointer = this.getConstant(0x40, "FreeMemoryPointer");
      const ptr = this.set(`ptr`, this.$.mload(freeMemoryPointer));
      this.mPtrParent = ptr;
    }
    if (!cdPtrParent) {
      this.cdPtrParent = this.$.literal(4);
    }
  }
}

class BytesCopier extends Copier<DynamicBytes> {
  get canJoinPreviousCopy() {
    return true;
  }

  copy({
    mPtrHead,
    cdPtrHead,
    mPtrParent,
    cdPtrParent,
    nextCalldataTailOffset,
    nextMemoryTailOffset,
  }: CopyContext) {
    this.push(
      this.$.mstore(mPtrHead, this.$.smartAdd(mPtrParent, nextMemoryTailOffset))
    );
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
  }
}

class ArrayCopier extends Copier<AbiArray> {
  offset: YulIdentifier | YulLiteral;
  mPtrLength?: YulIdentifier;

  // eslint-disable-next-line no-useless-constructor
  constructor(
    factory: Factory,
    sourceUnit: SourceUnit,
    block: YulBlock,
    name: string,
    type: AbiArray,
    useNamedConstants?: boolean
  ) {
    super(factory, sourceUnit, block, name, type, useNamedConstants);
    this.offset = this.getConstant(type.headOffset, name);
  }

  get baseType() {
    return this.type.baseType;
  }

  get canJoinPreviousCopy() {
    return (
      this.type.baseType.meta === "elementary" ||
      this.type.baseType.meta === "enum"
    );
  }

  getCdHeadPtr(cdPtrParent: CastableToIdentifierOrLiteral) {
    return this.getOffsetExpression(
      cdPtrParent,
      this.offset,
      toScopedName(this.name, "head"),
      "cd"
    );
  }

  // kind: 'DynamicValueArray' |

  get kind() {
    const isFixed = !!this.type.length;
    if (isValueType(this.baseType)) {
      // Fixed Value Array = fixed length array of value types.
      // Has pointer, no length
      // However, calldata will have no offset
      // Dynamic value array = dynamic length array of value types.
      // Has pointer and length
      return isFixed ? `FixedValueArray` : `DynamicValueArray`;
    }
    return isFixed ? `FixedReferenceArray` : `DynamicReferenceArray`;
  }

  // @todo Consider removing current ongoing is_invalid reference
  // and separating each dynamic into its own fn. Otherwise
  createDecodeBytesArrayFunction() {
    const [mPtrLength, cdPtrLength] = [
      this.$.identifier("m_arr_length"),
      this.$.identifier("cd_arr_length"),
    ];
    const [isInvalid, tailOffset] = [
      this.$.identifier("is_invalid"),
      this.$.identifier("tail_offset"),
    ];

    const fn = this.enterFn(
      `decode_${getHighLevelTypeString(this.type)}`,
      [mPtrLength, cdPtrLength],
      [isInvalid, tailOffset]
    );

    const arrLen = this.let(`arr_len`, this.$.calldataload(cdPtrLength));
    this.push(this.$.mstore(mPtrLength, arrLen));
    this.set(tailOffset, this.wordsToBytes(arrLen));
    const mBeginHead = this.let("m_begin_head", this.$.add(mPtrLength, 32));
    const cdBeginHead = this.let("cd_begin_head", this.$.add(cdPtrLength, 32));
    const cdEndHead = this.let(
      "cd_end_head",
      this.$.add(cdBeginHead, tailOffset)
    );
    const cdPosHead = this.let(`cd_pos_head`, cdBeginHead);
    const mPosHead = this.let("m_pos_head", mBeginHead);

    const loop = this.$.makeYulForLoop(
      undefined,
      this.$.lt(cdPosHead, cdEndHead),
      undefined,
      undefined,
      this.block
    );
    this.push(loop);
    const bytesCopier = new BytesCopier(
      this.factory,
      this.sourceUnit,
      loop.body,
      `item`,
      this.type.baseType as DynamicBytes
    );
    const { isInvalid: isInvalidNext, tailSize } = bytesCopier.copy({
      mPtrHead: mPosHead,
      cdPtrHead: cdPosHead,
      mPtrParent: mBeginHead,
      cdPtrParent: cdBeginHead,
      nextCalldataTailOffset: tailOffset,
      nextMemoryTailOffset: tailOffset,
      $: this.$,
    });
    loop.body.set(isInvalid, this.$.or(isInvalid, isInvalidNext));
    const itemLength = loop.body.let(`item_length`, tailSize);
    loop.body.set(tailOffset, this.$.add(tailOffset, itemLength));

    this.exitFn();
    return fn;
  }

  private DynamicReferenceArray(ctx: CopyContext) {
    if (ctx.tailCopyOngoing && ctx.endCurrentCopy) {
      ctx.endCurrentCopy();
    }
    const fn = this.createDecodeBytesArrayFunction();

    const mPtrLength = this.let(
      toScopedName(this.name, `mptr_length`),
      this.$.smartAdd(ctx.mPtrHead, ctx.nextMemoryTailOffset)
    );
    this.push(this.$.mstore(ctx.mPtrHead, mPtrLength));

    // @todo handle top level array and other ref types
    const lengthOffset = this.$.calldataload(ctx.cdPtrHead);
    const validOffset = this.$.xor(lengthOffset, ctx.nextCalldataTailOffset);
    if (ctx.isInvalid) {
      this.set(ctx.isInvalid, this.$.or(ctx.isInvalid, validOffset));
    } else {
      ctx.isInvalid = this.let(`is_invalid`, validOffset);
    }
    const cdPtrLength = this.$.smartAdd(
      ctx.cdPtrHead,
      ctx.nextCalldataTailOffset
    );

    const fnCall = this.$.fnCall(fn, [mPtrLength, cdPtrLength]);
    const [arrInvalid, arrTailSize] = this.let(
      [
        toScopedName(this.name, `is_invalid`),
        toScopedName(this.name, `tail_size`),
      ],
      fnCall
    );
    this.set(ctx.isInvalid, this.$.or(ctx.isInvalid, arrInvalid));

    // ctx.nextCalldataTailOffset as YulIdentifier
  }

  private DynamicValueArray({
    mPtrParent,
    cdPtrParent,
    nextCalldataTailOffset,
    nextMemoryTailOffset,
  }: StrictDecodeContext) {
    const mPtrData = this.set(
      `ptr`,
      this.$.smartAdd(mPtrParent, nextMemoryTailOffset)
    );
    this.push(
      this.$.mstore(
        this.$.smartAdd(mPtrParent, this.type.memoryHeadOffset),
        mPtrData
      )
    );
    const isInvalid = this.$.xor(
      this.$.calldataload(this.getCdHeadPtr(cdPtrParent)),
      nextCalldataTailOffset
    );
    const tailSize = this.arrayWordsToTailBytes(
      this.cdLoadOffset(cdPtrParent, nextCalldataTailOffset)
    );
    return {
      isInvalid,
      tailSize,
    };
  }

  private FixedValueArray({
    mPtrParent,
    cdPtrParent,
    nextCalldataTailOffset,
    nextMemoryTailOffset,
  }: StrictDecodeContext) {
    const mPtrData = this.set(
      `ptr`,
      this.$.add(mPtrParent, nextMemoryTailOffset)
    );
    const lengthLiteral = this.getConstant(
      this.type.length * 32,
      toScopedName(this.name, "size")
    );
    this.push(
      this.$.mstore(
        this.$.smartAdd(mPtrParent, this.type.memoryHeadOffset),
        mPtrData
      )
    );
    this.push(
      this.$.calldatacopy(
        mPtrData,
        this.$.smartAdd(cdPtrParent, this.type.calldataHeadOffset),
        lengthLiteral
      )
    );
    return {
      nextCalldataTailOffset,
      nextMemoryTailOffset: this.$.add(nextMemoryTailOffset, lengthLiteral),
    };
  }

  copy(ctx: CopyContext) {
    const fixedArray = Boolean(this.type.length);
    if (fixedArray) {
      // if (this.baseType.meta === "struct")
    }
    if (isReferenceType(this.baseType)) {
      if (this.baseType.meta === "struct") {
        if (!this.baseType.dynamic) {
          getDecodeFunctionDynamicArrayFixedTuple(
            this.type as AbiArray & { baseType: AbiStruct }
          );
        }
      }
    }
  }

  /* mstore(add(mPtr, 0x40), add(mPtr, nextCalldataTailOffset))
let is_invalid := xor(calldataload(add(cdPtr, 0x40)), nextCalldataTailOffset)
let c_arr_len := mul(32, calldataload(add(cdPtr, nextCalldataTailOffset))
nextCalldataTailOffset := add(nextCalldataTailOffset, c_arr_len) */

  /*

const groups = Copier[][] = [];
let i = 0;
let isInvalid;
while (i < copiers.length) {
  const group = takeWhile(copiers.slice(i), "canJoinPreviousCopy");
  i += group.length;
  groups.push(group);
}
for (const group of groups) {
  let isInvalid;
}
let isInvalid;
let startNextCopyx

*/
  /* function copyBytesArray(mPtr, cdPtr) -> is_invalid, tail_offset {
  let arr_len := calldataload(cdPtr)
  mstore(mPtr, arr_len)
  mPtr := add(mPtr, 32)
  cdPtr := add(cdPtr, 32)
  tail_offset := mul(arr_len, 32)
  let arr_end := add(cdPtr, tail_offset)
  for {} lt(cdPtr, arr_end) {
    cdPtr := add(cdPtr, 32)
    mPtr := add(mPtr, 32)
  } {
    mstore(mPtr, add(mPtr, tail_offset))
    is_invalid := or(is_invalid, xor(calldataload(cdPtr), tail_offset)
    let bytesLength := roundUpAndAdd32(calldataload(add(cdPtr, tail_offset)))
    tail_offset := add(tail_offset, bytesLength)
  }
} */
}
