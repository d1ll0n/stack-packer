import Parser = require('./parser');
import { DefinedType, EnumType, ErrorType, EventParameter, EventType, FunctionType, GroupType, StructField, StructType, TypeName } from './types';
import { AbiType, AbiStructField, AbiArray, AbiElementaryType, AbiErrorField, AbiError, AbiFunction, AbiEvent, AbiEventField, AbiEnum, AbiStruct, StructGroup } from '../types';
import { bitsRequired } from '../lib/bytes';
// import { bitsRequired, elementaryToTypeDef } from '../lib/helpers';

export function convertFieldType(typeName: TypeName, structs: Record<string, AbiStruct>, enums: Record<string, AbiEnum>): AbiType {
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
      } as AbiArray
    case 'ElementaryTypeName': return elementaryToTypeDef(name) as AbiElementaryType;
    case 'UserDefinedTypeName': return structs[namePath] || enums[namePath] || null;
  }
}

export class ParserWrapper {
  enums: Record<string, AbiEnum> = {}
  structs: Record<string, AbiStruct> = {};
  functions: Record<string, AbiFunction> = {}
  errors: Record<string, AbiError> = {}
  events: Record<string, AbiEvent> = {}

  constructor(parsed: DefinedType[]) {
    let i = 0;
    let n = 0;
    while (n < parsed.length && i < 50) for (let p of parsed) if (this.handleType(p)) (i++ && n++);
  }

  get allStructs(): AbiType<false, false>[] {
    return [
      ...Object.values(this.structs),
      ...Object.values(this.enums)
    ]
  }

  get allErrors(): AbiError[] {
    return Object.values(this.errors)
  }

  get allEvents(): AbiEvent[] {
    return Object.values(this.events)
  }

  get allFunctions(): AbiFunction[] {
    return Object.values(this.functions)
  }
  
  handleFields(fields: StructField[]) {
    const outFields: AbiStructField[] = [];
    let size = 0;
    for (let field of fields) {
      let { name, typeName, coderType, accessors } = field;
      const abiType = this.convertFieldType(typeName);
      if (!abiType) return null;
      const outField: AbiStructField = { name, type: abiType, coderType, accessors }
      if ((field as any).isIndexed) {
        (outField as any).isIndexed = (field as any).isIndexed
      }
      outFields.push(outField);
      if (abiType.size == null) size = null;
      else if (size != null) size += abiType.size;
    }
    return {
      fields: outFields,
      dynamic: size == null,
      size
    }
  }

  buildGroup(struct: AbiStruct, group: GroupType): StructGroup {
    const members: AbiStructField[] = []
    for (const member of group.members) {
      const field = struct.fields.find((field) => field.name === member.name);
      if (!field) throw Error(`Member ${member.name} of group ${group.name} not found in ${struct.name}`);
      // Shallow copy because we won't need to modify nested values
      const fieldCopy = { ...field }
      if (member.coderType) {
        fieldCopy.coderType = member.coderType;
      } else if (group.coderType) {
        fieldCopy.coderType = group.coderType
      }
    }
    const { name, coderType, accessors } = group;
    return { name, coderType, accessors, members }
  }

  handleType(input: DefinedType): AbiType<true, true> | AbiFunction {
    if (input.type == 'EnumDefinition') {
      const { type, name, fields, namePath } = <EnumType> input;
      const out: AbiType = {
        meta: 'enum',
        name,
        fields,
        dynamic: false,
        size: bitsRequired(fields.length)
      };
      return this.putEnum(namePath, out);
    }
    if (input.type == 'StructDefinition') {
      // console.log(input)
      const { name, fields: _fields, namePath, coderType, accessors, groups } = <StructType> input;
      const { fields, size, dynamic } = this.handleFields(_fields);

      const struct: AbiType = {
        meta: 'struct',
        size,
        dynamic,
        name,
        fields,
        coderType,
        accessors,
        groups
      }
      // struct.groups = groups.map(group => this.buildGroup(struct, group));

      return this.putStruct(namePath, struct);
    }
    if (input.type == 'CustomErrorDefinition') {
      const { name, fields: _fields, namePath } = <ErrorType> input;
      const { fields, size, dynamic } = this.handleFields(_fields);

      const error: AbiError = {
        meta: 'error',
        size,
        dynamic,
        name,
        fields
      }
      return this.putError(namePath, error as AbiError);
    }
    if (input.type == 'FunctionDefinition') {
      const { stateMutability, visibility, name, namePath } = <FunctionType> input;
      const inputs = this.handleFields(input.input)
      const outputs = this.handleFields(input.output)
      const fn: AbiFunction = {
        meta: "function",
        name,
        stateMutability,
        visibility,
        input: inputs,
        output: outputs
      }
      return this.putFunction(namePath, fn);
    }
    if (input.type === 'EventDefinition') {
      const { name, namePath } = <EventType> input
      const { fields, dynamic, size } = this.handleFields(input.fields) as any
      const event: AbiEvent = {
        meta: 'event',
        name,
        fields,
        dynamic,
        size
      }
      return this.putEvent(namePath, event);
    }
    throw new Error(`Did not recognize type of ${input}`)
  }

  convertFieldType(typeName: TypeName): AbiType {
    return convertFieldType(typeName, this.structs, this.enums)
  }

  putStruct(namePath: string, struct: AbiStruct) {
    this.structs[namePath] = struct;
    return struct;
  }

  putEnum(namePath: string, _enum: AbiEnum) {
    this.enums[namePath] = _enum;
    return _enum;
  }

  putError(namePath: string, error: AbiError) {
    this.errors[namePath] = error;
    return error;
  }

  putEvent(namePath: string, event: AbiEvent) {
    this.events[namePath] = event;
    return event;
  }

  putFunction(namePath: string, fn: AbiFunction) {
    this.functions[namePath] = fn;
    return fn;
  }
}

export function parseCode<AllowErrors extends true|false = false>(sourceCode: string): AbiType<AllowErrors>[] {
  const input = Parser.parseFile(sourceCode);
  const handler = new ParserWrapper(input);
  return handler.allStructs;
}

export function parseCode2(sourceCode: string): {
  functions: AbiFunction[];
  errors: AbiError[];
  structs: AbiType<true>[],
  events: AbiEvent[]
} {
  const input = Parser.parseFile(sourceCode);
  const handler = new ParserWrapper(input);
  return {
    functions: handler.allFunctions,
    errors: handler.allErrors,
    structs: handler.allStructs,
    events: handler.allEvents
  };
}

export const elementaryToTypeDef = (typeName: string): AbiElementaryType => {
  const isBool = /bool/g.exec(typeName);
  if (isBool)
    return {
      meta: "elementary",
      dynamic: false,
      size: 1,
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
  const isInt = /int(\d{0,3})/g.exec(typeName);
  if (isInt) {
    const size = isInt[1]
    if (!size || +size % 8) throw Error(`Signed ints must have size that is a multiple of 8`)
    return {
      meta: 'elementary',
      dynamic: false,
      size: size ? +size : null,
      type: "int",
    }
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