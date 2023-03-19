import { FileContext } from "../../code-gen/context";
import { ArrayJoinInput } from "../../types";
import { getReadSelectorExpression } from "../selectors";
import { SelectorType } from "../types";

export const getMagicModulusNatspec = ({
  startIndex,
  bits,
  modulus,
}: SelectorType) => {
  const startBit = startIndex * 8;
  return [
    `The "magic" modulus ${modulus} is used to reduce each 4 byte function selector to something that can`,
    `be used as an offset into a jump table with a reasonable size in memory.`,
    ...(startIndex > 0 || bits < 32
      ? [
          `Only bits ${startBit} to ${
            bits + startBit
          } of the selector are used, as this results in the smallest modulus`,
          `with a unique remainder for every selector.`,
        ]
      : [
          "Sequential function identifiers are used instead of ABI function selectors, as these are",
          "much smaller and can fit into a smaller lookup table.",
        ]),
  ];
};

export const getMagicModulusFunction = (
  context: FileContext,
  selectorType: SelectorType
): ArrayJoinInput => {
  const readSelectorExpression = getReadSelectorExpression(
    context,
    selectorType
  );

  console.log(`SELECTOR BITS ${selectorType.bits}`)

  return [
    `function magicSelector() pure returns (uint256 selector) {`,
    [`assembly {`, [`selector := ${readSelectorExpression}`], `}`],
    `}`,
  ];
};
