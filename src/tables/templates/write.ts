import { buildAssemblyBlock } from "../../code-gen/codegen-helpers";
import { getMaxUint, toHex } from "../../lib/bytes";
import { withSpaceOrNull } from "../../lib/text";
import { ArrayJoinInput } from "../../types";
import { LibraryGeneratorHelpers } from "../types";

import { toFn } from "./utils";

const applyMaskComment = ({
  valueName,
  size,
}: Partial<LibraryGeneratorHelpers>) => `
  // Apply mask to include only last ${
    size > 1 ? `${size} bytes` : "byte"
  } of \`${valueName}\`,
  // then shift it to the position for the \`key\`.`;

const templatePositionValueForKey = (
  {
    bitsFromRightExpression,
    valueName,
    maskIncludeLast,
    size,
  }: Partial<LibraryGeneratorHelpers>,
  applyMask = false
) =>
  `// Calculate number of bits to the right of position \`key\`
  let bitsFromRight := ${bitsFromRightExpression("key")}
  ${applyMask ? applyMaskComment({ valueName, size }) : null}
  let positioned := shl(bitsFromRight, ${
    applyMask ? `and(${valueName}, ${maskIncludeLast})` : valueName
  })
`;

const templateWriteComment = (valueName: string, safe: boolean) => `
@dev Write \`${valueName}\` to position \`key\` in \`table\`,${withSpaceOrNull(
  safe || "without"
)} overwriting any existing value there.
${withSpaceOrNull(
  safe || "The result will be the inclusive OR of the old and new values."
)}
Note: Does not check for out-of-bounds \`key\`
`;

export function getTableWriteFunction(
  {
    valueName,
    bitsFromRightExpression,
    byteOffsetExpression,
    maskIncludeLast,
    maskExcludeFirst,
    memberType,
    typeName,
    minShiftRef,
    size,
  }: LibraryGeneratorHelpers,
  name: string,
  safe: boolean,
  numSegments: number = 1,
  visibility?: string
) {
  const arrayInput = numSegments !== 1;
  const inputType =
    numSegments === 1 ? typeName : `${typeName}[${numSegments || ""}] memory`;
  const comments = templateWriteComment(valueName, safe).split("\n");

  const asmBlock: ArrayJoinInput[] = [];
  if (numSegments === 1) {
    asmBlock.push(
      templatePositionValueForKey(
        { bitsFromRightExpression, valueName, size, maskIncludeLast },
        true
      ),
      safe && "// Apply mask to remove the existing value for `key`",
      safe && `let cleaned := not(shl(bitsFromRight, ${maskIncludeLast}))`,
      `// Update table with new value and return the result`,
      `updatedTable := or(${
        safe ? `and(table, cleaned)` : `table`
      }, positioned)`
    );
  } else {
    const offset = byteOffsetExpression("key");
    const ptr = numSegments
      ? `add(table, ${offset})`
      : `add(table, add(${offset}, 0x20))`;
    asmBlock.push([
      `// Calculate pointer to position of \`key\` in memory`,
      `let ptr := ${ptr}`,
      `// Shift \`${valueName}\` so that it occupies the first ${size} bytes`,
      `let positioned := shl(${minShiftRef}, ${valueName})`,
      ...(safe
        ? [
            "// Apply mask to remove the existing value for `key`",
            `let cleaned := and(mload(ptr), ${maskExcludeFirst})`,
            `// Update memory with new value`,
            `mstore(ptr, or(cleaned, positioned))`,
          ]
        : [
            `// Update value for \`key\` without overwriting any existing value.`,
            `mstore(ptr, or(mload(ptr), positioned))`,
          ]),
    ]);
  }

  const body = buildAssemblyBlock(asmBlock);
  return toFn(
    name,
    body,
    [`${inputType} table`, `uint256 key`, `${memberType} ${valueName}`],
    arrayInput ? undefined : [`${typeName} updatedTable`],
    comments,
    true,
    visibility
  );
}

export const getForgeTestWriteOneSegment = ({
  typeName,
  elementsPerWord,
  bits,
}: LibraryGeneratorHelpers) =>
  `function testWrite(
  uint256 key,
  uint256 value
) external {
  ${typeName} table = ${typeName}.wrap(type(uint256).max);
  key = key % ${elementsPerWord};
  value = value % ${toHex(+getMaxUint(bits))};
  table = write(table, key, value);
  assertEq(read(table, key), value, "Updated value different from read value");
  ${typeName} tableWithOnlyUpdate = write(Empty${typeName}, key, value);

  assertEq(
    _and(tableWithOnlyUpdate, table),
    tableWithOnlyUpdate,
    "Updated bytes do not match"
  );
  ${typeName} tableWithKeyRemoved = write(table, key, 0);
  assertEq(
    _or(write(tableWithKeyRemoved, key, 0), tableWithOnlyUpdate),
    table
  );
}

function testWriteUnsafe(
  uint256 key,
  uint256 value,
  uint256 value1
) external {
  key = key % ${elementsPerWord};
  value = value % ${toHex(+getMaxUint(bits))};
  value1 = value1 % ${toHex(+getMaxUint(bits))};
  ${typeName} table = write(Empty${typeName}, key, value);
  table = table.writeUnsafe(key, value1);
  assertEq(table.read(key), value | value1);
}`;

export function getForgeTestWriteSegmentArray(
  { typeName, bits, elementsPerWord }: LibraryGeneratorHelpers,
  numSegments: number,
  safe: boolean,
  dynamic?: boolean
) {
  const totalElements = numSegments * elementsPerWord;
  const name = [
    `testWrite`,
    !safe && "Unsafe",
    dynamic ? "Dynamic" : `${numSegments}Segment`,
  ]
    .filter(Boolean)
    .join("");
  const tableDefinition = [
    `${typeName}[`,
    !dynamic && numSegments,
    "] memory table",
    dynamic && ` = new ${typeName}[](${numSegments})`,
    ";",
  ]
    .filter(Boolean)
    .join("");
  const inputs = `uint${bits}[${totalElements}] calldata arr, uint256 key, uint256 value`;
  const segments = new Array(numSegments)
    .fill(null)
    .map((_, i) => `\t\ttable[${i}] = segmentFromCalldata(${i});`)
    .join("\n");
  return `function ${name}(${inputs}) external {
    key = key % ${totalElements};
    value = value % ${toHex(+getMaxUint(bits))};
    ${tableDefinition}
    ${segments}

    table.write${safe ? "" : "Unsafe"}(key, value);
    assertEq(table.read(key), value${safe ? "" : ` | arr[key]`});
  }

`;
}
