import { isEnum, isUint } from "../../type-utils/type-check";
import { AbiStructField, AbiType } from "../../types";

export const uintAllowed = (typeName: AbiType) =>
  isEnum(typeName) || isUint(typeName);

export const intAllowed = (typeName: AbiType) =>
  typeName.meta === "elementary" && typeName.type === "int";

export const shouldCheckForOverflow = (field: AbiStructField): boolean => {
  if (
    field.coderType === "unchecked" ||
    field.coderType === "exact" ||
    !(uintAllowed(field.type) || intAllowed(field.type))
  )
    return false;
  // Check for overflow if type size is not divisible by 8
  return field.coderType === "checked" || field.type.size % 8 > 0;
};
