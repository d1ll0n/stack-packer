import {
  AbiArray,
  AbiStruct,
  AbiStructField,
  AbiType,
  ArrayJoinInput,
} from "../types";
import { extractTypes, getCopyCost, setActualSizes } from "./type-check";
import { parseCode } from "../parser";
// import { getDecodeFunctionFixedArrayFixedTuple } from "../templates/abi-decode/fixed-arr-fixed-ref";
import _, { takeWhile } from "lodash";
import { arrJoiner } from "../lib/text";
import { BuiltinFunctionIds } from "../ast-rewriter/yul/builtin";
import { combineSequentialCopies } from "../templates/d/utils";
import { Copier } from "../templates/d/Copiers";
import { FixedReferenceTypeProcessor } from "../templates/abi-decode/fixed-ref";
import { getDecodeFunctionDynamicArrayFixedTuple } from "../templates/abi-decode/dyn-arr-fixed-ref";
import { getHighLevelTypeString, toTypeName } from "./names";
import { getSequentialFromFixedMembers } from "../templates/abi-decode/utils";
import {
  makeYulIdentifier,
  makeYulLiteral,
  YulAssignment,
  YulBlock,
  YulExpression,
  YulFunctionCall,
  YulVariableDeclaration,
} from "../ast-rewriter/yul";
import { PrettyFormatter } from "solc-typed-ast";
import { yulToStringExpression } from "../ast-rewriter/yul/mathjs";

const code = `
enum OrderType {
    // 0: no partial fills, anyone can execute
    FULL_OPEN,

    // 1: partial fills supported, anyone can execute
    PARTIAL_OPEN,

    // 2: no partial fills, only offerer or zone can execute
    FULL_RESTRICTED,

    // 3: partial fills supported, only offerer or zone can execute
    PARTIAL_RESTRICTED,

    // 4: contract order type
    CONTRACT
}

enum ItemType {
    // 0: ETH on mainnet, MATIC on polygon, etc.
    NATIVE,

    // 1: ERC20 items (ERC777 and ERC20 analogues could also technically work)
    ERC20,

    // 2: ERC721 items
    ERC721,

    // 3: ERC1155 items
    ERC1155,

    // 4: ERC721 items where a number of tokenIds are supported
    ERC721_WITH_CRITERIA,

    // 5: ERC1155 items where a number of ids are supported
    ERC1155_WITH_CRITERIA
}

struct OfferItem {
    ItemType itemType;
    address token;
    uint256 identifierOrCriteria;
    uint256 startAmount;
    uint256 endAmount;
}

struct ConsiderationItem {
    ItemType itemType;
    address token;
    uint256 identifierOrCriteria;
    uint256 startAmount;
    uint256 endAmount;
    address payable recipient;
}

struct OrderParameters {
  address offerer; // 0x00
  address zone; // 0x20
  OfferItem[3] offer; // 0x40
  ConsiderationItem[3] consideration; // 0x60
  OrderType orderType; // 0x80
  uint256 startTime; // 0xa0
  uint256 endTime; // 0xc0
  bytes32 zoneHash; // 0xe0
  uint256 salt; // 0x100
  bytes32 conduitKey; // 0x120
  uint256 totalOriginalConsiderationItems; // 0x140
}

function execute(OrderParameters calldata order) pure {}
`;

type TypeParserConstant = {
  referencedType: AbiType;
  // kind: "cd_offset" | "m_offset_tail"
  name: string;
};

type StructParser = {
  /** @property { [field]: TypeParserConstant } constants */
  constants: Record<string, TypeParserConstant>;
  /** Number of top-level members that contain nested reference types */
  membersWithNestedReferences: number;
  /** Total recursive steps required to derive the size */
  recursiveStepsToDeriveSize: number;

  /**
   * Method to derive the pointer to the data section of the type.
   * For a struct or fixed-length array, this is the pointer to the first head element in the struct.
   * For a dynamic-length array or `bytes`, this is the pointer to the length.
   */
  getDataPtrExpression: (
    ctx: Copier,
    parentPtr?: YulExpression
  ) => YulExpression;
};

const { functions, structs } = parseCode(code);
functions.forEach((fn) => setActualSizes(fn));
structs.forEach((s) => setActualSizes(s));
const getFn = (name: string) => functions.find((fn) => fn.name === name);
const getStruct = (name: string) =>
  (structs as AbiStruct[]).find((s) => s.name === name);

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

async function makeFixedDecoder() {
  const fn = getFn("execute");
  const type = getStruct("OrderParameters");

  const { fnCode, functionAST, decoder } =
    await FixedReferenceTypeProcessor.processFunctionInput(fn);
  console.log(fnCode);
  // const ptr = makeYulIdentifier("ptr");
  // const cdPtr = makeYulIdentifier("cdptr");
  // const yulCopies = decoder.copies.map((copy) => ({
  //   dst: ptr.smartAdd(copy.dst),
  //   src: cdPtr.smartAdd(copy.src),
  //   size: makeYulLiteral(copy.size),
  //   names: [...copy.names],
  // }));
  // console.log(
  //   fnCode
  //     .split("\n")
  //     .filter((ln) => ln.includes("calldatacopy"))
  //     .map((ln) => ln.trim())
  //     .join("\n")
  // );
  // const combined = combineSequentialCopies(yulCopies);
  // combined.forEach((copy) => {
  //   console.log(
  //     yulToStringExpression(
  //       new YulFunctionCall(BuiltinFunctionIds.calldatacopy, [
  //         copy.dst,
  //         copy.src,
  //         copy.size,
  //       ])
  //     )
  //   );
  // });

  const block = new YulBlock();
  FixedReferenceTypeProcessor.getAST(
    block,
    type,
    `order`,
    true,
    makeYulIdentifier("cdPtr1"),
    makeYulIdentifier("mPtrX").add(makeYulLiteral(10))
  );
  // block.appendChild(
  // new YulVariableDeclaration([makeYulIdentifier("a")], makeYulLiteral("5"))
  // );
  console.log(block.write(new PrettyFormatter(2)));
}
// makeFixedDecoder();

console.log(
  arrJoiner([
    `function copy_dyn_bytes_array(cdPtrLength) -> mPtrLength {`,
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
  ])
);

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
