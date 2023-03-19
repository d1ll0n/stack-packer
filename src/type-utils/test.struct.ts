import {
  AbiArray,
  AbiStruct,
  AbiStructField,
  AbiType,
  ArrayJoinInput,
} from "../types";
import { parseCode } from "../parser";
import { extractTypes, getCopyCost, setActualSizes } from "./type-check";
// import { getDecodeFunctionFixedArrayFixedTuple } from "../templates/abi-decode/fixed-arr-fixed-ref";
import { getDecodeFunctionDynamicArrayFixedTuple } from "../templates/abi-decode/dyn-arr-fixed-ref";
import { getHighLevelTypeString, toTypeName } from "./names";
import { arrJoiner } from "../lib/text";
import _, { takeWhile } from "lodash";
import { getSequentialFromFixedMembers } from "../templates/abi-decode/utils";
import { FixedReferenceTypeProcessor } from "../templates/abi-decode/fixed-ref";

const code = `
struct FixedData {
  uint256 x;
}
struct DynamicData {
  uint256 value;
  bytes data;
}
struct DEF {
  FixedData a;
  FixedData b;
  FixedData[2] c;
}
struct GHI {
  FixedData a;
  uint256 b;
}
struct Wrap {
  FixedData v1; // 1
  DEF v2; // 4
  GHI v3; // 2
  // bytes v4;
}
// write 0: 96
// write 32: 128
// write 64: 

struct Sequencer {
  uint256 a;
  FixedData b;
  uint256 c;
  uint256[2] d;
  uint256 e;
  FixedData f;
  FixedData g;
  FixedData h;
  FixedData i;
  FixedData j;
  FixedData k;
  uint256 l;
  FixedData m;
  uint256 n;
}

// copy v1.x (0:32) to 96:128
// copy v2.a (32:64)
// copy v2.b (64:96)
// copy v2.c (96:160)
// copy v3.a
// copy v3.b

/*
For field of field:
const allTypes = (type) => type is struct ? [type, ...type.fields.map(allTypes)] : [type]
const seqValues = getSequential(allTypes(types), (t) => isReferenceType);
for (type) {
  if (isRef(type)) {
    push({ type: "ptr", offset: type.memoryHeadOffset })
    addCopy(type.calldataHeadOffset, type.calldataHeadSize)
  } else {
    addCopy(type.calldataHeadOffset)
  }
}
let tailSize = headSize;
const realCopies = copies.map((c) => {
  const cNew = { from: c.offset, to: tailSize, size: c.size };
  tailSize += c.size
  return cNew;
})

@todo How to determine which values to copy - maybe get alternating chunks of [valueType], [referenceType]
if (canCopyHead)

*/

function doFixedRefArr(FixedData[2] calldata data) pure {}
function doDynamicRefArr(FixedData[] calldata data) pure {}
function doWrap(Wrap calldata data) pure {}
function sequence(Sequencer calldata data) pure {}
function arr(FixedData[2] calldata a, FixedData[2] calldata b, FixedData[2] calldata c) pure {}
`;


const arr = [0, 1, 2, 3];
// const z = _(arr)
//   .takeWhile((x, i, prev) => {
//     console.log(`arr[${i}] = ${x}`);
//     console.log(`So far: ${JSON.stringify(prev)}`);
//     console.log("");
//     return x < 2;
//   })
// .value();
// takeWhile(arr, (x, i, prev, y) => {
//   console.log(`arr[${i}] = ${x}`);
//   console.log(`So far: ${JSON.stringify(prev)}`);
//   console.log("");
//   return x < 2;
// })
// console.log(z)
const structs = parseCode(code).structs.filter(
  (s) => s.meta === "struct"
) as AbiStruct[];
const functions = parseCode(code).functions;
functions.forEach((fn) => setActualSizes(fn));
const getFn = (name: string) => functions.find((fn) => fn.name === name);

const printOffsets = (type: AbiType) => {
  const {
    memoryHeadOffset,
    calldataHeadOffset,
    minimumTailOffset,
    calldataHeadSize,
    memoryHeadSize,
    calldataTailSize,
    memoryTailSize,
  } = type;
  const arr = [
    `Head Offset: m=${memoryHeadOffset}, cd=${calldataHeadOffset}`,
    `Head Size: m=${memoryHeadSize}, cd=${calldataHeadSize}`,
  ];
  if (type.meta === "array" || type.meta === "struct") {
    const { memberHeadSizeCalldata, memberHeadSizeMemory } = type;
    arr.push(
      `Member Head Size: m=${memberHeadSizeMemory}, cd=${memberHeadSizeCalldata}`
    );
  }
  arr.push(
    `Min Tail Offset: ${minimumTailOffset}`,
    `Tail Size: m=${memoryTailSize}, cd=${calldataTailSize}`
  );
  return arr;
};
const printField = (field: AbiStructField) => {
  return [
    `${field.name} (${toTypeName(field.type)}):`,
    printOffsets(field.type),
  ];
};
const printStruct = (struct: AbiStruct) => {
  const arr: ArrayJoinInput[] = printOffsets(struct);
  arr.push("");
  for (const field of struct.fields) {
    if (field.type.meta === "struct") {
      arr.push(
        `${struct.name}.${field.name} (${field.type.name}):`,
        printStruct({
          ...field.type,
          name: `${struct.name}.${field.name} (${field.type.name})`,
        })
      );
    } else {
      arr.push(printField(field), "");
    }
  }
  return arr;
};

