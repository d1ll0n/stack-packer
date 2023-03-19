import { buildAssemblyBlock } from "../../code-gen/codegen-helpers";
import { ArrayJoinInput } from "../../types";
import { LibraryGeneratorHelpers } from "../types";

import { toFn } from "./utils";

export function getTableReadFunction(
  {
    typeName,
    byteOffsetExpression,
    bitsFromRightExpression,
    maskIncludeLast,
    minShiftRef,
    memberType,
    valueName,
  }: LibraryGeneratorHelpers,
  numSegments?: number,
  visibility?: string
) {
  const dynamic = !numSegments;
  const comments = dynamic
    ? [
        `@dev Performs lookup on a dynamically sized table`,
        `Note: It is highly recommended that stack inputs or a fixed-size array be used`,
        `instead, as a dynamic array is significantly more expensive to load into memory`,
        `Note: Does not check for out-of-bounds \`key\``,
      ]
    : [
        `@dev Performs lookup on a table with ${numSegments} segments.`,
        `Note: Does not check for out-of-bounds \`key\``,
      ];

  const asmBlock: ArrayJoinInput[] = [];
  const inputTypes: string[] = ["uint256 key"];

  if (numSegments === 1) {
    inputTypes.unshift(`${typeName} table`);
    asmBlock.push(
      `let bitsFromRight := ${bitsFromRightExpression("key")}`,
      `${valueName} := and(shr(bitsFromRight, table), ${maskIncludeLast})`
    );
  } else {
    inputTypes.unshift(`${typeName}[${numSegments || ""}] memory table`);
    if (dynamic) {
      asmBlock.push(`let ptr := add(table, 0x20)`);
    }
    const ptr = dynamic ? "ptr" : "table";
    const offset = byteOffsetExpression("key");
    asmBlock.push(
      `${valueName} := shr(${minShiftRef}, mload(add(${ptr}, ${offset})))`
    );
  }

  return toFn(
    `read`,
    buildAssemblyBlock(asmBlock),
    inputTypes,
    [`${memberType} ${valueName}`],
    comments,
    true,
    visibility
  );
}

export const getForgeTestReadSegmentArray = (
  { typeName, bits, elementsPerWord }: LibraryGeneratorHelpers,
  numSegments: number,
  dynamic?: boolean
) => {
  const totalElements = numSegments * elementsPerWord;
  const segments = new Array(numSegments)
    .fill(null)
    .map(
      (_, i) =>
        (dynamic ? `table[${i}] = ` : "") +
        `segmentFromCalldata(${i})` +
        (dynamic ? ";" : "")
    );

  const name = `testRead`.concat(dynamic ? "Dynamic" : `${numSegments}Part`);
  const inputArg = `uint${bits}[${totalElements}] calldata arr`;
  const tableDefinition = [
    typeName,
    "[",
    !dynamic && numSegments,
    "] memory table",
    dynamic && ` = new ${typeName}[](${numSegments})`,
    ";",
  ]
    .filter(Boolean)
    .join("");
  const body: ArrayJoinInput[] = [tableDefinition];
  if (dynamic) {
    body.push(...segments);
  }
  const validateArgs = dynamic
    ? `fakeCalldataArray(${totalElements}), table, ${totalElements}`
    : `arr, [${segments.join(",")}]`;

  body.push(`validate(${validateArgs});`);
  return [`function ${name}(${inputArg}) external {`, body, "}"];
};
