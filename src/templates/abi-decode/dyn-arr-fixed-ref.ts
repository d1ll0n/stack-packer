/* //////////////////////////////////////////////////////////////
             Dynamic-length array of fixed size elements
  ////////////////////////////////////////////////////////////// */

import { AbiArray, AbiStruct, AbiType } from "../../types";
import { arrJoiner } from "../../lib/text";
import { compileYul } from "../../ast-rewriter/compile";
import { CopyContext } from "../../type-utils/Copiers";
import {
  getHighLevelTypeString,
  isReferenceType,
  toTypeName,
} from "../../type-utils";
import { toHex } from "../../lib/bytes";
import { YulExpression } from "../../ast-rewriter/yul";

// function getSetPointersAndCopyTail(
//   type: AbiType
//   // getTypeLength?: (mPtrTail: YulExpression) => YulExpression
// ) {
//   if (!isReferenceType(type)) {
//     throw Error(
//       `Can nto write pointers for non-reference type ${toTypeName(type)}`
//     );
//   }

//   // if (type.dynamic) {
//   // if (type.dynamicChildrenDepth > 1) throw Error(`Type depth `)
//   // }
//   const typeName = getHighLevelTypeString(type);
//   const getNextTail = (thisTail: YulExpression) => {
//     return thisTail.smartAdd
//   }
//   const tailSizeName = `${typeName}_mem_tail_size`;
// }

export async function getDecodeFunctionDynamicArrayFixedTuple(
  type: AbiArray & { baseType: AbiStruct }
) {
  const typeName = getHighLevelTypeString(type);
  const fnName = `abi_decode_${typeName}`;
  const tailSizeName = `${typeName}_mem_tail_size`;

  const code = arrJoiner([
    `function ${fnName}(cdPtrLength) -> mPtrLength {`,
    [
      `let arrLength := calldataload(cdPtrLength)`,
      ``,
      `mPtrLength := mload(0x40)`,
      `mstore(mPtrLength, arrLength)`,
      ``,
      `let mPtrHead := add(mPtrLength, 32)`,
      `let mPtrTail := add(mPtrHead, mul(arrLength, 0x20))`,
      `let mPtrTailNext := mPtrTail`,
      ` `,
      `// Copy elements to memory`,
      `// Calldata does not have individual offsets for array elements with a fixed size.`,
      `calldatacopy(`,
      `  mPtrTail,`,
      `  add(cdPtrLength, 0x20),`,
      `  mul(arrLength, ${tailSizeName})`,
      `)`,
      ` `,
      `for {} lt(mPtrHead, mPtrTail) {} {`,
      `  mstore(mPtrHead, mPtrTailNext)`,
      `  mPtrHead := add(mPtrHead, 0x20)`,
      `  mPtrTailNext := add(mPtrTailNext, ${tailSizeName})`,
      `}`,
      `mstore(0x40, mPtrTailNext)`,
    ],
    `}`,
  ]);
  const constants = {
    [tailSizeName]: toHex(type.baseType.memoryTailSize),
  };
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

const tailSizeName = "0xaa;";
const code = arrJoiner([
  `function ${"fnName"}(mPtrLength, cdPtrLength) -> dataSize {`,
  [
    `let arrLength := calldataload(cdPtrLength)`,
    `mstore(mPtrLength, arrLength)`,
    ``,
    // `dataSize := mul(arrLength, 0x20)`,
    `let mPtrHead := add(mPtrLength, 32)`,
    // `let mPtrTail := add(mPtrHead, dataSize)`,
    ``,
    `dataSize := mul(arrLength, 0x20)`,
    `let mPtrTail := add(mPtrHead, dataSize)`,
    `// Copy elements to memory`,
    `// Calldata does not have individual offsets for array elements with a fixed size.`,
    `calldatacopy(`,
    `  mPtrTail`,
    `  add(cdPtrLength, 0x20),`,
    `  mul(arrLength, ${tailSizeName})`,
    `)`,
    ` `,
    `for {let ptr := mPtrHead} lt(ptr, mPtrTail) {ptr := add(ptr, 0x20)} {`,
    `  mstore(ptr, add(mPtrHead, dataSize))`,
    `  dataSize := add(dataSize, ${tailSizeName})`,
    `}`,
    `dataSize := add(dataSize, 32)`,
  ],
  `}`,
]);
console.log(code);
