import { buildAssemblyBlock } from "../code-gen/codegen-helpers";
import { toHex } from "../lib/bytes";
import {
  AbiFunction,
  AbiType,
  ArrayJoinInput,
  CodeGenFunction,
} from "../types";
import { addSeparators, suffixLastString, wrapParentheses } from "../lib/text";
import {
  getParamDefinition,
  hasDynamicLength,
  maxDynamicDepth,
  toTypeName,
} from "../type-utils";

export const getHighLevelTypeString = (type: AbiType) => {
  if (type.meta === "array") {
    return `array_${getHighLevelTypeString(type.baseType)}`;
  }
  return toTypeName(type);
};

export const getInputGetterFunctionName = (fn: AbiFunction) => {
  const typeNames = fn.input.fields
    .map((f) => getHighLevelTypeString(f.type))
    .join("_");
  return `get_${typeNames}`;
};

export const getOutputGetterFunctionName = (fn: AbiFunction) => {
  const typeNames = fn.output.fields
    .map((f) => getHighLevelTypeString(f.type))
    .join("_");
  return `return_${typeNames}`;
};

export const getOutputGetterFunction = (
  fn: AbiFunction
): CodeGenFunction | undefined => {
  if (fn.output.fields.length) {
    const inputs = fn.output.fields.map((field) => {
      return {
        definition: `${toTypeName(field.type)}${
          field.type.dynamic ? " memory" : ""
        } ${field.name}`,
        name: field.name,
        type: field.type,
      };
    });
    const body: ArrayJoinInput[] = [];
    if (fn.output.dynamic) {
      body.push([
        `bytes memory data = abi.encode(${fn.output.fields.map(
          (field) => field.name
        )});`,
        buildAssemblyBlock([`return(add(data, 32), mload(data))`]),
      ]);
    } else {
      const asmBlock: ArrayJoinInput[] = [];
      let offset = 0;
      for (let i = 0; i < fn.output.fields.length; i++) {
        asmBlock.push(`mstore(${toHex(offset)}, ${fn.output.fields[i].name})`);
        offset += 32;
      }
      asmBlock.push(`return(0, ${toHex(offset)})`);
      body.push(buildAssemblyBlock(asmBlock));
    }
    return {
      name: getOutputGetterFunctionName(fn),
      inputs,
      stateMutability: "pure",
      visibility: "default",
      body,
      outputs: [],
    };
  }
};

export const getInputGetterFunction = (
  fn: AbiFunction
): CodeGenFunction | undefined => {
  if (fn.input.fields.length) {
    const functionName = getInputGetterFunctionName(fn);
    const assignments: ArrayJoinInput<string> = [];
    const outputs: CodeGenFunction["outputs"] = [];
    let cdOffset = 4;
    for (const field of fn.input.fields) {
      const offset = cdOffset;
      cdOffset += 32;
      let definition: string;
      if (field.type.dynamic) {
        const dynamicDepth = maxDynamicDepth(field.type);
        console.log(`${field.name} - Max dynamic depth ${dynamicDepth}`);
        // const strictOffsetValidation = `xor(calldataload(${toHex(offset)}), ${nextDataOffsetBase})`;
        definition = `${toTypeName(field.type)} calldata ${field.name}`;
        if (field.type.meta === "struct") {
          assignments.push(
            `${field.name} := add(0x04, calldataload(${toHex(offset)}))`
          );
        }
        // assignments.push(
        // `${field.name}.offset := add(0x04, calldataload(${toHex(offset)}))`
        // );
        if (hasDynamicLength(field.type)) {
          assignments.push(
            `${field.name}.offset := add(0x04, calldataload(${toHex(offset)}))`,
            `${field.name}.length := calldataload(${field.name}.offset)`,
            `${field.name}.offset := add(0x20, ${field.name}.offset)`
          );
        }
      } else if (field.type.meta === "struct") {
        definition = `${toTypeName(field.type)} ${field.name}`;
        assignments.push(`${field.name} := ${toHex(offset)}`);
      } else {
        definition = `${toTypeName(field.type)} ${field.name}`;
        assignments.push(`${field.name} := calldataload(${toHex(offset)})`);
      }
      outputs.push({ definition, name: field.name, type: field.type });
    }
    const body = buildAssemblyBlock(assignments);
    return {
      inputs: [],
      outputs,
      name: functionName,
      stateMutability: "pure",
      visibility: "default",
      body,
    };
  }
};

export const getCallInputGetterFunction = (fn: AbiFunction) => {
  if (!fn.input.fields.length) return [];
  const definitions = fn.input.fields.map((f) =>
    getParamDefinition(f, "calldata")
  );
  return (
    suffixLastString(
      wrapParentheses(addSeparators(definitions, ", ")),
      ` = ${getInputGetterFunctionName(fn)}();`
    ) as string[]
  ).join("");
};

export const getCallOutputGetterFunction = (fn: AbiFunction) => {
  return `${getOutputGetterFunctionName(fn)}(${fn.output.fields
    .map((f) => f.name)
    .join(", ")});`;
};
