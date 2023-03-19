import { buildAssemblyBlock } from "../code-gen/codegen-helpers";
import { getInclusionMask, toHex } from "../lib/bytes";
import { ArrayJoinInput } from "../types";

import { ExternalJumpTableHelpers } from "./types";

const loadSegmentsFromImmutables = ({
  numSegments,
  segments,
}: ExternalJumpTableHelpers) =>
  numSegments === 1
    ? ["uint256 lookupTable = LookupTable;"]
    : segments.map(({ name }, i) => `uint256 tableSegment${i} = ${name};`);

const getMemberMask = ({
  context,
  bitsPerMember,
}: ExternalJumpTableHelpers) => {
  return context.addConstant(
    "IncludeLastMemberMask",
    getInclusionMask(bitsPerMember)
  );
};

export function getReadFromCustomTable(
  helpers: ExternalJumpTableHelpers,
  keyExpression: string,
  assignTo: string
): ArrayJoinInput {
  const { context, numSegments, bitsPerMember, memberBytes } = helpers;

  const loadExpressions = loadSegmentsFromImmutables(helpers);
  const mask = getMemberMask(helpers);
  const code: ArrayJoinInput<string> = [];
  const asmBlock: ArrayJoinInput<string> = [];
  code.push(...loadExpressions);
  const size = numSegments;
  const comments = [];
  if (size === 1) {
    const bitsRef = context.addConstant(`BitsPerMember`, toHex(bitsPerMember));
    // If table is 1 word, we can lookup on the stack
    asmBlock.push(
      `${assignTo} := and(${mask}, shr(mul(${bitsRef}, ${keyExpression}), lookupTable))`
    );
    comments.push(
      `Lookup table only uses one word, so lookups are done on the stack.`
    );
  } else {
    const shiftSize = toHex(256 - bitsPerMember);
    const shiftSizeRef = context.addConstant(`BitsAfterMember`, shiftSize);
    const repairFreeMemoryPtr = [3, 4].includes(size);
    const repairZeroSlot = size === 4;

    const memoryPointers = new Array(size).fill(null).map((_, i) => {
      const offset = toHex(i * 32);
      const offsetRef = context.addConstant(
        `LookupTableSegment${i}${size <= 4 ? "Pointer" : "Offset"}`,
        offset
      );
      return size <= 4 ? offsetRef : `add(ptr, ${offsetRef})`;
    });

    const freeMemPointerRef = context.addConstant(
      `FreeMemoryPointer`,
      toHex(64)
    );
    const zeroSlotRef = context.addConstant(`ZeroSlot`, toHex(96));

    if (repairFreeMemoryPtr) {
      asmBlock.push(`let freeMemPointer := mload(${freeMemPointerRef})`);
    } else if (size > 4) {
      asmBlock.push(`let ptr := mload(${freeMemPointerRef})`);
    }

    for (let i = 0; i < size; i++) {
      asmBlock.push(`mstore(${memoryPointers[i]}, tableSegment${i})`);
    }

    const memberBytesRef = context.addConstant(
      `BytesPerMember`,
      toHex(memberBytes)
    );

    const getBytesOffset = `mul(${memberBytesRef}, ${keyExpression})`;

    if (size > 4) {
      asmBlock.push(
        `${assignTo} := shr(${shiftSizeRef}, mload(add(ptr, ${getBytesOffset})))`
      );
    } else {
      asmBlock.push(
        `${assignTo} := shr(${shiftSizeRef}, mload(${getBytesOffset}))`
      );
    }
    if (repairFreeMemoryPtr)
      asmBlock.push(`mstore(${freeMemPointerRef}, freeMemPointer)`);
    if (repairZeroSlot) asmBlock.push(`mstore(${zeroSlotRef}, 0)`);
  }
  code.push(...(buildAssemblyBlock(asmBlock) as any));
  return code;
}
