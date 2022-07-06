import {
  AbiError,
  AbiEvent,
  AbiFunction,
  AbiStruct,
  ArrayJoinInput,
} from "../types";
import { applyCoderType, applyGroupAccessCoder, getParameterDefinition, ProcessedField, shouldCheckForOverflow, toTypeName } from './fields'
import _ from "lodash";
import { prefixFirstString, suffixLastString, toArray } from "../lib/text";
import { FileContext } from "./context";
import { buildAssemblyBlock, buildFunctionBlock, buildNestedAssemblyOr } from "./codegen-helpers";
import keccak256 from "keccak256";
import { getGroupOmissionMask, getMaxUint, toHex } from "../lib/bytes";
import { GroupType } from "../parser/types";

const getFieldsGetter = (name: string, fields: ProcessedField[]) => buildFunctionBlock(
  name,
  `${fields[0].structName} encoded`,
  fields.map((field) => field.parameterDefinition),
  buildAssemblyBlock(fields.map((field) => field.assignment))
);

export const getDecodeFunction = (struct: AbiStruct, fields: ProcessedField[]) => {
  // const fieldCopies = fields.map(field => ({ ...field }));
  if (struct.accessors) {
    if (struct.accessors.getterCoderType) {
      // todo - better resolution of type overrides
    } else {
      // If an accessors block is defined and a getter is not,
      // do not generate a getter
      return []
    }
  }
  return getFieldsGetter('decode', fields)
}
export const getDecodeGroupFunction = (group: GroupType, fields: ProcessedField[]) => {
  if (group.accessors) {
    if (group.accessors.getterCoderType) {
      applyGroupAccessCoder(group, fields, 'get')
    } else {
      // If an accessors block is defined and a getter is not,
      // do not generate a getter
      return []
    }
  }
  return getFieldsGetter(`get${group.name.toPascalCase()}`, fields)
}

export function getEncodeFunction(
  struct: AbiStruct,
  fields: ProcessedField[],
  context: FileContext
): ArrayJoinInput<string>[] {
  // const fieldCopies = fields.map(field => ({ ...field }));
  if (struct.accessors) {
    if (struct.accessors.setterCoderType) {
      // todo - better resolution of type overrides
    } else {
      // If an accessors block is defined and a setter is not,
      // do not generate a setter
      return []
    }
  }
  let encodeChunks = buildNestedAssemblyOr(fields);
  encodeChunks = prefixFirstString(encodeChunks, 'encoded := ')
  
  return buildFunctionBlock(
    "encode",
    fields.map((field) => field.parameterDefinition),
    `${fields[0].structName} encoded`,
    buildAssemblyBlock([
      ...getOverflowCheck(fields, context),
      ...toArray(encodeChunks)
    ])
  );
}

export const generateFieldSetter = (
  field: ProcessedField,
  context: FileContext
): ArrayJoinInput<string> => {
  const writeFn = buildFunctionBlock(
    field.setterName,
    [
      `${field.structName} old`,
      field.parameterDefinition
    ],
    `${field.structName} updated`,
    buildAssemblyBlock([
      ...getOverflowCheck([field], context),
      `updated := ${field.update}`
    ])
  );
  return writeFn;
};


export const generateFieldGetter = (field: ProcessedField) => getFieldsGetter(field.getterName, [field])

export function generateFieldAccessors(field: ProcessedField, context: FileContext) {
  if (!field.generateGetter && !field.generateSetter) {
    return [];
  }
  const code: ArrayJoinInput<string>[] = [];
  if (field.generateGetter) {
    const fieldCopy = { ...field }
    if (field.getterCoderType) {
      applyCoderType(fieldCopy, field.getterCoderType)
    }
    code.push('', ...generateFieldGetter(fieldCopy))
  }
  if (field.generateSetter) {
    const fieldCopy = { ...field }
    if (field.setterCoderType) {
      applyCoderType(fieldCopy, field.setterCoderType)
    }
    code.push('', ...generateFieldSetter(fieldCopy, context))
  }
  context.addSection(
    `${field.structName}.${field.originalName} coders`,
    code
  )
}

export function getEncodeGroupFunction(
  group: GroupType,
  fields: ProcessedField[],
  context: FileContext
) {
  if (group.accessors) {
    if (group.accessors.setterCoderType) {
      applyGroupAccessCoder(group, fields, 'set')
    } else {
      // If an accessors block is defined and a getter is not,
      // do not generate a getter
      return []
    }
  }
  const groupMask = getGroupOmissionMask(fields);
  const omitMaskName = `${fields[0].structName}_${group.name}_maskOut`;
  const maskReference = context.addConstant(omitMaskName, groupMask);

  let chunks = buildNestedAssemblyOr([
    { positioned: `and(old, ${maskReference})` },
    ...fields,
  ]);
  chunks = prefixFirstString(chunks, 'updated := ')
  return buildFunctionBlock(
    `set${group.name.toPascalCase()}`,
    [
      `${fields[0].structName} old`,
      ...fields.map((field) => field.parameterDefinition),
    ],
    `${fields[0].structName} updated`,
    buildAssemblyBlock([
      ...getOverflowCheck(fields, context),
      ...toArray(chunks)
    ])
  );
}

