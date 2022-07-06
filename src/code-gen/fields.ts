import _ from "lodash";
import { numberToPascalCaseWords } from '../lib/text'
import { AbiType, AbiStruct, ArrayJoinInput, AbiStructField, AbiEnum } from '../types';
import { getMaxUint, getOmissionMask, toHex } from '../lib/bytes';
import { FileContext } from './context';
import { ReservedKeywords } from './ReservedKeywords';
import { CoderType, GroupType } from "../parser/types";

export type ProcessedField =
  AbiStructField & {
    offset: number;
    readFromWord: string;
    positioned: string;
    update: string;
    parameterDefinition: string;
    structName: string;
    assignment: string;
    originalName: string;
    setterName: string;
    getterName: string;
    generateGetter: boolean;
    generateSetter: boolean;
    getterCoderType?: CoderType;
    setterCoderType?: CoderType;
    maxValueReference: string;
  };

export const toTypeName = (def: AbiType, roundToNearestByte?: boolean): string => {
	if (def.meta == 'elementary') {
		switch (def.type) {
			case 'uint':
        let size = def.size
        if (roundToNearestByte && size % 8) {
          size += (8 - (size % 8))
        }
				return `uint${size}`;
			case 'bool':
				return `bool`;
			case 'byte':
				return `byte`;
			case 'bytes':
        if (def.dynamic) return `bytes`
				return `bytes${def.size / 8}`;
			case 'address':
				return 'address';
		}
	}
	if (def.meta == 'array') return `${toTypeName(def.baseType)}[${def.length || ''}]`;
	return def.name;
};

export const abiStructToSol = (struct: AbiStruct | AbiEnum): ArrayJoinInput<string> => {
	let arr: ArrayJoinInput = [];
	if (struct.meta == 'enum') {
		let size = 7 + struct.name.length + struct.fields.reduce((sum, f) => sum + f.length, 0);
		if (size < 60) arr = [`enum ${struct.name} { ${struct.fields.join(', ')} }`];
		else
			arr = [
				`enum ${struct.name} {`,
				[
					...struct.fields.slice(0, struct.fields.length - 1).map((f) => `${f},`),
					struct.fields[struct.fields.length - 1],
				],
				`}`,
			];
	} else
		arr = [`struct ${struct.name} {`, struct.fields.map((field) => `${toTypeName(field.type)} ${field.name};`), `}`];
	return arr;
};

export const resolveGroupMembers = (
  struct: AbiStruct,
  group: GroupType,
  fields: ProcessedField[],
): ProcessedField[] => {
  const fieldCopies: ProcessedField[] = []
  for (const member of group.members) {
    const field = fields.find((field) => field.name === member.name);
    if (!field) throw Error(`Member ${member.name} of group ${group.name} not found in ${struct.name}`);

    // Shallow copy because we won't need to modify nested values
    const fieldCopy = { ...field };

    // If group member defines coder type, it will override the group's coder type
    // and the coder type of the original field in the struct.
    // If group defines coder type, it will override the coder type of the original
    // field in the struct.
    if (member.coderType) applyCoderType(fieldCopy, member.coderType);
    else if (group.coderType) applyCoderType(fieldCopy, group.coderType);

    fieldCopies.push(fieldCopy);
  }
  return fieldCopies;
}

export const applyGroupAccessCoder = (
  group: GroupType,
  fields: ProcessedField[],
  groupCoderLocation: 'get' | 'set'
) => {
  const groupCoderType = groupCoderLocation === 'get'
    ? group.accessors?.getterCoderType
    : group.accessors?.setterCoderType;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const member = group.members[i]
    // If group member defines coder type, it will override the group's coder type
    // and the coder type of the original field in the struct.
    // If group defines coder type, it will override the coder type of the original
    // field in the struct.
    if (member.coderType) applyCoderType(field, member.coderType);
    else if (groupCoderType) applyCoderType(field, groupCoderType);
  }
}

export const applyCoderType = (field: ProcessedField, coderType: CoderType) => {
  field.coderType = coderType;
  field.parameterDefinition = getParameterDefinition(field);
}

export const getFieldSetterName = (field: ProcessedField) =>
  `set${field.originalName.toPascalCase()}`

export const getFieldGetterName = (field: ProcessedField) =>
  `get${field.originalName.toPascalCase()}`;

