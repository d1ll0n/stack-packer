/* eslint-disable no-useless-constructor */
/* //////////////////////////////////////////////////////////////
             Fixed-length array of fixed size elements
  ////////////////////////////////////////////////////////////// */

import { arrJoiner } from "../../lib/text";
import { compileYul } from "../../ast-rewriter/compile";
import { CopyContext } from "../../type-utils/Copiers";
import { toHex } from "../../lib/bytes";
import { AbiArray, AbiStruct, AbiType } from "../../types";
import {
  AbiValueType,
  extractTypes,
  isArray,
  isReferenceType,
  isStruct,
  isValueType,
  toTypeName,
} from "../../type-utils";
import { combineSequentialCopies, PendingCopy, PendingPointer } from "./utils";

/*
struct ABC {
  uint256 x;
}
struct DEF {
  ABC a;
  ABC b;
  ABC[2] c;
}
struct GHI {
  ABC a;
  uint256 b;
}
struct Wrap {
  ABC v1;
  DEF v2;
  GHI v3;
}

Wrap:
Tail = 96
-ABC v1:
-- Head: 0x00, points to 96
-- Tail: copy(0, 0, 32)
-- -> Convert: dst + tailoffsetMemory, src + field.headOffsetCalldata
---- tailOffsetMemory += size, tailoffset = 128
- DEF v2:
-- Head: 32
-- Tail:
--- tailoffset = 96
---- a: head = 0
---- copy()



Set DEF to tail
a = tail + 128
b = tail + 160
c = tail + 192
Copy 128 bytes from cdPtr to tail+228

*/


// function decodeStructTail(type: AbiStruct) {
//   const tailoffsetMemory = type.memberHeadSizeMemory;
//   const ptrs;
// }

export function getDecodeFixedReferenceType(type: AbiStruct | AbiArray) {
  if (
    [type.bytes, type.memoryHeadOffset, type.calldataHeadOffset].some(
      (n) => n === undefined
    )
  ) {
    throw Error(`Can not derive fixed offsets for non-fixed type`);
  }

  const head: { offset: number; value: number }[] = [];
  const tail: { dst: number; src: number; length: number }[] = [];
  let currentHeadSize = 0;
  // let currentTailSize = 0;
  let tailOffsetCalldata = type.memberHeadSizeCalldata;
  let tailOffsetMemory = type.memberHeadSizeMemory;
  const addTailValue = (field: AbiStruct | AbiArray) => {
    const src = field.calldataHeadOffset;
    const dst;
  };
  const addPtrAuto = (offset: number, value: number) => {
    head.push({
      offset: offset + currentHeadSize,
      value: value + currentHeadSize,
    });
    currentHeadSize += 32;
  };
  // const addTailCopy = (dst: number, src: number)
  /*  */
  if (type.meta === "array") {
    if (isArray(type.baseType) || isStruct(type.baseType)) {
      for (let i = 0; i < type.length; i++) {
        addPtrAuto(
          i * 32,
          type.memberHeadSizeMemory + i * type.baseType.memoryTailSize
        );
      }
      const { head: subPointers, copies: subCopies } =
        getDecodeFixedReferenceType(type.baseType);
      subPointers.forEach((ptr) => {
        ptr.dstOffset += type;
      });
    } else {
      if (type.baseType.dynamic) {
        throw Error(`Should not have received dynamic base type`);
      }
      pointers.push({
        dstOffset: {
          from: "head",
          value: type.memoryHeadOffset,
        },
      });
      const length = type.baseType.calldataTailSize;
    }
  } else if (type.meta === "struct") {
    const { mHeadSize } = type;

    // for (let i = 0;)
    // type.fields.filter(f => f.meta === "struct").forEach((field, i) => {

    // })
  }
  return {
    head,
    copies,
  };
}

export async function getDecodeFunctionFixedArrayValue(
  type: AbiArray & { baseType: AbiValueType }
) {
  const typeName = toTypeName(type.baseType);
  const arrayTypeName = `array_${type.length}_${typeName}`;
  const fnName = `abi_decode_${arrayTypeName}`;
  const sizeName = `${arrayTypeName}_mem_size`;

  const code = arrJoiner([
    `function ${fnName}(cdPtr) -> mPtr {`,
    [
      `mPtr := mload(0x40)`,
      `// Copy tails to memory`,
      `calldatacopy(mPtr, cdPtr, ${sizeName})`,
      `mstore(0x40, add(mPtr, ${sizeName}))`,
    ],
    `}`,
  ]);
  const constantValues = {
    [sizeName]: toHex(32 * type.length),
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
