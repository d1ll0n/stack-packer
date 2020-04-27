import { ArrayJoinInput, AbiStruct, AbiEnum, AbiType, AbiStructField, AbiArray } from "../lib/types"
import { arrJoiner } from "../lib/helpers";

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

export type TypeDependency = {
  isEnum?: boolean;
  name: string;
}

class TypeScriptBuilder {
  typeDependencies: TypeDependency[] = [];
  usesBN?: boolean;
  constructorArr: ArrayJoinInput = [];
  _inputFields?: ArrayJoinInput;
  _interfaceFields?: ArrayJoinInput;
  _structFields?: AbiStructField[];

  constructor(public struct: AbiStruct | AbiEnum) {}

  get structFields(): AbiStructField[] {
    return this._structFields || (this._structFields = nestedStructFields(this.struct as AbiStruct));
  }

  putDependency = (name: string, isEnum?: boolean) => {
    if (this.typeDependencies.filter(t => t.name == name)) return;
    this.typeDependencies.push({ name, isEnum });
  }

  getInterfaceType = (def: AbiType, input?: boolean): string => {
    if (def.meta == 'elementary') {
      switch(def.type) {
        case 'uint':
          const _type = `${def.size > 53 ? 'BN' : 'number'}`;
          if (!this.usesBN && _type == 'BN') this.usesBN = true;
          return _type;
        case 'bool': return `boolean`;
        case 'byte': return `string`;
        case 'bytes': return `string`;
        case 'address': return 'string';
      }
    }
    if (def.meta == 'array') {
      return `${toInterfaceType(def.baseType, input)}[]`
    }
    if (def.meta == 'enum') {
      this.putDependency(def.name, true);
      return def.name;
    }
    this.putDependency(def.name);
    return def.name + (input ? 'Data' : '');
  }

  get inputFields() {
    return this._inputFields || (
      this._inputFields = (this.struct as AbiStruct)
        .fields.map(({name, type}) => `${name}: ${this.getInterfaceType(type, true)};`)
    );
  }

  get interfaceFields() {
    return this._interfaceFields || (
      this._interfaceFields = this.structFields
        .map(({name, type}) => `${name}: ${toInterfaceType(type)};`)
    );
  }

  get typeConstructor() {
    if (this.structFields.length) {
      let extra = this.structFields.length < this.struct.fields.length;
      let destructer = `${this.structFields.map(f => f.name).join(', ')}${extra ? `, ...rest` : ''}`
      return [
        `constructor(input: ${this.struct.name}Data) {`,
        [
          `const { ${destructer} } = input;`,
          ...this.structFields.map(({name, type}) =>
            `this.${name} = ${getStructConstructor(type as AbiStruct | AbiArray, name)};`
          ),
          extra ? `Object.assign(this, rest);` : undefined
        ],
        '}'
      ]
    } else return [`constructor(input: ${this.struct.name}Data) { Object.assign(this, input); }`];
  }

  get imports() {
    const _def = `import {defineProperties} from 'ts-abi-utils';`;
    const _deps = this.typeDependencies.map(({ name, isEnum }) =>
      `import { ${name} ${isEnum ? '' : `, ${name}Data`}} from './${name}';`
    );
    const _bn = this.usesBN ? `import BN from 'bn.js';` : undefined;
    const _abi = `const ${this.struct.name}ABI = require('./${this.struct.name}ABI.json');`;
    return [
      _def,
      _bn,
      ..._deps,
      _abi
    ];
  }

  get dataInterfaceDeclaration() {
    return [
      `export interface ${this.struct.name}Data {`,
      this.inputFields,
      `}`
    ];
  }

  get interfaceDeclaration() {
    return [
      `export interface ${this.struct.name} extends ${this.struct.name}Data {`,
      [
        ...this.interfaceFields,
        `/* Encode as ABI. */`,
        `toAbi: () => Buffer;`,
        `/* Encode as packed ABI - all fields will have minimal length for their type. */`,
        `toAbiPacked: () => Buffer;`,
        `/* Encode as JSON object. */`,
        `toJson: () => any;`
      ],
      `}`,
    ];
  }

  get classDeclaration() {
    const { name } = this.struct
    return [
      `export class ${name} {`,
      [
        ...this.typeConstructor,
        `/* Decode a ${name} from an ABI string or buffer. */`,
        `static fromAbi: (input: string | Buffer) => ${name};`,
        `/* Decode a ${name} from a packed ABI string or buffer */`,
        `static fromAbiPacked: (input: string | Buffer) => ${name};`,
        `/* Decode a ${name} from an arbitrary object with BufferLike fields of the same names (works for JSON). */`,
        `static fromObject: (input: any) => ${name};`
      ],
      `}`,
    ]
  }

  static buildLibrary = (struct: AbiStruct | AbiEnum): string => {
    const builder = new TypeScriptBuilder(struct);
    if (struct.meta == 'enum') {
      return arrJoiner([`export enum ${struct.name} {`, struct.fields, `}`]);
    }
    const arr = [
      ...builder.imports,
      '',
      ...builder.dataInterfaceDeclaration,
      '',
      ...builder.interfaceDeclaration,
      '',
      ...builder.classDeclaration,
      `defineProperties(${struct.name}, ${struct.name}ABI);`
    ];
    return arrJoiner(arr);
  }
}

export type BuilderResult = {
  jsonFileName: string;
  jsonFile: string;
  fileName: string;
  code: string;
}

export const buildLibrary = (defs: Array<AbiStruct | AbiEnum>): Array<BuilderResult> => {
  const arr = [];
  for (let def of defs) {
    arr.push({
      jsonFile: JSON.stringify(def, null, 2),
      jsonFileName: `${def.name}ABI.json`,
      fileName: `${def.name}.ts`,
      code: TypeScriptBuilder.buildLibrary(def)
    });
  }
  return arr;
}