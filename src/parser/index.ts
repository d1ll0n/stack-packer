import Parser = require('./parser');
import { DefinedType, EnumType, StructType, StructField, TypeName } from './types';
import { AbiType, AbiStructField, AbiStruct, AbiEnum } from '../lib/types';
import { bitsRequired, elementaryToTypeDef } from '../lib/helpers';

class ParserWrapper {
  structs: { [key: string]: AbiType } = {};

  constructor(parsed: DefinedType[]) {
    let i = 0;
    let n = 0;
    while (n < parsed.length && i < 50) for (let p of parsed) if (this.handleType(p)) (i++ && n++);
  }

  get allStructs(): AbiType[] {
    return Object.keys(this.structs).reduce((arr, k) => [...arr, this.structs[k]], []);
  }

  handleType(input: DefinedType): AbiType {
    if (input.type == 'EnumDefinition') {
      const { type, name, fields, namePath } = <EnumType> input;
      const out: AbiType = {
        meta: 'enum',
        name,
        fields,
        dynamic: false,
        size: bitsRequired(fields.length)
      };
      return this.putStruct(namePath, out);
    }
    if (input.type == 'StructDefinition') {
      const { name, fields, namePath } = <StructType> input;
      const outFields: AbiStructField[] = [];
      let size = 0;
      for (let field of fields) {
        const { name, typeName } = field;
        const abiType = this.convertFieldType(typeName);
        if (!abiType) return null;
        outFields.push({ name, type: abiType });
        if (abiType.size == null) size = null;
        else if (size != null) size += abiType.size;
      }
      // for (let f of outFields)
      // const size = outFields.reduce((sum, f)=> (sum != null && f.type.size != null) ? sum + f.type.size : null, 0);
      const struct: AbiType = {
        meta: 'struct',
        size,
        dynamic: size == null,
        name,
        fields: outFields
      }
      return this.putStruct(namePath, struct);
    }
    throw new Error(`Did not recognize type of ${input}`)
  }

  convertFieldType(typeName: TypeName): AbiType {
    const { type, baseTypeName, name, namePath, length } = typeName;
    switch(type) {
      case 'ArrayTypeName':
        const baseType = this.convertFieldType(baseTypeName);
        const size = (baseType.size && length) ? length.number * baseType.size : null
        return {
          meta: 'array',
          baseType,
          length: length && length.number,
          dynamic: size == null,
          size
        }
      case 'ElementaryTypeName': return elementaryToTypeDef(name);
      case 'UserDefinedTypeName': return this.structs[namePath] || null;
    }
  }

  putStruct(namePath: string, struct: AbiType) {
    this.structs[namePath] = struct;
    return struct;
  }
}

export function parseCode(sourceCode: string): AbiType[] {
  if (!(/pragma solidity/g.exec(sourceCode))) {
    sourceCode = ['pragma solidity ^0.6.0;', '', sourceCode].join('\n');
  }
  if (!(/(library | contract)/g.exec(sourceCode))) {
    sourceCode = ['library TmpLib {', sourceCode, '}'].join('\n');
  }
  const input = Parser.parseFile(sourceCode);
  const handler = new ParserWrapper(input);
  return handler.allStructs;
}