const uintAllowed = (typeName: AbiType) => (
  typeName.meta === 'enum' || (
    typeName.meta === 'elementary' && typeName.type === 'uint'
  )
)

export const shouldCheckForOverflow = (field: AbiStructField): boolean => {
  if (!uintAllowed(field.type) || field.coderType === 'unchecked') return false;
  // Check for overflow if type size is not divisible by 8
  return field.coderType === 'checked' || field.type.size % 8 > 0;
}

export const getParameterDefinition = (field: AbiStructField) => {
  // If field is not a uint or enum, or `exact` is true, use real type
  // otherwise, use uint256
  const typeUsed = (
    (field.coderType === 'exact') || !uintAllowed(field.type)
  ) ? toTypeName(field.type, true) : 'uint256';
  
  return `${typeUsed} ${field.name}`
}

const getMaxUintForField = (field: AbiStructField) => {
  const name = `MaxUint${field.type.size}`;
  const value = getMaxUint(field.type.size);
  return { name, value }
}

export function processFields(
  struct: AbiStruct,
  context: FileContext
): ProcessedField[] {
  const withExtras: ProcessedField[] = [];
  let offset = 0;
  for (const field of struct.fields) {
    const maxValue = getMaxUintForField(field);
    const maxValueReference = context.addConstant(maxValue.name, maxValue.value)
    const originalName = field.name;
    const isReserved = ReservedKeywords.includes(originalName);
    if (isReserved) {
      field.name = `_${field.name}`;
    }
    const readFromWord = getReadField(struct, field, offset, context, maxValueReference);
    const { update, position: positioned } = getSetField(
      struct,
      field,
      offset,
      context,
      originalName
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
      getterName: `get${originalName.toPascalCase()}`,
      setterName: `set${originalName.toPascalCase()}`,
      generateGetter: Boolean(!field.accessors || field.accessors.getterCoderType),
      generateSetter: Boolean(!field.accessors || field.accessors.setterCoderType),
      getterCoderType: field.accessors?.getterCoderType,
      setterCoderType: field.accessors?.setterCoderType,
      maxValueReference
    });
    offset += field.type.size;
  }
  return withExtras;
}

export const getSetField = (
  struct: AbiStruct,
  field: AbiStructField,
  offset: number,
  context: FileContext,
  originalName: string
) => {
  if (field.type.meta !== "elementary" && field.type.meta !== "enum") throw Error("Unsupported field!");
  const constantsPrefix = `${struct.name}_${originalName}`;
  const size = field.type.size;
  const bitsAfter = 256 - (offset + size);
  
  const omitMaskName = `${constantsPrefix}_maskOut`;
  const omitMask = getOmissionMask(offset, size)
  const maskReference = context.addConstant(omitMaskName, omitMask);
  const oldValueRemoved = `and(old, ${maskReference})`;

  let positioned = field.name;
  if (bitsAfter > 0) {
    const bitsAfterName = `${constantsPrefix}_bitsAfter`;
    const bitsAfterReference = context.addConstant(bitsAfterName, toHex(bitsAfter));
    positioned = `shl(${bitsAfterReference}, ${field.name})`;
  }

  return {
    update: `or(${oldValueRemoved}, ${positioned})`,
    position: positioned,
  };
};

export const getReadField = (
  struct: AbiStruct,
  field: AbiStructField,
  offset: number,
  context: FileContext,
  maxValueReference: string
) => {
  if (field.type.meta !== "elementary" && field.type.meta !== 'enum') throw Error("Unsupported field!");
  const constantsPrefix = `${struct.name}_${field.name}`;
  const size = field.type.size;
  const bitsAfter = 256 - (offset + size);
  let rightAligned = "encoded";
  if (bitsAfter > 0) {
    const bitsAfterName = `${constantsPrefix}_bitsAfter`;
    const bitsAfterReference = context.addConstant(bitsAfterName, toHex(bitsAfter));
    rightAligned = `shr(${bitsAfterReference}, encoded)`;
  }
  let masked = rightAligned;
  if (offset > 0) {
    // const maskName = `MaskOnlyLast${numberToPascalCaseWords(size / 8)}Bytes`;
    // const maskReference = context.addConstant(maskName, getInclusionMask(size));
    masked = `and(${maxValueReference}, ${rightAligned})`;
  }
  return masked;
};