import { toHex } from "../../lib/bytes";
import { arrJoiner, wrap } from "../../lib/text";
import { ArrayJoinInput } from "../../types";
import { LibraryGeneratorHelpers } from "../types";

import { getForgeTestCreateTable } from "./create";
import { getForgeTestJumpTableCode } from "./goto";
import { getForgeTestReadSegmentArray } from "./read";
import {
  getForgeTestWriteOneSegment,
  getForgeTestWriteSegmentArray,
} from "./write";

const getTestHelperFunctions = ({
  typeName,
  elementsPerWord,
  bits,
  memberType,
}: LibraryGeneratorHelpers) =>
  `function assertEq(${typeName} a, ${typeName} b) internal {
  assertEq(${typeName}.unwrap(a), ${typeName}.unwrap(b));
}

function assertEq(${typeName} a, ${typeName} b, string memory err) internal {
  assertEq(${typeName}.unwrap(a), ${typeName}.unwrap(b), err);
}

function _and(${typeName} a, ${typeName} b) internal pure returns (${typeName} c) {
  assembly {
    c := and(a, b)
  }
}

function _or(${typeName} a, ${typeName} b) internal pure returns (${typeName} c) {
  assembly {
    c := or(a, b)
  }
}


function _concat(${typeName} a, ${typeName} b) internal pure returns (${typeName} c) {
  assembly {
    c := or(shl(128, a), b)
  }
}

function validate(
  uint${bits}[] calldata source,
  ${typeName} table,
  uint256 size
) internal {
  for (uint256 i = 0; i < size; i++) {
    assertEq(read(table, i), uint256(source[i]));
  }
}

function validate(
  uint${bits}[] calldata source,
  ${typeName}[] memory table,
  uint256 size
) internal {
  for (uint256 i = 0; i < size; i++) {
    assertEq(table.read(i), uint256(source[i]));
  }
}

${new Array(Math.ceil(256 / elementsPerWord) - 1)
  .fill(null)
  .map(
    (_, i) =>
      `function validate(
  uint${bits}[${(i + 2) * elementsPerWord}] calldata source,
  ${typeName}[${i + 2}] memory table
) internal {
  for (uint256 i = 0; i < ${(i + 2) * elementsPerWord}; i++) {
    assertEq(table.read(i), uint256(source[i]));
  }
}
`
  )
  .join("")}
  

function fakeCalldataArray(uint256 size)
  internal
  pure
  returns (uint${bits}[] calldata _inputArr)
{
  assembly {
    _inputArr.offset := 4
    _inputArr.length := size
  }
}

function segmentFromCalldata(uint256 segmentIndex) internal pure returns (${typeName} tableSegment) {
  {
    ${memberType}[${elementsPerWord}] calldata _inputArr;
    assembly {
      _inputArr := add(4, mul(segmentIndex, ${toHex(32 * elementsPerWord)}))
    }
    ${memberType}[${elementsPerWord}] memory arr = _inputArr;
    tableSegment = create${typeName}(arr);
  }
}`;

export function getForgeTableTest(helpers: LibraryGeneratorHelpers) {
  const { typeName, elementsPerWord, bits, isLookup, context } = helpers;
  const importPath =
    context.getImportPathFromTest(`${typeName}.sol`) ||
    `../src/${typeName}.sol`;
  if (!isLookup) return getForgeTestJumpTableCode(helpers);
  const _uint = `uint${bits}`;
  const header = [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity >=0.8.17;`,
    `import "forge-std/Test.sol";`,
    "",
    `import "${importPath}";`,
    "",
  ];
  const contractBody: ArrayJoinInput[] = [
    `using MultiPart${typeName} for *;`,
    "",
    getTestHelperFunctions(helpers),
    getForgeTestWriteOneSegment(helpers),
  ];

  for (let numElements = 2; numElements <= elementsPerWord; ++numElements) {
    const elements = new Array(numElements)
      .fill(null)
      .map((_, i) => `member${i}`);
    const inputs = elements.map((elem) => `${_uint} ${elem}`);
    contractBody.push(getForgeTestCreateTable(helpers, inputs));
  }
  const segmentsFor256Elements = Math.ceil(256 / elementsPerWord);
  const [writeFns, unsafeWriteFns, readFns] = [
    [],
    [],
    [],
  ] as ArrayJoinInput[][];
  for (let i = 2; i <= segmentsFor256Elements; i++) {
    writeFns.push(getForgeTestWriteSegmentArray(helpers, i, true));
    unsafeWriteFns.push(getForgeTestWriteSegmentArray(helpers, i, false));
    readFns.push(getForgeTestReadSegmentArray(helpers, i));
  }
  writeFns.push(
    getForgeTestWriteSegmentArray(helpers, segmentsFor256Elements, true, true)
  );
  unsafeWriteFns.push(
    getForgeTestWriteSegmentArray(helpers, segmentsFor256Elements, false, true)
  );
  readFns.push(
    getForgeTestReadSegmentArray(helpers, segmentsFor256Elements, true)
  );
  contractBody.push(...writeFns, ...unsafeWriteFns, ...readFns);
  return arrJoiner([
    ...header,
    wrap(
      contractBody,
      `contract Test${typeName} is Test {`,
      `}`,
      true,
      true,
      true
    ),
  ]);
}
