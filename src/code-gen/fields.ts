import _ from "lodash";
import { numberToPascalCaseWords } from '../lib/text'
import { AbiType, AbiStruct, ArrayJoinInput, AbiStructField, AbiEnum, ProcessedField, ProcessedGroup, AccessorOptions, ProcessedStruct } from '../types';
import { getGroupOmissionMask, getMaxUint, getOmissionMask, toHex } from '../lib/bytes';
import { FileContext } from './context';
import { ReservedKeywords } from './ReservedKeywords';
import { Accessors, CoderType, GroupType } from "../parser/types";

export const toTypeName = (def: AbiType, roundToNearestByte?: boolean): string => {
	if (def.meta == 'elementary') {
		switch (def.type) {
			case 'uint':
      case 'int':
        let size = def.size
        if (roundToNearestByte && size % 8) {
          size += (8 - (size % 8))
        }
				return `${def.type}${size}`;
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

const uintAllowed = (typeName: AbiType) => {
  return (
    typeName.meta === 'enum' || (
      typeName.meta === 'elementary' && typeName.type === 'uint'
    )
  )
}

const intAllowed = (typeName: AbiType) => (
  typeName.meta === 'elementary' && typeName.type === 'int'
)

export const shouldCheckForOverflow = (field: AbiStructField): boolean => {
  if (field.coderType === 'unchecked' || field.coderType === 'exact' || !(uintAllowed(field.type) || intAllowed(field.type))) return false;
  // Check for overflow if type size is not divisible by 8
  return field.coderType === 'checked' || field.type.size % 8 > 0;
}

export const getParameterDefinition = (field: AbiStructField) => {
  // If field is not a uint or enum, or `exact` is true, use real type
  // otherwise, use uint256
  const typeUsed = field.coderType === 'exact'
    ? toTypeName(field.type, true)
    : uintAllowed(field.type)
      ? 'uint256'
      : intAllowed(field.type)
        ? 'int256'
        : toTypeName(field.type)

/*   (
    (field.coderType === 'exact') || !uintAllowed(field.type)
  ) ? toTypeName(field.type, true) : 'uint256'; */
  
  return `${typeUsed} ${field.name}`
}

const getMaxUintForField = (field: AbiStructField) => {
  const name = field.type.meta === 'elementary' && field.type.type === 'int'
  ? `MaxInt${field.type.size}`
  : `MaxUint${field.type.size}`;
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
    const { update, position: positioned, omitMaskReference } = getSetField(
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
          const bytesLess1 = (field.type.size / 8) - 1;
          return `xor(${fieldReference}, signextend(${bytesLess1}, ${fieldReference}))`
        }
        return `gt(${fieldReference}, ${maxValueReference})`
      },
      maxValueReference,
      omitMaskReference
    });
    offset += field.type.size;
  }
  return withExtras;
}

const getAccessorOptions = (name: string, accessors?: Accessors): AccessorOptions => ({
  generateGetter: Boolean(!accessors || accessors.getterCoderType),
  generateSetter: Boolean(!accessors || accessors.setterCoderType),
  getterCoderType: accessors?.getterCoderType,
  setterCoderType: accessors?.setterCoderType,
  getterName: `get${name.toPascalCase()}`,
  setterName: `set${name.toPascalCase()}`,
})

export const processStruct = (
  abiStruct: AbiStruct,
  context: FileContext
) => {
  const fields = processFields(abiStruct, context);
  const struct: ProcessedStruct = {
    ...abiStruct,
    fields,
    ...getAccessorOptions(abiStruct.name, abiStruct.accessors),
    getterName: 'decode',
    setterName: 'encode',
    groups: []
  }
  for (const abiGroup of abiStruct.groups) {
    const groupFields = resolveGroupMembers(struct, abiGroup, fields)
    const groupMask = getGroupOmissionMask(groupFields);
    const omitMaskName = `${struct.name}_${abiGroup.name}_maskOut`;
    const maskReference = context.addConstant(omitMaskName, groupMask);
    const group: ProcessedGroup = {
      ...abiGroup,
      fields: groupFields,
      ...getAccessorOptions(abiGroup.name, abiGroup.accessors),
      omitMaskReference: maskReference
    }
    struct.groups.push(group)
  }
  return struct;
}

export const getSetField = (
  struct: AbiStruct,
  field: AbiStructField,
  offset: number,
  context: FileContext,
  originalName: string,
  maxValueReference: string
) => {
  if (field.type.meta !== "elementary" && field.type.meta !== "enum") throw Error("Unsupported field!");
  const constantsPrefix = `${struct.name}_${originalName}`;
  const size = field.type.size;
  const bitsAfter = 256 - (offset + size);
  
  const omitMaskName = `${constantsPrefix}_maskOut`;
  const omitMask = getOmissionMask(offset, size)
  const maskReference = context.addConstant(omitMaskName, omitMask);
  const oldValueRemoved = `and(old, ${maskReference})`;

  let fieldReference = intAllowed(field.type) ? `and(${field.name}, ${maxValueReference})` : field.name

  let positioned = field.name;
  if (bitsAfter > 0) {
    const bitsAfterName = `${constantsPrefix}_bitsAfter`;
    const bitsAfterReference = context.addConstant(bitsAfterName, toHex(bitsAfter));
    positioned = `shl(${bitsAfterReference}, ${fieldReference})`;
  }

  return {
    update: `or(${oldValueRemoved}, ${positioned})`,
    position: positioned,
    omitMaskReference: maskReference
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
  if (field.type.meta === "elementary" && field.type.type === 'int') {
    const bytesLess1 = (field.type.size / 8) - 1;
    return `signextend(${toHex(bytesLess1)}, ${rightAligned})`
  }
  let masked = rightAligned;
  if (offset > 0) {
    // const maskName = `MaskOnlyLast${numberToPascalCaseWords(size / 8)}Bytes`;
    // const maskReference = context.addConstant(maskName, getInclusionMask(size));
    masked = `and(${maxValueReference}, ${rightAligned})`;
  }
  return masked;
};