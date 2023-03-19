import {
  Interface,
  ParamType,
  JsonFragment,
  JsonFragmentType,
} from "@ethersproject/abi";

import {
  AbiArray,
  AbiError,
  AbiEvent,
  AbiEventField,
  AbiFunction,
  AbiStruct,
  AbiStructField,
  AbiType,
} from "../types";

import { elementaryToTypeDef } from "./helpers";

const getSizeOrDynamic = (fields: AbiType[]) => {
  let size = 0;
  let dynamic = false;
  for (const field of fields) {
    if (field.size) size += size;
    if (field.dynamic) dynamic = true;
  }
  if (dynamic) size = null;
  return { size, dynamic };
};

export const fieldsFromParamTypes = (
  params: ParamType[],
  fragments: JsonFragmentType[]
): { fields: AbiStructField[]; size: number | null; dynamic: boolean } => {
  const fields = params.map((param, i) => fromParamType(param, fragments[i]));
  const { size, dynamic } = getSizeOrDynamic(fields);
  return {
    size,
    dynamic,
    fields: fields.map((field, i) => ({
      type: field,
      name: params[i].name,
      coderType: "checked",
    })),
  };
};

export function fromParamType(
  param: ParamType,
  fragment: JsonFragmentType
): AbiType {
  if (param.baseType === "tuple") {
    const { fields, size, dynamic } = fieldsFromParamTypes(
      param.components,
      fragment.components as JsonFragmentType[]
    );
    return {
      meta: "struct",
      name: fragment.internalType?.replace("struct ", "") || param.name,
      dynamic,
      size,
      fields,
      coderType: "checked",
      groups: [],
    };
  } else if (param.baseType === "array") {
    const _fragment = {
      ...fragment,
      internalType: fragment.internalType.replace("[]", ""),
      type: fragment.type.replace("[]", ""),
    };
    const baseType = fromParamType(param.arrayChildren, _fragment);
    const length = Math.max(param.arrayLength, 0) || undefined;
    const size = baseType.size && length ? length * baseType.size : null;
    return {
      meta: "array",
      length,
      dynamic: size === null,
      size,
      baseType,
    } as AbiArray;
  } else {
    return elementaryToTypeDef(param.baseType);
  }
}

export function fromInterface(
  // iface: Interface,
  jsonFragments: JsonFragment[]
): {
  functions: AbiFunction[];
  structs: AbiStruct[];
  events: AbiEvent[];
  errors: AbiError[];
} {
  const iface = new Interface(jsonFragments);
  const functions = Object.values(iface.functions);
  const events = Object.values(iface.events);
  const errors = Object.values(iface.errors);

  // for (const func of functions) {
  //   const fragment = jsonFragments.find((frag) => frag.name === func.name);
  //   if (fragment) {
  //     for (let i = 0; i < func.inputs.length; i++) {
  //       const input = fragment.inputs[i];
  //       input.
  //     }

  //   }
  //   for (const input of func.inputs) {
  //     const fragmentInput = fragment.inputs?.find(inp => inp.)
  //   }
  // }
  const processed: AbiFunction[] = [];
  const structs: AbiStruct[] = [];
  const processedEvents: AbiEvent[] = [];
  const processedErrors: AbiError[] = [];
  const checkStruct = (struct: AbiStruct) => {
    if (!structs.find((s) => s.name === struct.name)) {
      structs.push(struct);
    }
  };
  const checkType = (field: AbiType) => {
    if (field.meta === "struct") {
      checkStruct(field);
      for (const member of field.fields) {
        checkType(member.type);
      }
    } else if (field.meta === "array") {
      checkType(field.baseType);
    }
  };
  for (const fn of functions) {
    const stateMutability = fn.stateMutability;
    const fragment = jsonFragments.find((frag) => frag.name === fn.name);
    const input = fieldsFromParamTypes(
      fn.inputs,
      fragment.inputs as JsonFragmentType[]
    );
    const output = fieldsFromParamTypes(
      fn.outputs,
      fragment.outputs as JsonFragmentType[]
    );
    for (const field of [...input.fields, ...output.fields]) {
      checkType(field.type);
    }

    processed.push({
      meta: "function",
      name: fn.name,
      stateMutability: (stateMutability === "nonpayable"
        ? null
        : stateMutability) as AbiFunction["stateMutability"],
      visibility: "external",
      input,
      output,
    });
  }
  for (const evt of events) {
    const fragment = jsonFragments.find((frag) => frag.name === evt.name);
    const input = fieldsFromParamTypes(
      evt.inputs,
      fragment.inputs as JsonFragmentType[]
    );
    const fields: AbiEventField[] = input.fields.map((field, i) => ({
      ...field,
      isIndexed: evt.inputs[i].indexed,
    }));

    for (const field of input.fields) {
      checkType(field.type);
    }

    processedEvents.push({
      meta: "event",
      anonymous: evt.anonymous,
      name: evt.name,
      fields,
      dynamic: input.dynamic,
      size: input.size,
    });
  }
  for (const err of errors) {
    const fragment = jsonFragments.find((frag) => frag.name === err.name);

    const { fields, dynamic, size } = fieldsFromParamTypes(
      err.inputs,
      fragment.inputs as JsonFragmentType[]
    );

    for (const field of fields) {
      checkType(field.type);
    }

    processedErrors.push({
      meta: "error",
      name: err.name,
      fields,
      dynamic,
      size,
    });
  }
  return {
    functions: processed,
    events: processedEvents,
    structs,
    errors: processedErrors,
  };
}
