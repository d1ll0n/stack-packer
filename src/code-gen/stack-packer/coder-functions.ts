import { prefixFirstString, suffixLastString, toArray } from "../../lib/text";
import {
  AbiStruct,
  ArrayJoinInput,
  CodeGenFunction,
  ProcessedField,
  ProcessedGroup,
  ProcessedStruct,
} from "../../types";
import { buildAssemblyBlock, buildNestedAssemblyOr } from "../codegen-helpers";
import { FileContext } from "../context";

import { applyCoderType, applyGroupAccessCoder } from "./groups";
import { shouldCheckForOverflow } from "./rules";

const getFieldsGetter = (
  name: string,
  struct: AbiStruct,
  fields: ProcessedField[]
): CodeGenFunction => ({
  name,
  inputs: [
    {
      definition: `${fields[0].structName} encoded`,
      name: "encoded",
      type: struct,
    },
  ],
  outputs: fields.map((field) => ({
    definition: field.parameterDefinition,
    name: field.name,
    type: field.type,
  })),
  visibility: "internal",
  stateMutability: "pure",
  body: buildAssemblyBlock(fields.map((field) => field.assignment)),
  internalType: "getter",
  inputFields: [],
  outputFields: fields,
});

export const getDecodeGroupFunction = (
  struct: AbiStruct,
  group: ProcessedGroup
) => {
  const { fields, generateGetter, getterName, getterCoderType } = group;
  if (!generateGetter) return undefined;
  if (getterCoderType) {
    applyGroupAccessCoder(group, fields, "get");
  }
  return getFieldsGetter(getterName, struct, fields);
};

export function getEncodeGroupFunction(
  struct: ProcessedStruct,
  group: ProcessedGroup,
  context: FileContext
): CodeGenFunction | undefined {
  const { fields, generateSetter, setterName, setterCoderType } = group;
  if (!generateSetter) return undefined;
  if (setterCoderType) {
    applyGroupAccessCoder(group, fields, "set");
  }
  return getEncoder(
    struct,
    fields,
    context,
    setterName,
    group.omitMaskReference
  );
}

export const getDecodeFunction = (
  struct: ProcessedStruct,
  fields: ProcessedField[]
) => {
  if (!struct.generateGetter) return undefined;
  return getFieldsGetter("decode", struct, fields);
};

export function getEncodeFunction(
  struct: ProcessedStruct,
  fields: ProcessedField[],
  context: FileContext
): CodeGenFunction | undefined {
  if (!struct.generateSetter) return undefined;
  return getEncoder(struct, fields, context, `encode`);
}

export const generateFieldGetter = (struct: AbiStruct, field: ProcessedField) =>
  getFieldsGetter(field.getterName, struct, [field]);

export function generateFieldAccessors(
  struct: AbiStruct,
  field: ProcessedField,
  context: FileContext
): CodeGenFunction[] {
  if (!field.generateGetter && !field.generateSetter) {
    return [];
  }
  const functions: Array<CodeGenFunction | undefined> = [];
  if (field.generateGetter) {
    const fieldCopy = { ...field };
    if (field.getterCoderType) {
      applyCoderType(fieldCopy, field.getterCoderType);
    }
    functions.push(generateFieldGetter(struct, fieldCopy));
  }
  if (field.generateSetter) {
    const fieldCopy = { ...field };
    if (field.setterCoderType) {
      applyCoderType(fieldCopy, field.setterCoderType);
    }
    functions.push(generateFieldSetter(struct, fieldCopy, context));
  }
  return functions.filter(Boolean);
}

const getEncoder = (
  struct: AbiStruct,
  fields: ProcessedField[],
  context: FileContext,
  name: string,
  maskReference?: string
): CodeGenFunction => {
  const orBlocks: { positioned: string }[] = [...fields];
  const inputs = fields.map((field) => ({
    definition: field.parameterDefinition,
    name: field.name,
    type: field.type,
  }));
  let outputName = "encoded";
  if (maskReference) {
    orBlocks.unshift({ positioned: `and(old, ${maskReference})` });
    inputs.unshift({
      definition: `${fields[0].structName} old`,
      name: "old",
      type: struct,
    });
    outputName = "updated";
  }
  let encodeChunks = buildNestedAssemblyOr(orBlocks);
  encodeChunks = prefixFirstString(encodeChunks, `${outputName} := `);
  return {
    name,
    inputs,
    outputs: [
      {
        definition: `${fields[0].structName} ${outputName}`,
        name: outputName,
        type: struct,
      },
    ],
    visibility: "internal",
    stateMutability: "pure",
    body: buildAssemblyBlock([
      ...getOverflowCheck(fields, context),
      ...toArray(encodeChunks),
    ]),
    internalType: "setter",
    outputFields: [],
    inputFields: fields,
  };
};

export const generateFieldSetter = (
  struct: AbiStruct,
  field: ProcessedField,
  context: FileContext
): CodeGenFunction =>
  getEncoder(
    struct,
    [field],
    context,
    field.setterName,
    field.omitMaskReference
  );

const overflowRevert = (constantReferences: string[]) => [
  // '// Store the Panic error signature.',
  `mstore(0, ${constantReferences[0]})`,
  // '',
  // '// Store the arithmetic (0x11) panic code as initial argument.',
  `mstore(${constantReferences[1]}, ${constantReferences[2]})`,
  // '',
  // '// Return, supplying Panic signature and arithmetic code.',
  `revert(0, ${constantReferences[3]})`,
];

const overflowConstants = [
  [
    "Panic_error_signature",
    "0x4e487b7100000000000000000000000000000000000000000000000000000000",
  ],
  ["Panic_error_offset", "0x04"],
  ["Panic_arithmetic", "0x11"],
  ["Panic_error_length", "0x24"],
];

export function getOverflowCheck(
  originalFields: ProcessedField[],
  context: FileContext
): ArrayJoinInput<string> {
  const fields = originalFields.filter((field) =>
    shouldCheckForOverflow(field)
  );
  if (fields.length === 0) return [];
  const overflowConstantReferences = overflowConstants.map(
    ([_name, _constant]) => context.addConstant(_name, _constant)
  );
  const overflowChecks: { positioned: string }[] = [];
  for (const field of fields) {
    // const maxSizeName = `MaxUint${field.type.size}`;
    // const maxSizeHex = getMaxUint(field.type.size)
    // const maxSizeReference = context.addConstant(maxSizeName, maxSizeHex);
    overflowChecks.push({ positioned: field.getOverflowCheck(field.name) });
  }
  const overflowCondition = toArray(buildNestedAssemblyOr(overflowChecks));
  prefixFirstString(overflowCondition, "if ");
  suffixLastString(overflowCondition, " {");
  overflowCondition.push(overflowRevert(overflowConstantReferences));
  overflowCondition.push("}");
  return overflowCondition;
}
