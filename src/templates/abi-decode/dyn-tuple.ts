/* //////////////////////////////////////////////////////////////
             Dynamic-length array of fixed size elements
  ////////////////////////////////////////////////////////////// */

import { arrJoiner } from "../../lib/text";
import { compileYul } from "../../ast-rewriter/compile";
import { CopyContext } from "../../type-utils/Copiers";
import {
  DynamicBytes,
  extractTypes,
  getCopyCost,
  getWriteCost,
  getWriteHeadCost,
  isDynamic,
  isStatic,
} from "../../type-utils";
import { toHex } from "../../lib/bytes";
import {
  AbiArray,
  AbiFunction,
  AbiStruct,
  AbiType,
  ArrayJoinInput,
} from "../../types";
import { findIndex, findLast, findLastIndex, takeRightWhile } from "lodash";

export async function getDecodeFunctionDynamicTuple(
  _type: AbiStruct | AbiFunction,
  constantCdPtr?: boolean
) {
  const type: AbiStruct =
    _type.meta === "struct"
      ? _type
      : {
          meta: "struct",
          name: `${_type.name}_input`,
          ..._type.input,
          coderType: "checked",
          groups: [],
        };
  const typeName = `bytes`;
  const fnName = `abi_decode_dyn_array_${typeName}`;
  const tailSizeName = `${typeName}_mem_tail_size`;

  /*
      Dynamic array of structs without embedded reference types
      - Get pointer to start of data by reading offset to length
      - Determine total size by multiplying length by struct size
      - 
      If you have an embedded fixed-size reference type,
      you need to loop over the array elements and copy each one
      
      For some types, we can read length and derive bytes to copy
      and copy the entire buffer at once.
      For others, we need to loop over each element to derive total size, but
      then we can copy the whole thing at once.
      For array types:
      setPointers = isReferenceType(baseType)
      hasDynamicLength = baseType.dynamic
      canCopyTails = type.canCopyTail
      if (hasDynamicLength && canCopyTails) {
        let length = 0
        for (let head of heads) {
          
        }
      }
    
      - If length is dynamic
        - If baseType is value, itemLength = 32, read length, mul, copy
    
      
    
    
       is a simple reference type, with no embedded
      reference types, i.e. canCopyTail is true and maxDynamicDepth is 1,
    
      For others, we'll need to use another function 
    
    
      For array type:
      // - If base type is value
      */
  const constants: Record<string, string> = {};

  const types = extractTypes(type.fields);
  const staticMemberCopies: ArrayJoinInput[] = [];
  let currentCopyStartIndex: number | undefined = 0;

  const code = arrJoiner([
    `function ${fnName}(cdPtrHead) -> mPtr {`,
    [
      `let arrLength := calldataload(cdPtrLength)`,
      ``,
      `mPtrLength := mload(0x40)`,
      `mstore(mPtrLength, arrLength)`,
      ``,
      `let mPtrHead := add(mPtrLength, 32)`,
      `let cdPtrHead := add(cdPtrLength, 32)`,
      ` `,
      `let tailOffset :=  mul(arrLength, 0x20)`,
      `let mPtrTail := add(mPtrHead, tailOffset)`,
      `let totalOffset := tailOffset`,
      `let isInvalid := 0`,
      `for {let offset := 0} lt(offset, tailOffset) { offset := add(offset, 32) } {`,
      `  mstore(add(mPtrHead, offset), add(mPtrTail, totalOffset))`,
      `  let cdOffsetItemLength := calldataload(add(cdPtrHead, offset))`,
      `  isInvalid := or(isInvalid, xor(cdOffsetItemLength, totalOffset))`,
      `  let cdPtrItemLength := add(cdPtrHead, cdOffsetItemLength)`,
      `  let paddedLength := roundUpAdd32(calldataload(cdPtrItemLength))`,
      `  totalOffset := add(totalOffset, paddedLength)`,
      `}`,
      `calldatacopy(`,
      `  mPtrTail,`,
      `  add(cdPtrHead, tailOffset),`,
      `  sub(totalOffset, tailOffset)`,
      `)`,
      `mstore(0x40, add(mPtrLength, totalOffset))`,
    ],
    `}`,
  ]);
  // const constants = {
  //   [tailSizeName]: toHex(type.baseType.memoryTailSize),
  // };
  const yulQ = await compileYul(
    code,
    Object.entries(constants)
      .map(([name, value]) => `uint256 constant ${name} = ${value};`)
      .join("\n")
  );
  const [functionAST] = yulQ.findFunctionsByName(fnName);
  const getCall = (ctx: CopyContext) => {
    return ctx.$.mstore(
      ctx.mPtrHead,
      ctx.$.fnCall(
        functionAST,
        ctx.$.add(ctx.cdPtrParent, ctx.$.calldataload(ctx.cdPtrHead))
      )
    );
  };
  return {
    code,
    functionAST,
    constants,
    getCall,
  };
}
// const separateExcessiveSequentialDynamicMembers = (_types: AbiType[]) => {
//   let sequentialCount = 0;
//   let lastDynamicIndex = 0;
//   // const outArray

//   const firstDynamic = findIndex(_types, isDynamic);
//   if (firstDynamic > 0) {

//   }
//   for (let i = 0; i < _types.length; i++) {
//     const previousDynamicNodes = takeRightWhile(_types.slice(), isDynamic);
//     if (previousDynamicNodes) {}
//   }
// }
/*   const stopCopy = (endIndex: number) => {
    if (endIndex === currentCopyStartIndex) return;
    const startIndex =
      currentCopyStartIndex +
      findIndex(types.slice(currentCopyStartIndex), isStatic);
    endIndex =
      startIndex +
      findLastIndex(types.slice(startIndex, endIndex + 1), isStatic);
    const {
      calldataHeadOffset: cdOffsetStart,
      memoryHeadOffset: mOffsetStart,
    } = types[startIndex];
    const cdOffsetEnd = types[endIndex].calldataHeadOffset;
    const mPtr = mOffsetStart === 0 ? `mPtr` : `add(mPtr, ${mOffsetStart})`;
    const cdPtr =
      cdOffsetStart === 0 ? `cdPtr` : `add(cdPtr, ${cdOffsetStart})`;
    if (startIndex === endIndex) {
      // Do write
      staticMemberCopies.push(`mstore(${mPtr}, calldataload(${cdPtr}))`);
    } else {
      const length = cdOffsetEnd - cdOffsetStart;
      staticMemberCopies.push(`calldatacopy(${mPtr}, ${cdPtr}, ${length})`);
    }
  };
  for (let i = 0; i < types.length; i++) {
    if (currentCopyStartIndex === undefined) {
      currentCopyStartIndex = i;
    }
    if (i === types.length - 1 || !types[i + 1].canCopyHead) {
      stopCopy(i);
    }
    if (!types[i].canCopyHead) {
      // Must be a reference type with a fixed size
      
    }
  } */