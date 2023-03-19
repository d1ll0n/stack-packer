import { SolidityReservedKeywords } from "../../lib/ReservedKeywords";
import { getMaxUint } from "../../lib/bytes";
import { toTypeName } from "../../type-utils";
import { isInt } from "../../type-utils/type-check";
import {
  AbiStruct,
  AbiStructField,
  ProcessedField,
  AbiType,
} from "../../types";
import { FileContext } from "../context";

import { getAccessorOptions, getSetField, getReadField } from "./accessors";
import { intAllowed, uintAllowed } from "./rules";

export const getParameterDefinition = (field: AbiStructField) => {
  // If field is not a uint or enum, or `exact` is true, use real type
  // otherwise, use uint256
  const typeUsed =
    field.coderType === "exact"
      ? toTypeName(field.type, true)
      : uintAllowed(field.type)
      ? "uint256"
      : intAllowed(field.type)
      ? "int256"
      : toTypeName(field.type);

  /*   (
    (field.coderType === 'exact') || !uintAllowed(field.type)
  ) ? toTypeName(field.type, true) : 'uint256'; */

  return `${typeUsed} ${field.name}`;
};

export const getMaxUintForField = (type: AbiType) => {
  const name = isInt(type) ? `MaxInt${type.size}` : `MaxUint${type.size}`;
  const value = getMaxUint(type.size);
  return { name, value };
};

export function processFields(
  struct: AbiStruct,
  context: FileContext
): ProcessedField[] {
  const withExtras: ProcessedField[] = [];
  let offset = 0;
  for (const field of struct.fields) {
    const maxValue = getMaxUintForField(field.type);
    const maxValueReference = context.addConstant(
      maxValue.name,
      maxValue.value
    );
    const originalName = field.name;
    const isReserved = SolidityReservedKeywords.includes(originalName);
    if (isReserved) {
      field.name = `_${field.name}`;
    }
    const readFromWord = getReadField(
      struct,
      field,
      offset,
      context,
      maxValueReference
    );
    const {
      update,
      position: positioned,
      omitMaskReference,
    } = getSetField(
      struct,
      field,
      offset,
      context,
      originalName,
      maxValueReference
    );
    withExtras.push({
      ...field,
      offset,
      readFromWord,
      positioned,
      update,
      parameterDefinition: getParameterDefinition(field),
      structName: struct.name,
      assignment: `${field.name} := ${readFromWord}`,
      originalName,
      ...getAccessorOptions(originalName, field.accessors),
      getOverflowCheck: (fieldReference: string) => {
        if (intAllowed(field.type)) {
          const bytesLess1 = field.type.size / 8 - 1;
          return `xor(${fieldReference}, signextend(${bytesLess1}, ${fieldReference}))`;
        }
        return `gt(${fieldReference}, ${maxValueReference})`;
      },
      maxValueReference,
      omitMaskReference,
    });
    offset += field.type.size;
  }
  return withExtras;
}
