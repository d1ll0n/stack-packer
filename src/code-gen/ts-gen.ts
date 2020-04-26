import { ArrayJoinInput, AbiStruct, AbiEnum, AbiType, AbiStructField, AbiArray } from "../lib/types"
import { arrJoiner } from "../lib/helpers";

export type TypeScriptStructOutput = {
  inputType?: ArrayJoinInput;
  interface?: ArrayJoinInput;
  main: ArrayJoinInput;
}

export function hasNestedStruct(abi: AbiArray): boolean {
  if (abi.baseType.meta == 'struct') return true;
  if (abi.baseType.meta == 'array') return hasNestedStruct(abi.baseType);
}

export function nestedStructFields(abi: AbiStruct): AbiStructField[] {
  return abi.fields.filter(({ type }) =>
    type.meta == 'struct' || 
    type.meta == 'array' && hasNestedStruct(type)
  );
}

export function getStructConstructor(abi: AbiStruct | AbiArray, name: string): string {
  if (abi.meta == 'array') {
    return `${name}.map(f => ${getStructConstructor((<AbiStruct | AbiArray> abi.baseType), 'f')})`;
  }
  if (abi.meta == 'struct') {
    return `new ${abi.name}(${name})`;
  }
}

export const abiStructToTypescript = (struct: AbiStruct | AbiEnum): string => {
  if (struct.meta == 'enum') {
    return arrJoiner([`export enum ${struct.name} {`, struct.fields, `}`]);
  }
  const inputFields = struct.fields.map(({name, type}) => `${name}: ${toInterfaceType(type, true)};`);
  const structFields: AbiStructField[] = nestedStructFields(struct);
  const interfaceFields = structFields.map(({name, type}) => `${name}: ${toInterfaceType(type)};`);

  let _ctor;
  if (structFields.length) {
    _ctor = [`constructor(input: ${struct.name}Data) {`]
    let arr = [`const { ${structFields.map(f => f.name).join(', ')}, ...rest } = input;`];
    for (let field of structFields) {
      arr.push(`this.${field.name} = ${getStructConstructor(field.type as AbiStruct | AbiArray, field.name)};`);
      interfaceFields
    }
    arr.push(`Object.assign(this, rest)`);
    _ctor.push(arr, '}');
  }
  else _ctor = [`constructor(input: ${struct.name}Data) { Object.assign(this, input); }`];
  const arr = [
    `const ${struct.name}ABI = require('./${struct.name}ABI.json');`,
    '',
    `export interface ${struct.name}Data {`,
    inputFields,
    `}`,
    '',
    `export interface ${struct.name} extends ${struct.name}Data {`,
    [
      ...interfaceFields,
      `/* Encode as ABI. */`,
      `toAbi: () => Buffer;`,
      `/* Encode as packed ABI - all fields will have minimal length for their type. */`,
      `toAbiPacked: () => Buffer;`,
      `/* Encode as JSON object. */`,
      `toJson: () => any;`
    ],
    `}`,
    '',
    `export class ${struct.name} {`,
    [
      ..._ctor,
      `/* Decode a ${struct.name} from an ABI string or buffer. */`,
      `static fromAbi: (input: string | Buffer) => ${struct.name};`,
      `/* Decode a ${struct.name} from a packed ABI string or buffer */`,
      `static fromAbiPacked: (input: string | Buffer) => ${struct.name};`,
      `/* Decode a ${struct.name} from an arbitrary object with BufferLike fields of the same names (works for JSON). */`,
      `static fromObject: (input: any) => ${struct.name};`
    ],
    `}`,
    `defineProperties(${struct.name}, ${struct.name}ABI);`
  ];
  return arrJoiner(arr);
}

// export const toInputType = (def: AbiType): string => {
//   if (def.meta == 'elementary' || def.meta == 'enum') return 'BufferLike';
//   if (def.meta == 'array') return `${toInputType(def.baseType)}[${def.length || ''}]`;
//   if (def.meta == 'struct') return `${def.name}Data`
// }

export const toInterfaceType = (def: AbiType, input?: boolean): string => {
  if (def.meta == 'elementary') {
    switch(def.type) {
      case 'uint': return `${def.size > 53 ? 'BN' : 'number'}`;
      case 'bool': return `boolean`;
      case 'byte': return `string`;
      case 'bytes': return `string`;
      case 'address': return 'string';
    }
  }
  if (def.meta == 'array') {
    return `${toInterfaceType(def.baseType, input)}[]`
  }
  if (def.meta == 'enum') return def.name;
  return def.name + (input ? 'Data' : '');
}

export const buildLibrary = (defs: Array<AbiStruct | AbiEnum>): { code: string, json: Array<{fileName: string, json: string}> } => {
  const arr = [
    `import {defineProperties} from 'ts-abi-utils';`
  ];
  let json = [];
  for (let def of defs) {
    json.push({ fileName: `${def.name}ABI.json`, json: JSON.stringify(def, null, 2) });
    arr.push(abiStructToTypescript(def), '');
  }
  arr.pop();
  return { code: arrJoiner(arr), json };
}