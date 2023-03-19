import { AbiFunction } from "../types";
import { FileContext } from "../code-gen/context";
import { findMagicModulus, getBitsBetween } from "../lib/magic-modulus";
import { toHex } from "../lib/bytes";

import {
  ExternalJumpTableHelpers,
  LookupTableMember,
  LookupTableSegment,
  SelectorOptions,
  SelectorType,
} from "./types";
import { getPointerFunctionName } from "./templates";

export const getReadSelectorExpression = (
  context: FileContext,
  opts: SelectorType
): string => {
  const shiftBits = 256 - opts.bits;
  const shiftRef = context.addConstant(`BitsAfterSelector`, toHex(shiftBits));
  const startRef =
    opts.startIndex > 0
      ? context.addConstant(`SelectorSliceFromIndex`, toHex(opts.startIndex))
      : "0";

  let expression = `shr(${shiftRef}, calldataload(${startRef}))`;
  if (opts.modulus) {
    const modRef = context.addConstant(
      `SelectorMagicModulus`,
      toHex(opts.modulus)
    );
    expression = `mod(${expression}, ${modRef})`;
  }
  return expression;
};

export const externalFunctionInternalPrefix = `extfn_`;

export const getSelectorLookupTableMembers = (
  fns: AbiFunction[],
  selectors: string[],
  selectorType: SelectorType,
  type: "ptrFn" | "none" = "ptrFn"
): LookupTableMember[] => {
  const positions = getSelectorPositions(selectors, selectorType);
  const members: LookupTableMember[] = selectors.map((selector, i) => {
    const fn = fns[i];
    const name = fn.name;
    const externalName = fn.stateVariable?.name || name;
    return {
      position: positions[selector],
      value: type === "ptrFn" ? `${getPointerFunctionName}(${name})` : name,
      name: externalName,
    };
  });
  return members;
};

export const getSelectorSlices = (
  selectorStrings: string[],
  options: SelectorType
) =>
  selectorStrings.map((selector, i) =>
    options.type === "index"
      ? i
      : getBitsBetween(
          parseInt(selector, 16),
          options.startIndex * 8,
          options.bits
        )
  );

export const getSelectorPositions = (
  selectorStrings: string[],
  options: SelectorType
): Record<string, number> => {
  return selectorStrings
    .map((selector, i) =>
      options.type === "index"
        ? i
        : getBitsBetween(
            parseInt(selector, 16),
            options.startIndex * 8,
            options.bits
          ) % options.modulus
    )
    .reduce(
      (positions, position, i) => ({
        ...positions,
        [selectorStrings[i]]: position,
      }),
      {}
    );
};

export const getSelectorType = (
  selectors: string[],
  options?: SelectorOptions
): SelectorType => {
  const type = options?.type || "index";

  const selectorType: SelectorType = {
    type: options.type,
    startIndex: 0,
    bits: 32,
  };
  if (type === "magic") {
    Object.assign(selectorType, findMagicModulus(selectors, options));
  } else {
    selectorType.bits = Math.ceil(Math.log2(selectors.length));
  }
  return selectorType;
};

export function getLookupTableSegments(
  helpers: Partial<ExternalJumpTableHelpers>,
  getPositionMemberExpression: (
    positionInWord: number,
    member: string,
    numSegments: number
  ) => string
): LookupTableSegment[] {
  const { members, withLibrary } = helpers;
  const segmentTypeName = withLibrary ? `JumpTable` : "uint256";
  const numTableSegments =
    1 + Math.floor(Math.max(...members.map((m) => m.position)) / 16);
  const segmentChunks: LookupTableSegment[] = new Array(numTableSegments)
    .fill(null)
    .map((_, i) => {
      const name = numTableSegments === 1 ? "table" : `segment${i}`;
      return {
        members: [],
        name,
        definition: `${segmentTypeName} internal immutable ${name};`,
      };
    });

  for (const member of members) {
    const segmentIndex = Math.floor(member.position / 16);
    const positionInWord = member.position % 16;

    segmentChunks[segmentIndex].members.push({
      positionInWord,
      expression: getPositionMemberExpression(
        positionInWord,
        member.value,
        numTableSegments
      ),
      ...member,
    });
    segmentChunks[segmentIndex].members.sort(
      (a, b) => a.positionInWord - b.positionInWord
    );
  }

  return segmentChunks;
}
