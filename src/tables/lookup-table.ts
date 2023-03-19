import { ArrayJoinInput } from "../types";
import { buildAssemblyBlock } from "../code-gen/codegen-helpers";
import { FileContext } from "../code-gen/context";
import { getInclusionMask, toHex } from "../lib/bytes";

import { LookupTableMember } from "./types";

export class LookupTable {
  tableSegmentNames: string[];
  // Immutable definitions
  tableSegmentDefinitions: string[];
  // Immutable assignment in constructor
  tableSegmentAssignments: ArrayJoinInput<string>;

  constructor(
    public members: LookupTableMember[],
    public memberBytes: number,
    public context: FileContext
  ) {
    const segmentChunks: string[][] = new Array(this.numTableSegments)
      .fill(null)
      .map(() => []);
    const numSegments = segmentChunks.length;

    /*
      If table only has one segment, members are stored right to left
      to remove an operation from the read expression
      */
    // const comment =
    members = [...members].sort((a, b) => a.position - b.position);
    for (const member of members) {
      const segmentIndex = Math.floor(member.position / this.membersPerWord);
      const positionInWord = member.position % this.membersPerWord;
      const offsetBits = positionInWord * this.bitsPerMember;
      const shiftBits =
        numSegments === 1
          ? offsetBits
          : 256 - (offsetBits + this.bitsPerMember);
      const expression = shiftBits
        ? `(${member.value} << ${shiftBits})`
        : member.value;
      segmentChunks[segmentIndex].push(expression);
    }

    this.tableSegmentNames = [];
    this.tableSegmentDefinitions = [];
    this.tableSegmentAssignments = [];

    for (let i = 0; i < segmentChunks.length; i++) {
      const segmentMembers = segmentChunks[i];
      const name = numSegments === 1 ? `LookupTable` : `LookupTableSegment${i}`;
      this.tableSegmentNames.push(name);
      this.tableSegmentDefinitions.push(`uint256 immutable ${name};`);
      this.tableSegmentAssignments.push(
        `${name} = ${segmentMembers.join("|")};`
      );
    }
  }

  loadSegmentsFromImmutables = () =>
    this.numTableSegments === 1
      ? ["uint256 lookupTable = LookupTable;"]
      : this.tableSegmentNames.map(
          (name, i) => `uint256 tableSegment${i} = ${name};`
        );

  getMemberMask = () => getInclusionMask(this.bitsPerMember);

  readFromTable(keyExpression: string, assignTo: string): ArrayJoinInput {
    const loadExpressions = this.loadSegmentsFromImmutables();
    const mask = this.getMemberMask();
    const code: ArrayJoinInput<string> = [];
    const asmBlock: ArrayJoinInput<string> = [];
    code.push(...loadExpressions);
    const size = this.numTableSegments;
    const comments = [];
    if (size === 1) {
      const bitsRef = this.context.addConstant(
        `BitsPerMember`,
        toHex(this.bitsPerMember)
      );
      // If table is 1 word, we can lookup on the stack
      asmBlock.push(
        `${assignTo} := and(${mask}, shr(mul(${bitsRef}, ${keyExpression}), lookupTable))`
      );
      comments.push(
        `Lookup table only uses one word, so lookups are done on the stack.`
      );
    } else {
      const shiftSize = toHex(256 - this.bitsPerMember);
      const shiftSizeRef = this.context.addConstant(
        `BitsAfterMember`,
        shiftSize
      );
      const repairFreeMemoryPtr = [3, 4].includes(size);
      const repairZeroSlot = size === 4;

      const memoryPointers = new Array(size).fill(null).map((_, i) => {
        const offset = toHex(i * 32);
        const offsetRef = this.context.addConstant(
          `LookupTableSegment${i}${size <= 4 ? "Pointer" : "Offset"}`,
          offset
        );
        return size <= 4 ? offsetRef : `add(ptr, ${offsetRef})`;
      });

      const freeMemPointerRef = this.context.addConstant(
        `FreeMemoryPointer`,
        toHex(64)
      );
      const zeroSlotRef = this.context.addConstant(`ZeroSlot`, toHex(96));

      if (repairFreeMemoryPtr) {
        asmBlock.push(`let freeMemPointer := mload(${freeMemPointerRef})`);
      } else if (size > 4) {
        asmBlock.push(`let ptr := mload(${freeMemPointerRef})`);
      }

      for (let i = 0; i < size; i++) {
        asmBlock.push(`mstore(${memoryPointers[i]}, tableSegment${i})`);
      }

      const memberBytesRef = this.context.addConstant(
        `BytesPerMember`,
        toHex(this.memberBytes)
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

  get bitsPerMember() {
    return this.memberBytes * 8;
  }

  get membersPerWord() {
    return Math.floor(32 / this.memberBytes);
  }

  get numTableSegments() {
    return (
      1 +
      Math.floor(
        Math.max(...this.members.map((m) => m.position)) / this.membersPerWord
      )
    );
  }
}