const overflowRevert = (constantReferences: string[]) => ([
  // '// Store the Panic error signature.',
  `mstore(0, ${constantReferences[0]})`,
  // '',
  // '// Store the arithmetic (0x11) panic code as initial argument.',
  `mstore(${constantReferences[1]}, ${constantReferences[2]})`,
  // '',
  // '// Return, supplying Panic signature and arithmetic code.',
  `revert(0, ${constantReferences[3]})`,
]);

const overflowConstants = [
  ['Panic_error_signature', '0x4e487b7100000000000000000000000000000000000000000000000000000000'],
  ['Panic_error_offset', '0x04'],
  ['Panic_arithmetic', '0x11'],
  ['Panic_error_length', '0x24'],
]

export function getOverflowCheck(originalFields: ProcessedField[], context: FileContext): ArrayJoinInput<string> {
  const fields = originalFields.filter((field) => shouldCheckForOverflow(field));
  if (fields.length === 0) return [];
  const overflowConstantReferences = overflowConstants.map(([_name, _constant]) => context.addConstant(_name, _constant))
  const overflowChecks: { positioned: string; }[] = [];
  for ( const field of fields) {
    // const maxSizeName = `MaxUint${field.type.size}`;
    // const maxSizeHex = getMaxUint(field.type.size)
    // const maxSizeReference = context.addConstant(maxSizeName, maxSizeHex);
    overflowChecks.push({ positioned: `gt(${field.name}, ${field.maxValueReference})` })
  }
  let overflowCondition = toArray(buildNestedAssemblyOr(overflowChecks));
  prefixFirstString(overflowCondition, 'if ');
  suffixLastString(overflowCondition, ' {');
  overflowCondition.push(overflowRevert(overflowConstantReferences));
  overflowCondition.push('}')
  return overflowCondition
}

export function getThrowFunction(error: AbiError, context: FileContext): ArrayJoinInput<string> {
  const signature = `${error.name}(${error.fields.map(f => toTypeName(f.type)).join(',')})`;
  const selector = `0x${keccak256(signature).slice(0, 4).toString('hex')}`.padEnd(66, '0');
  let offset = 4;
  const selectorReference = context.addConstant(`${error.name}_selector`, selector);
  const lines: string[] = [
    `mstore(0, ${selectorReference})`
  ];
  for (let field of error.fields) {
    const offsetRef = context.addConstant(`${error.name}_${field.name}_ptr`, toHex(offset));
    lines.push(`mstore(${offsetRef}, ${field.name})`);
    offset += 32;
  }
  const lengthReference = context.addConstant(`${error.name}_length`, toHex(offset))
  lines.push(`revert(0, ${lengthReference})`)
  const fnBlock = buildFunctionBlock(
    `throw${error.name}`,
    error.fields.map((field) => `${toTypeName(field.type)} ${field.name}`),
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock
}

export function getEmitFunction(event: AbiEvent, context: FileContext): ArrayJoinInput<string> {
  const topic0 = `0x${keccak256(`${event.name}(${event.fields.map(f => toTypeName(f.type)).join(',')})`).toString('hex')}`;
  const lines: string[] = [];
  const topics: string[] = []
  const topic0Reference = context.addConstant(`${event.name}_topic0`, topic0);
  topics.push(topic0Reference)
  let offset = 0;
  for (let field of event.fields) {
    if (field.isIndexed) {
      topics.push(field.name)
    } else {
      const offsetRef = context.addConstant(`${event.name}_${field.name}_ptr`, toHex(offset));
      lines.push(`mstore(${offsetRef}, ${field.name})`);
      offset += 32;
    }
  }
  const lengthReference = context.addConstant(`${event.name}_length`, toHex(offset))
  lines.push(`log${topics.length}(0, ${lengthReference}, ${topics.join(', ')})`)
  const fnBlock = buildFunctionBlock(
    `emit${event.name}`,
    event.fields.map((field) => `${toTypeName(field.type)} ${field.name}`),
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock
}

export function getCallFunction(fn: AbiFunction, context: FileContext): ArrayJoinInput<string> {
  const {input, output} = fn
  const signature = `${fn.name}(${input.fields.map(f => toTypeName(f.type)).join(',')})`;
  const selector = `0x${keccak256(signature).slice(0, 4).toString('hex')}`.padEnd(66, '0');
  let offset = 4;
  const selectorReference = context.addConstant(`${fn.name}_selector`, selector);
  const lines: string[] = [
    `mstore(0, ${selectorReference})`
  ];
  for (let field of input.fields) {
    const offsetRef = context.addConstant(`${fn.name}_${field.name}_ptr`, toHex(offset));
    lines.push(`mstore(${offsetRef}, ${field.name})`);
    offset += 32;
  }
  const lengthReference = context.addConstant(`${fn.name}_calldata_${input.dynamic ? 'baseLength' : 'length'}`, toHex(offset))
  // lines.push(`revert(0, ${lengthReference})`)
  lines.push(`call(target, gasleft(), 0, ${lengthReference}, 0, 0)`)
  const fnBlock = buildFunctionBlock(
    `call${fn.name.toPascalCase()}`,
    [
      `address target`,
      ...input.fields.map((field) => `${toTypeName(field.type)} ${field.name}`)
    ],
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock
}

// function get