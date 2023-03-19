import { CodeGenFunction } from "../types";
import { elementaryToTypeDef } from "../parser";

import { buildAssemblyBlock } from "./codegen-helpers";

export const generateIsNullFunction = (
  customType: string,
  defaultName?: string
): CodeGenFunction => {
  const body = [
    `_isNull = equals(a, ${defaultName || `${customType}.wrap(0)`});`,
  ];
  return {
    internalType: "comparison",
    name: "isNull",
    stateMutability: "pure",
    visibility: "internal",
    inputFields: [],
    outputFields: [],
    inputs: [{ name: customType, definition: `${customType} a` }],
    outputs: [
      {
        type: elementaryToTypeDef("bool"),
        name: "_isNull",
        definition: `bool _isNull`,
      },
    ],
    body,
  };
};

export const generateEqualityFunction = (
  customType: string
): CodeGenFunction => {
  const body = buildAssemblyBlock([`_equals := eq(a, b)`]);
  return {
    internalType: "comparison",
    name: "equals",
    stateMutability: "pure",
    visibility: "internal",
    inputFields: [],
    outputFields: [],
    inputs: [
      { name: "a", definition: `${customType} a` },
      { name: "b", definition: `${customType} b` },
    ],
    outputs: [
      {
        type: elementaryToTypeDef("bool"),
        name: "_equals",
        definition: `bool _equals`,
      },
    ],
    body,
  };
};

export const generateComparisonFunctions = (
  customType: string,
  defaultName?: string
): CodeGenFunction[] => {
  return [
    generateEqualityFunction(customType),
    generateIsNullFunction(customType, defaultName),
  ];
};
