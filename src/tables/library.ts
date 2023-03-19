import { FileContext, GeneratorOptions } from "../code-gen/context";
import { numberToPascalCaseWords } from "../lib/text";
import { toHex } from "../lib/bytes";
import { toNatspec } from "../code-gen/comments";

import {
  getCreateTableFunction,
  getForgeTableTest,
  getGotoFunctions,
  getTableReadFunction,
  getTableWriteFunction,
} from "./templates";
import { LibraryGeneratorHelpers } from "./types";

const getConstantsAndHelpers = (
  context: FileContext,
  size: number,
  type: "Lookup" | "Jump"
): LibraryGeneratorHelpers => {
  const elementsPerWord = Math.floor(32 / size);
  const numberString = numberToPascalCaseWords(size);
  const byteStringForName = `${numberString}Byte`;
  const byteStringForConstants = size === 1 ? "Byte" : byteStringForName;
  const isLookup = type === "Lookup";
  const [typeName, memberType, valueName] = isLookup
    ? [`${byteStringForName}LookupTable`, "uint256", "value"]
    : ["JumpTable", "function() internal", "fn"];

  const bits = size * 8;

  const segmentsFor256Elements = Math.ceil(256 / elementsPerWord);

  const suffix = isLookup
    ? `${byteStringForConstants}${size > 1 ? "s" : ""}`
    : `JumpDest`;
  const bitsRef = context.addConstant(`BitsIn${suffix}`, toHex(bits));
  const maskIncludeFirst = context.addConstant(
    `MaskIncludeFirst${suffix}`,
    `0x${"ff".repeat(size).padEnd(64, "0")}`
  );
  const maskIncludeLast = context.addConstant(
    `MaskIncludeLast${suffix}`,
    `0x${"ff".repeat(size)}`
  );

  const maskExcludeFirst = context.addConstant(
    `MaskExcludeFirst${suffix}`,
    `0x${"00".repeat(size).padEnd(64, "f")}`
  );

  const minShiftRef = context.addConstant(
    isLookup ? `WordMinus${suffix}` : `BitsAfterJumpDest`,
    toHex(256 - bits)
  );
  const bitsFromRightExpression = (key: string) =>
    `sub(${minShiftRef}, mul(${bitsRef}, ${key}))`;

  const byteOffsetExpression = (key: string) =>
    size === 1 ? key : `mul(${key}, ${toHex(size)})`;

  return {
    context,
    isLookup,
    positionRef: `position${isLookup ? `LT${size}` : "JD"}`,
    elementsPerWord,
    segmentsFor256Elements,
    type,
    size,
    bits,
    typeName,
    memberType,
    valueName,
    numberString,
    byteString: suffix,
    bitsRef,
    maskIncludeFirst,
    maskIncludeLast,
    maskExcludeFirst,
    minShiftRef,
    bitsFromRightExpression,
    byteOffsetExpression,
  };
};

