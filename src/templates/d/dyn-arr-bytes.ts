/* //////////////////////////////////////////////////////////////
             Dynamic-length array of fixed size elements
  ////////////////////////////////////////////////////////////// */

import { AbiArray, AbiType } from "../../types";
import { arrJoiner } from "../../lib/text";
import { compileYul } from "../../ast-rewriter/compile";
import { CopyContext } from "../../type-utils/Copiers";
import { find } from "lodash";
import {
  getHighLevelTypeString,
  isDynamicBytes,
  isValueType,
  maxReferenceTypeDepth,
  setActualSizes,
  toTypeName,
} from "../../type-utils";
import { parseCode } from "../../parser";
import { PointerRoundUp32Mask } from "../../code-gen/offsets";
import { toHex } from "../../lib/bytes";

// function handleBytes

export function canDeriveSizeInOneStep(type: AbiArray) {
  return (
    type.baseType.dynamicChildrenDepth === 1 &&
    maxReferenceTypeDepth(type.baseType) === 1
  );
}

const roundUpAdd32 = (value: string) =>
  `and(add(${value}, AlmostTwoWords), OnlyFullWordMask)`;

function buildGetTailSize(
  constants: Record<string, string>,
  type: AbiType,
  ptr: string
) {
  if (isDynamicBytes(type)) {
    constants.OnlyFullWordMask = PointerRoundUp32Mask;
    constants.AlmostTwoWords = toHex(63);
    return roundUpAdd32(`calldataload(${ptr})`);
  }
  if (type.meta === "array" && isValueType(type.baseType)) {
    return `mul(add(calldataload(${ptr}), 1), 0x20)`;
  }
  throw Error(`getTailSize not implemented for ${toTypeName(type)}`);
}

export async function getDecodeFunctionDynamicArrayBytes(type: AbiArray) {
  if (!canDeriveSizeInOneStep(type)) {
    throw Error();
  }
  const typeName = getHighLevelTypeString(type);
  const fnName = `abi_decode_${typeName}`;
  // const tailSizeName = `${typeName}_mem_tail_size`;

  /*   const loopBody = (
    headOffsetMemory: string,
    headOffsetCalldata: string
    // totalOffset,
  ) => {
    return [
      `  mstore(add(mPtrHead, offset), add(mPtrHead, totalOffset))`,
      `  let cdOffsetItemLength := calldataload(add(cdPtrHead, ${headOffsetCalldata}))`,
      `  isInvalid := or(isInvalid, xor(cdOffsetItemLength, totalOffset))`,
      `  let cdPtrItemLength := add(cdPtrHead, cdOffsetItemLength)`,
      `  let paddedLength := and(add(calldataload(cdPtrItemLength), 63), OnlyFullWordMask)`,
      `  totalOffset := add(totalOffset, paddedLength)`,
      // `  mstore(add(mPtrHead, ${headOffsetMemory}), add(mPtrTail, totalOffset))`,
      // `  let cdOffsetItemLength := calldataload(add(cdPtrHead, ${headOffsetCalldata}))`,
      // `  isInvalid := or(isInvalid, xor(cdOffsetItemLength, totalOffset))`,
      // `  let cdPtrItemLength := add(cdPtrHead, cdOffsetItemLength)`,
      // `  let paddedLength := roundUpAdd32(calldataload(cdPtrItemLength))`,
      // `  totalOffset := add(totalOffset, paddedLength)`,
    ];
  }; */
  const constants: Record<string, string> = {
    // [tailSizeName]: toHex(type.baseType.memoryTailSize),
  };
  // `roundUpAdd32(calldataload(cdPtrItemLength))`
  const tailSizeExpression = buildGetTailSize(
    constants,
    type.baseType,
    `cdPtrItemLength`
  );

  const code = arrJoiner([
    `function ${fnName}(cdPtrLength) -> mPtrLength {`,
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
      `  mstore(add(mPtrHead, offset), add(mPtrHead, totalOffset))`,
      `  let cdOffsetItemLength := calldataload(add(cdPtrHead, offset))`,
      `  isInvalid := or(isInvalid, xor(cdOffsetItemLength, totalOffset))`,
      `  let cdPtrItemLength := add(cdPtrHead, cdOffsetItemLength)`,
      `  let paddedLength := ${tailSizeExpression}`,
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

const code = `
struct FixedType {
  uint256 x;
}
struct MixedType {
  FixedType a;
  bytes b;
}
function testUintArray(uint256[][] calldata arr) pure {}
function testBytesArray(bytes[2] calldata arr) pure {}
function testMixed(MixedType[2] calldata arr) pure {}
`;
const { functions } = parseCode(code);
functions.forEach((fn) => {
  setActualSizes(fn);
  const { fields } = fn.input;
  const checkType = (type: AbiType) => {
    const arr = [];
    arr.push(
      `${toTypeName(type)}: ccTail: ${type.canCopyTail} | ccHead: ${
        type.canCopyHead
      } | cd ${type.calldataTailSize} | mem ${type.memoryTailSize}`
    );
    if (type.meta === "array") {
      arr.push(checkType(type.baseType));
    } else if (type.meta === "struct") {
      type.fields.forEach(({ type }) => arr.push(checkType(type)));
    }
    return arr;
  };

  fields.forEach(({ type, name }) => {
    console.log(arrJoiner(checkType(type)));
  });
});

function deriveTailSize(type: AbiType, ptr: string) {
  switch(type.meta) {
    case "array": {
      if (!type.dynamic) return type.calldataTailSize;
      
    }

  }
}

// const [testUintArray, testBytesArray] = ["testUintArray", "testBytesArray"].map(
//   (name) => find(functions, { name })
// );

// getDecodeFunctionDynamicArrayBytes(
//   testUintArray.input.fields[0].type as AbiArray
// ).then(({ code }) => {
//   console.log(code);
// });

// const getTestItem = (t: AbiType) => {
//   // const definitions
//   switch(t.meta) {
//     case
//   }
// }
