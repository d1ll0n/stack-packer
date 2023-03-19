import { CodeGenFunction } from "../../types";
import { getReadSelectorExpression } from "../selectors";
import { LookupTable } from "../lookup-table";
import { SelectorType } from "../types";

import { getMagicModulusNatspec } from "./modulus";

export const getFallbackForJumpTable = (
  selectorType: SelectorType,
  table: LookupTable | string
): CodeGenFunction => ({
  name: "fallback",
  inputs: [],
  outputs: [],
  stateMutability: "payable",
  visibility: "external",
  natspecLines:
    selectorType.type === "magic" ? getMagicModulusNatspec(selectorType) : [],
  body:
    table instanceof LookupTable
      ? [
          `function() internal fn;`,
          ...table.readFromTable(
            getReadSelectorExpression(table.context, selectorType),
            "fn"
          ),
          `fn();`,
        ]
      : [
          `${table}.goto(${
            selectorType.type === "magic" ? "magicSelector" : "indexedSelector"
          }());`,
        ],
});
