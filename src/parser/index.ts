import Parser = require('./parser');
import { DefinedType, EnumType, StructType, TypeName } from './types';
import { AbiType, AbiStructField } from '../types';
import { bitsRequired } from '../lib/bytes';
// import { bitsRequired, elementaryToTypeDef } from '../lib/helpers';

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
        let { name, typeName } = field;
        let group: string[] | undefined;
        ({ group, name } = getNameAndGroup(name))
        name.replace(/_group\d/g, '');
        const abiType = this.convertFieldType(typeName);
        if (!abiType) return null;
        outFields.push({ name, group, type: abiType });
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
  const input = Parser.parseFile(sourceCode);
  const handler = new ParserWrapper(input);
  return handler.allStructs;
}

export const elementaryToTypeDef = (typeName: string): AbiType => {
  const isBool = /bool/g.exec(typeName);
  if (isBool)
    return {
      meta: "elementary",
      dynamic: false,
      size: 8,
      type: "bool",
    };
  const isUint = /uint(\d{0,3})/g.exec(typeName);
  if (isUint) {
    const size = isUint[1];
    return {
      meta: "elementary",
      dynamic: !size,
      size: size ? +size : null,
      type: "uint",
    };
  }
  const isBytes = /bytes(\d{0,2})/g.exec(typeName);
  if (isBytes) {
    const size = isBytes[1];
    return {
      meta: "elementary",
      dynamic: !size,
      size: size ? 8 * +size : null,
      type: "bytes",
    };
  }
  const isAddress = /address/g.exec(typeName);
  if (isAddress) {
    return {
      meta: "elementary",
      dynamic: false,
      size: 160,
      type: "address",
    };
  }
};

const groupNameRegex = /_group_([a-zA-Z]+)/g;
const getGroups = (name: string) => [...name.matchAll(groupNameRegex)]?.map((arr) => arr?.[1]);

const getNameAndGroup = (name: string): { group?: string[]; name: string } => ({
  group: getGroups(name),
  name: name.replace(groupNameRegex, '')
})