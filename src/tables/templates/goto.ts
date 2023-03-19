import { buildAssemblyBlock } from "../../code-gen/codegen-helpers";
import { arrJoiner, wrap } from "../../lib/text";
import { ArrayJoinInput } from "../../types";
import { LibraryGeneratorHelpers } from "../types";

import { toFn } from "./utils";

// const gotoWrapper

const templateJumpTestFunction = (i: number) => `
function fn${i}() internal pure {
  function() internal self = fn${i};
  assembly { mstore(0, add(self, 7)) }
}`;

const JumpTestCode = [
  `
function() internal[] _functions;

constructor() {
  uint256 ptr = rawPtr(fn1);
  assertGt(ptr, positionJD(16, fn1), "Constructor offset not removed");
  _functions[0] = fn0;
  _functions[1] = fn1;
  _functions[2] = fn2;
  _functions[3] = fn3;
  _functions[4] = fn4;
  _functions[5] = fn5;
  _functions[6] = fn6;
  _functions[7] = fn7;
}

function rawPtr(function() internal fn) internal pure returns (uint256 ptr) {
  assembly { ptr := fn }
}

function getExpectedValue(uint256 value) internal pure returns (uint256 value) {
  value = value % 8;
  function() internal fn = _functions[value];
  assembly {
    value := add(fn, 7)
  }
}

// Maps fuzz inputs to internal function pointers by using them
// as overflowing indices into an array of functions.
function getFnForValue(uint256 value) internal pure returns (function() internal fn) {
  value = value % 8;
  fn = _functions[value];
}

function testGoto(uint256[8] calldata values, uint256 key) external {
  JumpTable[8] memory table = createJumpTable(
    getFnForValue(values[0]),
    getFnForValue(values[1]),
    getFnForValue(values[2]),
    getFnForValue(values[3]),
    getFnForValue(values[4]),
    getFnForValue(values[5]),
    getFnForValue(values[6]),
    getFnForValue(values[7])
  );
  table.goto(key);
  uint256 result;
  assembly { result := mload(0) }
  assertEq(result, getExpectedValue(values[key]));
}`,
];

for (let i = 0; i < 8; i++) {
  JumpTestCode.push(templateJumpTestFunction(i));
}

/* const setupFn = [
  `function() internal[] _functions;`,
  `constructor() {
    uint256 ptr = rawPtr(fn1);
    assertGt(ptr, positionJD(16, fn1), "Constructor offset not removed");
    _functions[0] = fn0;
    _functions[1] = fn1;
    _functions[2] = fn2;
    _functions[3] = fn3;
    _functions[4] = fn4;
    _functions[5] = fn5;
    _functions[6] = fn6;
    _functions[7] = fn7;
  }`,
  `
function testGoto(uint256[8] memory values, uint256 key) internal {
  JumpTable[8] memory table = createJumpTable(
    getFnForValue(values[0]),
    getFnForValue(values[1]),
    getFnForValue(values[2]),
    getFnForValue(values[3]),
    getFnForValue(values[4]),
    getFnForValue(values[5]),
    getFnForValue(values[6]),
    getFnForValue(values[7])
  );
  table.goto(key);
  uint256 result;
  assembly { result := mload(0) }
  assertEq(result, getExpectedValue(values[key]));
}
`,
]; */

export function getGotoFunction(
  {
    typeName,
    byteOffsetExpression,
    minShiftRef,
    maskIncludeLast,
    bitsFromRightExpression,
  }: LibraryGeneratorHelpers,
  numSegments?: number,
  visibility?: string,
  optional?: boolean
) {
  const dynamic = !numSegments;
  const comments = [
    `@dev Jump to the function pointer stored at \`key\` in \`table\`${
      optional ? " if one exists" : ""
    }`,
    ...(dynamic
      ? [
          `Note: It is highly recommended that stack inputs or a fixed-size array be used`,
          `instead, as a dynamic array is significantly more expensive to load into memory.`,
        ]
      : []),
    ...(optional
      ? []
      : [
          `Note: Does not check for out-of-bounds \`key\` and will result in an exceptional halt`,
          `(revert consuming all gas) if the value at \`key\` is not a valid function pointer.`,
        ]),
  ];

  const asmBlock: ArrayJoinInput[] = [];
  const inputTypes: string[] = ["uint256 key"];

  if (numSegments === 1) {
    inputTypes.unshift(`${typeName} table`);
    asmBlock.push(
      `let bitsFromRight := ${bitsFromRightExpression("key")}`,
      `fn := and(shr(bitsFromRight, table), ${maskIncludeLast})`
    );
  } else {
    inputTypes.unshift(`${typeName}[${numSegments || ""}] memory table`);
    if (dynamic) {
      asmBlock.push(`let ptr := add(table, 0x20)`);
    }
    const ptr = dynamic ? "ptr" : "table";
    const offset = byteOffsetExpression("key");
    asmBlock.push(`fn := shr(${minShiftRef}, mload(add(${ptr}, ${offset})))`);
  }
  if (optional) {
    asmBlock.push(`exists := gt(fn, 0)`);
  }
  const codeBlock = [
    `function () internal fn;`,
    buildAssemblyBlock(asmBlock),
    optional ? `if (exists) fn();` : `fn();`,
  ];

  return toFn(
    optional ? `gotoIfExists` : `goto`,
    codeBlock,
    // wrap(
    //   buildAssemblyBlock(asmBlock),
    //   `function () internal fn;`,
    //   "fn();",
    //   false,
    //   true
    // ),
    inputTypes,
    optional && ["bool exists"],
    comments,
    false,
    visibility
  );
}

export function getGotoFunctions(
  helpers: LibraryGeneratorHelpers,
  numSegments?: number,
  visibility?: string
) {
  return [
    ...getGotoFunction(helpers, numSegments, visibility, false),
    ...getGotoFunction(helpers, numSegments, visibility, true),
  ];
}

export function getForgeTestJumpTableCode(helpers: LibraryGeneratorHelpers) {
  const importPath =
    helpers.context.getImportPathFromTest("JumpTable.sol") ||
    "../src/JumpTable.sol";
  const header = [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity >=0.8.17;`,
    `import "forge-std/Test.sol";`,
    "",
    `import "${importPath}";`,
    "",
  ];
  const contractBody: ArrayJoinInput[] = [
    `using MultiPartJumpTable for *;`,
    "",
    JumpTestCode,
  ];
  return arrJoiner([
    ...header,
    wrap(
      contractBody,
      `contract TestJumpTable is Test {`,
      "}",
      true,
      true,
      true
    ),
  ]);
}

export function getForgeTestGoto() {}
