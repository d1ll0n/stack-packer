import { FileContext } from "./context";

export const PointerRoundUp32MaskName = `RoundUp32Mask`;
export const PointerRoundUp32Mask = `0xffffe0`;

export const getAssemblyRoundUpExpression = (
  context: FileContext,
  expression: string
) => {
  const maskReference = context.addConstant(
    PointerRoundUp32MaskName,
    PointerRoundUp32Mask
  );
  return `and(add(${expression}, 31), ${maskReference})`;
};

export const getAssemblyRoundUpAndAddExpression = (
  context: FileContext,
  expression: string
) => {
  const maskReference = context.addConstant(
    PointerRoundUp32MaskName,
    PointerRoundUp32Mask
  );
  return `and(add(${expression}, 63), ${maskReference})`;
};
