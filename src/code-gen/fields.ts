import _ from "lodash";
import { numberToPascalCaseWords } from '../lib/text'
import { AbiType, AbiStruct, ArrayJoinInput, AbiStructField, AbiEnum } from '../types';
import { getInclusionMask, getOmissionMask, toHex } from '../lib/bytes';
import { FileContext } from './context';
import { ReservedKeywords } from './ReservedKeywords';

export type ProcessedField<T extends string | string[] = string[]> =
  AbiStructField<T> & {
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
  };

export const toTypeName = (def: AbiType): string => {
	if (def.meta == 'elementary') {
		switch (def.type) {
			case 'uint':
				return `uint${def.size}`;
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

export const separateGroups = (fields: ProcessedField[]): ProcessedField<string>[][] => {
	const allGroups = _(fields)
		.pickBy('group')
		.flatMap('group')
		.union()
		.value()
		.map((group) =>
			_(fields)
				.pickBy({ group: [group] })
				.toArray()
				.map((obj) => _(obj).omit('group').assign({ group }).value())
				.value(),
		);
	return allGroups;
};

export const getFieldSetterName = (field: ProcessedField) =>
  `set${field.originalName.toPascalCase()}`

export const getFieldGetterName = (field: ProcessedField) =>
  `get${field.originalName.toPascalCase()}`;

export const getParameterDefinition = (field: AbiStructField, oversized: boolean) => {
  const typeName = toTypeName(field.type);
  return `${(oversized && typeName.includes('uint')) ? 'uint256' : toTypeName(field.type)} ${field.name}`
}

export function processFields(
  struct: AbiStruct,
  context: FileContext
): ProcessedField[] {
  const withExtras: ProcessedField[] = [];
  let offset = 0;
  for (const field of struct.fields) {
    const originalName = field.name;
    const isReserved = ReservedKeywords.includes(originalName);
    if (isReserved) {
      field.name = `_${field.name}`;
    }
    const readFromWord = getReadField(struct, field, offset, context);
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
      parameterDefinition: getParameterDefinition(field, context.opts.oversizedInputs),
      structName: struct.name,
      assignment: `${field.name} := ${readFromWord}`,
      originalName,
      getterName: `get${originalName.toPascalCase()}`,
      setterName: `set${originalName.toPascalCase()}`,
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
  context: FileContext
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
    const maskName = `MaskOnlyLast${numberToPascalCaseWords(size / 8)}Bytes`;
    const maskReference = context.addConstant(maskName, getInclusionMask(size));
    masked = `and(${maskReference}, ${rightAligned})`;
  }
  return masked;
};