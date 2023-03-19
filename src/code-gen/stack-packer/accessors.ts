import { Accessors } from "../../parser/types";
import { FileContext } from "../context";
import { intAllowed } from "../stack-packer/rules";
import {
  AbiStruct,
  AbiStructField,
  AccessorOptions,
  ProcessedField,
} from "../../types";
import { getOmissionMask, toHex } from "../../lib/bytes";
import "../../lib/String";

export const getFieldSetterName = (field: ProcessedField) =>
  `set${field.originalName.toPascalCase()}`;

export const getFieldGetterName = (field: ProcessedField) =>
  `get${field.originalName.toPascalCase()}`;

export const getAccessorOptions = (
  name: string,
  accessors?: Accessors
): AccessorOptions => ({
  generateGetter: Boolean(!accessors || accessors.getterCoderType),
  generateSetter: Boolean(!accessors || accessors.setterCoderType),
  getterCoderType: accessors?.getterCoderType,
  setterCoderType: accessors?.setterCoderType,
  getterName: `get${name.toPascalCase()}`,
  setterName: `set${name.toPascalCase()}`,
});

export const getSetField = (
  struct: AbiStruct,
  field: AbiStructField,
  offset: number,
  context: FileContext,
  originalName: string,
  maxValueReference: string
) => {
  if (field.type.meta !== "elementary" && field.type.meta !== "enum")
    throw Error("Unsupported field!");
  const constantsPrefix = `${struct.name}_${originalName}`;
  const size = field.type.size;
  const bitsAfter = 256 - (offset + size);

  const omitMaskName = `${constantsPrefix}_maskOut`;
  const omitMask = getOmissionMask(offset, size);
  const maskReference = context.addConstant(omitMaskName, omitMask);
  const oldValueRemoved = `and(old, ${maskReference})`;

  const fieldReference = intAllowed(field.type)
    ? `and(${field.name}, ${maxValueReference})`
    : field.name;

  let positioned = field.name;
  if (bitsAfter > 0) {
    const bitsAfterName = `${constantsPrefix}_bitsAfter`;
    const bitsAfterReference = context.addConstant(
      bitsAfterName,
      toHex(bitsAfter)
    );
    positioned = `shl(${bitsAfterReference}, ${fieldReference})`;
  }

  return {
    update: `or(${oldValueRemoved}, ${positioned})`,
    position: positioned,
    omitMaskReference: maskReference,
  };
};

export const getReadField = (
  struct: AbiStruct,
  field: AbiStructField,
  offset: number,
  context: FileContext,
  maxValueReference: string
) => {
  if (field.type.meta !== "elementary" && field.type.meta !== "enum")
    throw Error("Unsupported field!");
  const constantsPrefix = `${struct.name}_${field.name}`;
  const size = field.type.size;
  const bitsAfter = 256 - (offset + size);
  let rightAligned = "encoded";
  if (bitsAfter > 0) {
    const bitsAfterName = `${constantsPrefix}_bitsAfter`;
    const bitsAfterReference = context.addConstant(
      bitsAfterName,
      toHex(bitsAfter)
    );
    rightAligned = `shr(${bitsAfterReference}, encoded)`;
  }
  if (field.type.meta === "elementary" && field.type.type === "int") {
    const bytesLess1 = field.type.size / 8 - 1;
    return `signextend(${toHex(bytesLess1)}, ${rightAligned})`;
  }
  let masked = rightAligned;
  if (offset > 0) {
    // const maskName = `MaskOnlyLast${numberToPascalCaseWords(size / 8)}Bytes`;
    // const maskReference = context.addConstant(maskName, getInclusionMask(size));
    masked = `and(${maxValueReference}, ${rightAligned})`;
  }
  return masked;
};