export const createLookupTableLibrary = (
  size: number,
  type: "Lookup" | "Jump" = "Lookup",
  opts: GeneratorOptions = {}
) => {
  const allowMultipart = !((32 / size) % 1);
  if (!allowMultipart) {
    console.log(
      `Multi-segment tables for element sizes that don't divide a word is currently unsupported.`
    );
  }
  const context = new FileContext(opts);
  const helpers = getConstantsAndHelpers(context, size, type);

  const {
    isLookup,
    positionRef,
    valueName,
    typeName,
    memberType,
    bitsFromRightExpression,
    maskIncludeLast,
    elementsPerWord,
  } = helpers;
  if (!isLookup && size !== 2) {
    throw Error(`Jump table must use two byte members.`);
  }

  context.addSection("type", `Basic type utils`);
  context.addSection("write-stack", "Write to table on the stack");
  context.addSection("write-array", "Update a table in memory");
  context.addSection(
    "read-stack",
    `${isLookup ? "Read" : "Jump"} from table on the stack`
  );
  context.addSection("create-array", "Create table from an array");
  context.addSection("create-stack", "Create table from stack inputs");

  const getReadFunction = isLookup ? getTableReadFunction : getGotoFunctions;
  context.sectionPush("read-stack", getReadFunction(helpers, 1));

  context.sectionPush(
    "type",
    `type ${typeName} is uint256;

${typeName} constant Empty${typeName} = ${typeName}.wrap(0);

function to${typeName}(uint256 _table) pure returns(${typeName} table) {
  assembly {
    table := _table
  }
}

/**
 * @dev Shift \`${valueName}\` to the position occupied by \`key\` in a sequence
 * of ${size} byte values.
 */
function ${positionRef}(uint256 key, ${memberType} ${valueName}) pure returns(uint256 positioned) {
  assembly {
    // Calculate number of bits to the right of position \`key\`
    let bitsFromRight := ${bitsFromRightExpression("key")}
    // Apply mask to include only last ${size} bytes of \`${valueName}\`
    // then shift it to the position for the \`key\`.
    positioned := shl(bitsFromRight, and(${valueName}, ${maskIncludeLast}))
  }
}`
  );

  context.sectionPush("write-stack", [
    ...getTableWriteFunction(helpers, `write`, true),
    "",
    ...getTableWriteFunction(helpers, `writeUnsafe`, false),
  ]);

  const segmentsFor256Elements = Math.ceil(256 / elementsPerWord);

  /*
  This seems unnecessary, as the fixed-size array from the stack is
  roughly equivalent in cost (when optimized with viaIR)
  const segmentedReadFunctions: ArrayJoinInput[] = [];
  for (let i = 2; i < 14; i++) {
    segmentedReadFunctions.push(...getSectionedRead(helpers, i), "");
  }
  context.sectionPush("read-multipart", segmentedReadFunctions);
  */
  for (let i = 1; i <= elementsPerWord; i++) {
    context.sectionPush("create-stack", [
      ...getCreateTableFunction(helpers, i, false, false),
      "",
    ]);
  }
  if (allowMultipart) {
    for (let i = 2; i <= elementsPerWord; i++) {
      context.sectionPush("create-array", [
        ...getCreateTableFunction(helpers, i, false, true),
        "",
      ]);
    }

    const readFn = isLookup ? getTableReadFunction : getGotoFunctions;

    for (let i = 2; i <= segmentsFor256Elements; i++) {
      context.sectionPush("read-array", readFn(helpers, i, "internal"));
      context.sectionPush("write-array", [
        ...getTableWriteFunction(helpers, "write", true, i, "internal"),
        "",
        ...getTableWriteFunction(helpers, "writeUnsafe", false, i, "internal"),
      ]);
    }
    context.sectionPush("read-array", readFn(helpers, undefined, "internal"));
    context.sectionPush(
      "write-array",
      getTableWriteFunction(helpers, "write", true, 0, "internal")
    );
    context.sectionPush(
      "write-array",
      getTableWriteFunction(helpers, "writeUnsafe", false, 0, "internal")
    );
    context.sectionPush("array-library", [
      ...toNatspec([
        `@dev These functions are separated into a library so that they can work with`,
        `the "using for" syntax, which does not support overloaded function names or`,
        `arrays of custom user types at a global level.`,
      ]),
      `library MultiPart${typeName} {`,
      context.combineSections(["read-array", "write-array"]),
      "}",
    ]);
  }

  const code = [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity >=0.8.17;`,
    "",
    ...context.combineSections([
      "constants",
      "type",
      "write-stack",
      "read-stack",
      "create-stack",
      "create-array",
      "array-library",
    ]),
    "",
    `using { ${
      isLookup ? "read" : "goto, gotoIfExists"
    }, write, writeUnsafe } for ${typeName} global;`,
  ];

  let forgeTest = getForgeTableTest(helpers);
  if (!context.opts.disableMemorySafe) {
    forgeTest = forgeTest.replace(/assembly {/g, `assembly ("memory-safe") {`);
  }

  return {
    name: typeName,
    code,
    helpers,
    forgeTest,
  };
};
