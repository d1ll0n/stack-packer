import {
  AbiElementaryType,
  AbiError,
  AbiEvent,
  AbiFunction,
  AbiStruct,
  ArrayJoinInput,
  CodeGenFunction,
  ProcessedField,
  ProcessedGroup,
  ProcessedStruct
} from "../types";
import { applyCoderType, applyGroupAccessCoder, shouldCheckForOverflow, toTypeName } from './fields'
import _ from "lodash";
import { prefixFirstString, suffixLastString, toArray } from "../lib/text";
import { FileContext } from "./context";
import { buildAssemblyBlock, buildFunctionBlock, buildNestedAssemblyOr } from "./codegen-helpers";
import keccak256 from "keccak256";
import { getGroupOmissionMask, getMaxUint, toHex } from "../lib/bytes";
import { GroupType } from "../parser/types";
import { convertFieldType, elementaryToTypeDef } from "../parser";

const getFieldsGetter = (name: string, struct: AbiStruct, fields: ProcessedField[]): CodeGenFunction => ({
  name,
  inputs: [{ definition:`${fields[0].structName} encoded`, name: 'encoded', type: struct }],  
  outputs: fields.map((field) => ({ definition:field.parameterDefinition, name: field.name, type: field.type })),
  visibility: 'pure',
  location: 'internal',
  body: buildAssemblyBlock(fields.map((field) => field.assignment)),
  internalType: 'getter',
  inputFields: [],
  outputFields: fields
})

export const getDecodeGroupFunction = (struct: AbiStruct, group: ProcessedGroup) => {
  const { fields, generateGetter, getterName, getterCoderType } = group
  if (!generateGetter) return undefined;
  if (getterCoderType) {
    applyGroupAccessCoder(group, fields, 'get')
  }
  return getFieldsGetter(getterName, struct, fields)
}

export const generateIsNullFunction = (struct: AbiStruct): CodeGenFunction => {
  const defaultName = `Default${struct.name}`;
  const body = [
    `_isNull = equals(a, ${defaultName});`
  ]
  return {
    internalType: 'comparison',
    name: 'isNull',
    location: 'internal',
    visibility: 'pure',
    inputFields: [],
    outputFields: [],
    inputs: [
      { type: struct, name: 'a', definition: `${struct.name} a`, },
    ],
    outputs: [{
      type: elementaryToTypeDef('bool'),
      name: '_isNull',
      definition: `bool _isNull`,
    }],
    body
  }
}

export const generateEqualityFunction = (struct: AbiStruct): CodeGenFunction => {
  const body = buildAssemblyBlock([
    `_equals := eq(a, b)`
  ])
  return {
    internalType: 'comparison',
    name: 'equals',
    location: 'internal',
    visibility: 'pure',
    inputFields: [],
    outputFields: [],
    inputs: [
      { type: struct, name: 'a', definition: `${struct.name} a`, },
      { type: struct, name: 'b', definition: `${struct.name} b`, },
    ],
    outputs: [{
      type: elementaryToTypeDef('bool'),
      name: '_equals',
      definition: `bool _equals`,
    }],
    body
  }
}

export const generateComparisonFunctions = (struct: AbiStruct): CodeGenFunction[] => {
  return [
    generateEqualityFunction(struct),
    generateIsNullFunction(struct)
  ]
}

export function getEncodeGroupFunction(
  struct: ProcessedStruct,
  group: ProcessedGroup,
  context: FileContext
): CodeGenFunction | undefined {
  const { fields, generateSetter, setterName, setterCoderType } = group
  if (!generateSetter) return undefined;
  if (setterCoderType) {
    applyGroupAccessCoder(group, fields, 'set')
  }
  return getEncoder(struct, fields, context, setterName, group.omitMaskReference)
}

export const getDecodeFunction = (struct: ProcessedStruct, fields: ProcessedField[]) => {
  if (!struct.generateGetter) return undefined;
  return getFieldsGetter('decode', struct, fields)
}

export function getEncodeFunction(
  struct: ProcessedStruct,
  fields: ProcessedField[],
  context: FileContext
): CodeGenFunction | undefined {
  if (!struct.generateSetter) return undefined;
  return getEncoder(struct, fields, context, `encode`)
}

export const generateFieldGetter = (struct: AbiStruct, field: ProcessedField) => getFieldsGetter(field.getterName, struct, [field])

export function generateFieldAccessors(struct: AbiStruct, field: ProcessedField, context: FileContext): CodeGenFunction[] {
  if (!field.generateGetter && !field.generateSetter) {
    return [];
  }
  const functions: Array<CodeGenFunction | undefined> = [];
  if (field.generateGetter) {
    const fieldCopy = { ...field }
    if (field.getterCoderType) {
      applyCoderType(fieldCopy, field.getterCoderType)
    }
    functions.push(generateFieldGetter(struct, fieldCopy))
  }
  if (field.generateSetter) {
    const fieldCopy = { ...field }
    if (field.setterCoderType) {
      applyCoderType(fieldCopy, field.setterCoderType)
    }
    functions.push(generateFieldSetter(struct, fieldCopy, context))
  }
  return functions.filter(Boolean)
}

const getEncoder = (
  struct: AbiStruct,
  fields: ProcessedField[],
  context: FileContext,
  name: string,
  maskReference?: string
): CodeGenFunction => {
  const orBlocks: { positioned: string; }[] = [...fields];
  const inputs = fields.map((field) => ({ definition:field.parameterDefinition, name: field.name, type: field.type }));
  let outputName = 'encoded'
  if (maskReference) {
    orBlocks.unshift({ positioned: `and(old, ${maskReference})` })
    inputs.unshift({ definition:`${fields[0].structName} old`, name: 'old', type: struct })
    outputName = 'updated'
  }
  let encodeChunks = buildNestedAssemblyOr(orBlocks);
  encodeChunks = prefixFirstString(encodeChunks, `${outputName} := `)
  return {
    name,
    inputs,
    outputs: [{ definition:`${fields[0].structName} ${outputName}`, name: outputName, type: struct }],  
    visibility: 'pure',
    location: 'internal',
    body: buildAssemblyBlock([
      ...getOverflowCheck(fields, context),
      ...toArray(encodeChunks)
    ]),
    internalType: 'setter',
    outputFields: [],
    inputFields: fields
  }
}

export const generateFieldSetter = (
  struct: AbiStruct,
  field: ProcessedField,
  context: FileContext
): CodeGenFunction => getEncoder(struct, [field], context, field.setterName, field.omitMaskReference)


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
    overflowChecks.push({ positioned: field.getOverflowCheck(field.name) })
  }
  let overflowCondition = toArray(buildNestedAssemblyOr(overflowChecks));
  prefixFirstString(overflowCondition, 'if ');
  suffixLastString(overflowCondition, ' {');
  overflowCondition.push(overflowRevert(overflowConstantReferences));
  overflowCondition.push("}");
  if (!context.opts.noComments) {
    const namesComment = fields.length === 1
        ? `\`${fields[0].name}\` overflows`
        : [
            ...fields
              .slice(0, -1)
              .map(({ name }) => `\`${name}\``)
              .join(", "),
            ` or \`${fields[fields.length - 1].name}\` overflow`,
          ].join("");
    overflowCondition.unshift(`// Revert if ${namesComment}`);
  }
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