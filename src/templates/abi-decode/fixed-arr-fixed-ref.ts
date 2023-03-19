/* //////////////////////////////////////////////////////////////
             Fixed-length array of fixed size elements
  ////////////////////////////////////////////////////////////// */

import { arrJoiner } from "../../lib/text";
import { compileYul } from "../../ast-rewriter/compile";
import { CopyContext } from "../../type-utils/Copiers";
import { getHighLevelTypeString } from "../../type-utils";
import { toHex } from "../../lib/bytes";
import { AbiArray, AbiStruct, ArrayJoinInput } from "../../types";

export async function getDecodeFunctionFixedArrayFixedReference(
  type: AbiArray & { baseType: AbiStruct | AbiArray }
) {
  const arrayTypeName = getHighLevelTypeString(type);
  const fnName = `abi_decode_${arrayTypeName}`;
  const fullSizeName = `${arrayTypeName}_mem_size`;
  const headSizeName = `${arrayTypeName}_mem_head_size`;
  const tailSizeName = `${arrayTypeName}_mem_tail_size`;
  const writePtrs: ArrayJoinInput[] = new Array(type.length)
    .fill(null)
    .map((_, i) => {
      const headPtr = i === 0 ? `mPtr` : `add(mPtr, ${toHex(i * 32)})`;
      const tailPtr = `add(mPtr, ${toHex(
        type.memberHeadSizeMemory + i * type.baseType.memoryTailSize
      )})`;
      return `mstore(${headPtr}, ${tailPtr})`;
    });

  const code = arrJoiner([
    `function ${fnName}(cdPtr) -> mPtr {`,
    [
      `mPtr := mload(0x40)`,
      // `mstore(add(mPtrParent, mHeadOffset), mPtr)`,
      `// Write pointers in memory`,
      ...writePtrs,
      `// Copy tails to memory`,
      `calldatacopy(add(mPtr, ${headSizeName}), cdPtr, ${tailSizeName})`,
      `mstore(0x40, add(mPtr, ${fullSizeName}))`,
    ],
    `}`,
  ]);
  const constantValues = {
    [headSizeName]: toHex(type.memberHeadSizeMemory),
    [tailSizeName]: toHex(type.baseType.memoryTailSize * type.length),
    [fullSizeName]: toHex(type.memoryTailSize),
  };
  const yulQ = await compileYul(
    code,
    Object.entries(constantValues)
      .map(([name, value]) => `uint256 constant ${name} = ${value};`)
      .join("\n")
  );
  const [functionAST] = yulQ.findFunctionsByName(fnName);
  const getCall = (ctx: CopyContext) => {
    return ctx.$.mstore(
      ctx.mPtrHead,
      ctx.$.fnCall(functionAST, ctx.$.calldataload(ctx.cdPtrHead))
    );
  };
  return {
    functionAST,
    constants: constantValues,
    code,
    getCall,
  };
}
