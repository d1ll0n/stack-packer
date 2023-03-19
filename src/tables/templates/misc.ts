import { FileContext } from "../../code-gen/context";
import { ArrayJoinInput } from "../../types";

export const getPointerFunctionName = "ptrTo";

export const getPointerFunction = (context: FileContext): ArrayJoinInput => {
  const maskRef = context.addConstant(
    `CreateTimeFunctionPointerMask`,
    "0xffff"
  );
  return [
    `function ptrTo(function() internal self) pure returns (uint256 ptr) {`,
    [
      `assembly {`,
      [
        `// Remove the temporary function id to the left of the pointer during contract creation`,
        `// See: https://docs.soliditylang.org/en/v0.8.17/ir-breaking-changes.html#internal-function-pointers`,
        `ptr := and(self, ${maskRef})`,
      ],
      `}`,
    ],
    `}`,
  ];
};
