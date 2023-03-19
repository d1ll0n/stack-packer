import keccak256 from "keccak256";

import {
  AbiError,
  AbiEvent,
  AbiFunction,
  ArrayJoinInput,
  MappingType,
} from "../types";
import { toHex } from "../lib/bytes";
import { toTypeName } from "../type-utils";

import { buildAssemblyBlock, buildFunctionBlock } from "./codegen-helpers";
import { FileContext } from "./context";

export function getThrowFunction(
  error: AbiError,
  context: FileContext
): ArrayJoinInput<string> {
  const signature = `${error.name}(${error.fields
    .map((f) => toTypeName(f.type))
    .join(",")})`;
  const selector = `0x${keccak256(signature)
    .slice(0, 4)
    .toString("hex")}`.padEnd(66, "0");
  let offset = 4;
  const selectorReference = context.addConstant(
    `${error.name}_selector`,
    selector
  );
  const lines: string[] = [`mstore(0, ${selectorReference})`];
  for (const field of error.fields) {
    const offsetRef = context.addConstant(
      `${error.name}_${field.name}_ptr`,
      toHex(offset)
    );
    lines.push(`mstore(${offsetRef}, ${field.name})`);
    offset += 32;
  }
  const lengthReference = context.addConstant(
    `${error.name}_length`,
    toHex(offset)
  );
  lines.push(`revert(0, ${lengthReference})`);
  const fnBlock = buildFunctionBlock(
    `throw${error.name}`,
    error.fields.map((field) => `${toTypeName(field.type)} ${field.name}`),
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock;
}

export function getEmitFunction(
  event: AbiEvent,
  context: FileContext
): ArrayJoinInput<string> {
  const topic0 = `0x${keccak256(
    `${event.name}(${event.fields.map((f) => toTypeName(f.type)).join(",")})`
  ).toString("hex")}`;
  const lines: string[] = [];
  const topics: string[] = [];
  const topic0Reference = context.addConstant(`${event.name}_topic0`, topic0);
  topics.push(topic0Reference);
  let offset = 0;
  for (const field of event.fields) {
    if (field.isIndexed) {
      topics.push(field.name);
    } else {
      const offsetRef = context.addConstant(
        `${event.name}_${field.name}_ptr`,
        toHex(offset)
      );
      lines.push(`mstore(${offsetRef}, ${field.name})`);
      offset += 32;
    }
  }
  const lengthReference = context.addConstant(
    `${event.name}_length`,
    toHex(offset)
  );
  lines.push(
    `log${topics.length}(0, ${lengthReference}, ${topics.join(", ")})`
  );
  const fnBlock = buildFunctionBlock(
    `emit${event.name}`,
    event.fields.map((field) => `${toTypeName(field.type)} ${field.name}`),
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock;
}

export function getCallFunction(
  fn: AbiFunction,
  context: FileContext
): ArrayJoinInput<string> {
  const { input } = fn;
  const signature = `${fn.name}(${input.fields
    .map((f) => toTypeName(f.type))
    .join(",")})`;
  const selector = `0x${keccak256(signature)
    .slice(0, 4)
    .toString("hex")}`.padEnd(66, "0");
  let offset = 4;
  const selectorReference = context.addConstant(
    `${fn.name}_selector`,
    selector
  );
  const lines: string[] = [`mstore(0, ${selectorReference})`];
  for (const field of input.fields) {
    const offsetRef = context.addConstant(
      `${fn.name}_${field.name}_ptr`,
      toHex(offset)
    );
    lines.push(`mstore(${offsetRef}, ${field.name})`);
    offset += 32;
  }
  const lengthReference = context.addConstant(
    `${fn.name}_calldata_${input.dynamic ? "baseLength" : "length"}`,
    toHex(offset)
  );
  // lines.push(`revert(0, ${lengthReference})`)
  lines.push(`call(target, gasleft(), 0, ${lengthReference}, 0, 0)`);
  const fnBlock = buildFunctionBlock(
    `call${fn.name.toPascalCase()}`,
    [
      `address target`,
      ...input.fields.map((field) => `${toTypeName(field.type)} ${field.name}`),
    ],
    [],
    buildAssemblyBlock(lines)
  );
  return fnBlock;
}

export function getMappingAccessExpression(
  { name, type: { keyTypes } }: { name: string; type: MappingType },
  keys?: string[]
) {
  keys = keys || [];
  const accessArray = [name];
  for (let i = 0; i < keyTypes.length; i++) {
    const key = keys[i] || keyTypes.length === 1 ? "key" : `key${i}`;
    accessArray.push(`[${key}]`);
  }
  return accessArray.join("");
}
