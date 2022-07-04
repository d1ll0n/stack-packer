import {
  ArrayJoinInput,
} from "../types";
import { ProcessedField } from './fields'
import _ from "lodash";
import { prefixFirstString, suffixLastString, toArray } from "../lib/text";
import { FileContext } from "./context";
import { buildAssemblyBlock, buildFunctionBlock, buildNestedAssemblyOr } from "./codegen-helpers";

export function getGroupOmitMask(fields: ProcessedField<string>[]) {
  let buf = Buffer.alloc(32, "ff", "hex");
  for (let field of fields) {
    buf = Buffer.concat([
      buf.slice(0, field.offset / 8),
      Buffer.alloc(field.type.size / 8, 0, "hex"),
      buf.slice((field.offset + field.type.size) / 8),
    ]);
  }
  return `0x${buf.toString("hex")}`;
}

const getFieldsGetter = (name: string, fields: ProcessedField<string|string[]>[]) => buildFunctionBlock(
  name,
  `${fields[0].structName} encoded`,
  fields.map((field) => field.parameterDefinition),
  buildAssemblyBlock(fields.map((field) => field.assignment))
);

export const getReadFieldFunction = (field: ProcessedField) => getFieldsGetter(field.getterName, [field])
export const getDecodeFunction = (fields: ProcessedField[]) => getFieldsGetter('decode', fields)
export const getDecodeGroupFunction = (fields: ProcessedField<string>[]) => getFieldsGetter(`get${fields[0].group.toPascalCase()}`, fields)

export function getEncodeFunction(
  fields: ProcessedField[],
  context: FileContext
): ArrayJoinInput<string>[] {
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

export const getWriteFieldFunction = (
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

export function getEncodeGroupFunction(
  fields: ProcessedField<string>[],
  context: FileContext
) {
  const group = fields[0].group as string;
  const groupMask = getGroupOmitMask(fields);
  const omitMaskName = `${fields[0].structName}_${group}_maskOut`;
  const maskReference = context.addConstant(omitMaskName, groupMask);

  let chunks = buildNestedAssemblyOr([
    { positioned: `and(old, ${maskReference})` },
    ...fields,
  ]);
  chunks = prefixFirstString(chunks, 'updated := ')
  return buildFunctionBlock(
    `set${group.toPascalCase()}`,
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

export function getOverflowCheck(originalFields: ProcessedField<string | string[]>[], context: FileContext): ArrayJoinInput<string> {
  const fields = originalFields.filter((field) => field.type.meta === 'elementary');
  if (fields.length === 0 || !context.checkOverflows) return [];
  const overflowConstantReferences = overflowConstants.map(([_name, _constant]) => context.addConstant(_name, _constant))
  const overflowChecks: { positioned: string; }[] = [];
  for ( const field of fields) {
    const maxSizeName = `MaxUint${field.type.size}`;
    const maxSizeHex = `0x${'ff'.repeat(field.type.size / 8)}`;
    const maxSizeReference = context.addConstant(maxSizeName, maxSizeHex);
    overflowChecks.push({ positioned: `gt(${field.name}, ${maxSizeReference})` })
  }
  let overflowCondition = toArray(buildNestedAssemblyOr(overflowChecks));
  prefixFirstString(overflowCondition, 'if ');
  suffixLastString(overflowCondition, ' {');
  overflowCondition.push(overflowRevert(overflowConstantReferences));
  overflowCondition.push('}')
  return overflowCondition
}