function printTopLevel(type: AbiStruct | AbiArray) {
  console.log(
    JSON.stringify(
      {
        type: getHighLevelTypeString(type),
        // canCopyHead,
        // canCopyTail,
        size: type.bytes,
        mHeadSize: type.memoryHeadSize,
        cdHeadSize: type.calldataHeadSize,
        mTailSize: type.memoryTailSize,
        cdTailSize: type.calldataTailSize,
        mHeadOffset: type.memoryHeadOffset,
        cdHeadOffset: type.calldataHeadOffset,
        memberHeadMemory: type.memberHeadSizeMemory,
        memberHeadCalldata: type.memberHeadSizeCalldata,
      },
      null,
      2
    )
  );
}

function printInputType(name: string) {
  const basic = getFn(name).input;
  const testType = basic.fields[0].type as AbiStruct;
  // const { canCopyHead, canCopyTail } = testType;
  console.log(arrJoiner(printStruct(testType)));
}

function printArr() {
  const type = getFn("doFixedRefArr").input.fields[0].type as AbiArray;
  console.log(`memberHeadSizeMemory: ${type.memberHeadSizeMemory}`);
  console.log(`memoryHeadSize: ${type.memoryHeadSize}`);
  console.log(`memoryTailSize: ${type.memoryTailSize}`);
  console.log(`base.memoryHeadSize: ${type.baseType.memoryHeadSize}`);
  console.log(`base.memoryTailSize: ${type.baseType.memoryTailSize}`);
}

function makeFixedDecoder() {
  const fn = getFn("doFixedRefArr");
  console.log(`CD HEAD OFF ${fn.input.calldataHeadOffset}` )
  console.log(`CD MEMBER HEAD ${fn.input.memberHeadSizeCalldata}` )
  console.log(`M MEMBER HEAD ${fn.input.memberHeadSizeMemory}` )
  const code = FixedReferenceTypeProcessor.processFunctionInput(fn);
  console.log(arrJoiner(code));
}
makeFixedDecoder()

function printSequence() {
  const basic = getFn("sequence").input;
  const testType = basic.fields[0].type as AbiStruct;
  const types = testType.fields.map((f) => f.type);
  console.log(
    testType.fields
      .map(
        (f) =>
          `${f.name} = ${f.type.calldataHeadOffset} (bytes ${f.type.calldataHeadSize})`
      )
      .join("\n")
  );
  const sequences = getSequentialFromFixedMembers(types);
  for (const arr of sequences) {
    console.log(`SEQUENCE:`);
    console.log(
      arr
        .map(
          (type) =>
            `\t${getHighLevelTypeString(type)} : ${type.calldataHeadOffset}`
        )
        .join("\n")
    );
  }

  console.log(`10 = ${getCopyCost(10)}`);
  console.log(`3 + 1 = ${getCopyCost(3) + getCopyCost(1)}`);
  // const { canCopyHead, canCopyTail } = testType;
  // console.log(arrJoiner(printStruct(testType)));
}
function compareArr() {
  const types = extractTypes(getFn("arr").input.fields) as AbiStruct[];
  /*   const types = extractTypes(getFn("arr").input.fields);
  this.currentCdOffset = i * type.baseType.calldataHeadSize;
  const valueOffset =
    type.memberHeadSizeMemory + i * type.baseType.memoryTailSize; */

  const { calldataHeadSize, memoryTailSize } = types[0];
  for (let i = 0; i < types.length; i++) {
    const expectCdOffset = i * calldataHeadSize;
    const expectMOffset = i * memoryTailSize;
    const cdOffset = types[i].calldataHeadOffset;
    const mOffset = types[i].memoryHeadOffset;
    // types
    console.log(`Expected CD: ${expectCdOffset}, CD: ${cdOffset}`);
    console.log(
      `Expected M: ${expectMOffset}, M: ${mOffset} | Tail Size: ${types[i].memoryTailSize}`
    );

    console.log("");
  }
}
// compareArr();
// printSequence();
// printArr();

// printInputType("doWrap")

// setActualSizes(basic);
// const dynamic = doFixedRefArr.input;

// structs.find((s) => s.name === "BasicType");

// const {
//   calldataHeadOffset,
//   memoryHeadOffset,
//   memberHeadSizeCalldata,
//   calldataHeadSize,
//   calldataTailSize,
//   memberHeadSizeMemory,
//   memoryHeadSize,
//   memoryTailSize,
//   canCopyHead,
//   canCopyTail,
// } = basic;
// console.log(`calldataHeadOffset:, ${calldataHeadOffset}`);
// console.log(`memoryHeadOffset:, ${memoryHeadOffset}`);
// console.log(`memberHeadSizeCalldata:, ${memberHeadSizeCalldata}`);
// console.log(`calldataHeadSize: ${calldataHeadSize}`);
// console.log(`calldataTailSize:, ${calldataTailSize}`);
// console.log(`memberHeadSizeMemory:, ${memberHeadSizeMemory}`);
// console.log(`memoryHeadSize:, ${memoryHeadSize}`);
// console.log(`memoryTailSize:, ${memoryTailSize}`);
// console.log(`canCopyHead: ${canCopyHead}`);
// console.log(`canCopyTail: ${canCopyTail}`);

// getDecodeFunctionFixedArrayFixedTuple(
//   basic.fields[0].type as AbiArray & { baseType: AbiStruct }
// ).then(({ code, constants }) => {
//   console.log(
//     Object.entries(constants)
//       .map(([name, value]) => `uint256 constant ${name} = ${value};`)
//       .join("\n")
//   );
//   console.log(code);
// });

// getDecodeFunctionDynamicArrayFixedTuple(
// basic.fields[0].type as AbiArray & { baseType: AbiStruct }
// ).then(({ code, constants }) => {
// console.log(
//   Object.entries(constants)
//     .map(([name, value]) => `uint256 constant ${name} = ${value};`)
//     .join("\n")
// );
// console.log(code);
// });
