import {
  AbiEnum,
  AbiError,
  AbiEvent,
  AbiFunction,
  AbiStruct,
  AbiStructField,
  AbiType,
  StateVariable,
  StructGroup,
} from "../types";
import { bitsRequired } from "../lib/bytes";

import { convertFieldType } from "./helpers";
import Parser = require("./parser");
import {
  AstMappingType,
  DefinedType,
  EnumType,
  ErrorType,
  EventType,
  FunctionType,
  GroupType,
  StructField,
  StructType,
  TypeName,
} from "./types";
export * from "./helpers";

export class ParserWrapper {
  enums: Record<string, AbiEnum> = {};
  structs: Record<string, AbiStruct> = {};
  functions: Record<string, AbiFunction> = {};
  errors: Record<string, AbiError> = {};
  events: Record<string, AbiEvent> = {};
  stateVariables: Record<string, StateVariable> = {};
  pendingStructs: Record<string, StructType> = {};
  passes = 0;

  constructor(parsed: DefinedType[]) {
    const structs: StructType[] = [];
    const other: DefinedType[] = [];
    for (const item of parsed) {
      if (item.type === "EnumDefinition") {
        this.handleType(item as EnumType);
      } else if (item.type === "StructDefinition") {
        structs.push(item as StructType);
      } else {
        other.push(item);
      }
    }
    for (const _struct of structs) {
      this.pendingStructs[_struct.namePath] = _struct as StructType;
    }
    this.tryParseAllStructs();
    for (const element of other) {
      this.handleType(element);
    }
    // @todo what is this for?
    // let i = 0;
    // let n = 0;
    // while (n < parsed.length && i < 50)
    //   for (const p of parsed) if (this.handleType(p)) i++ && n++;
  }

  tryParseAllStructs() {
    // console.log(`Pass ${this.passes++} parsing structs`);
    if (this.passes > 50)
      throw Error(`Failed to parse structs after ${this.passes} tries`);
    const structs = this.unparsedStructs;
    const startingLength = structs.length;
    if (startingLength === 0) return;
    for (const struct of structs) {
      this.tryParseStruct(struct);
    }
    const endingLength = this.unparsedStructs.length;
    if (endingLength === 0) return;
    if (startingLength === endingLength) {
      throw Error(`Failed to parse structs after ${this.passes} tries`);
    }
    // console.log(
    //   `${startingLength - endingLength} structs in pass ${this.passes}`
    // );
    this.tryParseAllStructs();
  }

  get unparsedStructs() {
    return Object.values(this.pendingStructs);
  }

  get allStructs(): AbiType<false, false>[] {
    return [...Object.values(this.structs), ...Object.values(this.enums)];
  }

  get allErrors(): AbiError[] {
    return Object.values(this.errors);
  }

  get allEvents(): AbiEvent[] {
    return Object.values(this.events);
  }

  get allFunctions(): AbiFunction[] {
    return Object.values(this.functions);
  }

  get allStateVariables(): StateVariable[] {
    return Object.values(this.stateVariables);
  }

  handleFields(fields: StructField[]) {
    const outFields: AbiStructField[] = [];
    let size = 0;
    for (const field of fields) {
      const { name, typeName, coderType, accessors } = field;
      const abiType = this.convertFieldType(typeName);
      if (!abiType) {
        return null;
      }
      const outField: AbiStructField = {
        name,
        type: abiType,
        coderType,
        accessors,
      };
      if ((field as any).isIndexed) {
        (outField as any).isIndexed = (field as any).isIndexed;
      }
      outFields.push(outField);
      if (abiType.size == null) size = null;
      else if (size != null) size += abiType.size;
    }
    return {
      fields: outFields,
      dynamic: size == null,
      size,
    };
  }

  buildGroup(struct: AbiStruct, group: GroupType): StructGroup {
    const members: AbiStructField[] = [];
    for (const member of group.members) {
      const field = struct.fields.find((field) => field.name === member.name);
      if (!field)
        throw Error(
          `Member ${member.name} of group ${group.name} not found in ${struct.name}`
        );
      // Shallow copy because we won't need to modify nested values
      const fieldCopy = { ...field };
      if (member.coderType) {
        fieldCopy.coderType = member.coderType;
      } else if (group.coderType) {
        fieldCopy.coderType = group.coderType;
      }
    }
    const { name, coderType, accessors } = group;
    return { name, coderType, accessors, members };
  }

  handleMapping(input: AstMappingType): {
    keys: StructField[];
    value: StructField;
  } {
    const inputs: StructField[] = [
      {
        typeName: input.keyType,
        name: "key",
        coderType: "checked",
      },
    ];
    let output: StructField = {
      typeName: input.valueType,
      name: "value",
      coderType: "checked",
    };

    if (input.valueType.type === "Mapping") {
      const { keys, value } = this.handleMapping(
        input.valueType as AstMappingType
      );
      inputs.push(...keys);
      inputs.forEach((item, i) => {
        item.name = `key${i}`;
      });
      output = value;
      return {
        keys: inputs,
        value,
      };
    }
    return { keys: inputs, value: output };
  }

  tryParseStruct(input: StructType) {
    // console.log(input)
    const {
      name,
      fields: _fields,
      namePath,
      coderType,
      accessors,
      groups,
    } = input;
    const result = this.handleFields(_fields);
    if (!result) return null;
    const { fields, size, dynamic } = result;

    const struct: AbiType = {
      meta: "struct",
      size,
      dynamic,
      name,
      fields,
      coderType,
      accessors,
      groups,
    };

    return this.putStruct(namePath, struct);
  }

  handleType(input: DefinedType): AbiType<true, true, true> {
    if (input.type === "EnumDefinition") {
      const { name, fields, namePath } = <EnumType>input;
      const out: AbiType = {
        meta: "enum",
        name,
        fields,
        dynamic: false,
        size: bitsRequired(fields.length),
      };
      return this.putEnum(namePath, out);
    }
    if (input.type === "StructDefinition") {
      // console.log(input)
      const {
        name,
        fields: _fields,
        namePath,
        coderType,
        accessors,
        groups,
      } = <StructType>input;
      const { fields, size, dynamic } = this.handleFields(_fields);

      const struct: AbiType = {
        meta: "struct",
        size,
        dynamic,
        name,
        fields,
        coderType,
        accessors,
        groups,
      };

      return this.putStruct(namePath, struct);
    }
    if (input.type === "CustomErrorDefinition") {
      const { name, fields: _fields, namePath } = <ErrorType>input;
      const { fields, size, dynamic } = this.handleFields(_fields);

      const error: AbiError = {
        meta: "error",
        size,
        dynamic,
        name,
        fields,
      };
      return this.putError(namePath, error as AbiError);
    }
    if (input.type === "FunctionDefinition") {
      const { stateMutability, visibility, name, namePath, _ast } = <
        FunctionType
      >input;
      // console.log(`${name} | ${namePath} | ${_ast.name}`);
      if (_ast.isConstructor) {
        console.log(`FOUND CONSTRUCTOR\n`.repeat(10));
      }
      const inputs = this.handleFields(input.input);
      const outputs = this.handleFields(input.output);
      inputs.fields.forEach((field, i) => {
        if (!field.name) field.name = `input${i}`;
      });
      outputs.fields.forEach((field, i) => {
        if (!field.name) field.name = `output${i}`;
      });
      const fn: AbiFunction = {
        meta: "function",
        name,
        stateMutability,
        visibility,
        input: inputs,
        output: outputs,
        _ast,
      };
      return this.putFunction(namePath, fn);
    }
    if (input.type === "EventDefinition") {
      const { name, namePath } = <EventType>input;
      const { fields, dynamic, size } = this.handleFields(input.fields) as any;
      const event: AbiEvent = {
        meta: "event",
        name,
        fields,
        dynamic,
        size,
      };
      return this.putEvent(namePath, event);
    }
    if (input.type === "StateVariableDeclaration") {
      const [member] = input.members;
      const {
        visibility,
        typeName,
        name,
        namePath,
        isStateVar,
        isDeclaredConst,
        isImmutable,
        storageLocation,
      } = member;
      if (visibility === "public") {
        if (typeName.type === "Mapping") {
          // console.log(`Processing mapping as function: ${name}`);
          const { keys, value } = this.handleMapping(
            typeName as AstMappingType
          );
          const inputs = this.handleFields(keys);
          const outputs = this.handleFields([value]);

          const stateVariable: StateVariable = {
            meta: "statevar",
            name,
            visibility,
            type: {
              meta: "mapping",
              keyTypes: inputs.fields.map((i) => i.type),
              valueType: outputs.fields[0].type,
            },
            isStateVar,
            isDeclaredConst,
            isImmutable,
            storageLocation,
          };

          // if (name === "allowance") throw Error();
          const fn: AbiFunction = {
            meta: "function",
            name: `fn_${name}`,
            input: inputs,
            output: outputs,
            visibility,
            stateMutability: "view",
            stateVariable,
          };
          this.putStateVariable(namePath, stateVariable);

          return this.putFunction(namePath, fn);
        } else {
          const abiType = this.convertFieldType(typeName);

          const stateVariable: StateVariable = {
            meta: "statevar",
            name,
            visibility,
            type: abiType,
            isStateVar,
            isDeclaredConst,
            isImmutable,
            storageLocation,
          };

          const fn: AbiFunction = {
            meta: "function",
            name: `fn_${name}`,
            input: { fields: [], dynamic: false, size: 0 },
            output: this.handleFields([
              {
                typeName,
                name: `_${name}`,
                coderType: "checked",
              },
            ]),
            visibility,
            stateMutability: "view",
            stateVariable,
          };
          this.putStateVariable(namePath, stateVariable);

          return this.putFunction(namePath, fn);
        }
      }
      return;
    }
    throw new Error(`Did not recognize type of ${input}`);
  }

  convertFieldType(typeName: TypeName): AbiType {
    try {
      return convertFieldType.bind(this)(typeName, this.structs, this.enums);
    } catch (err) {
      console.log(`ERR ON ${typeName.name}`);
      console.log(typeName);
      throw err;
    }
  }

  putStruct(namePath: string, struct: AbiStruct) {
    this.structs[namePath] = struct;
    if (this.pendingStructs[namePath]) {
      delete this.pendingStructs[namePath];
    }
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

  putStateVariable(namePath: string, stateVariable: StateVariable) {
    this.stateVariables[namePath] = stateVariable;
    return stateVariable;
  }
}

// export function parseCode<AllowErrors extends true | false = false>(
//   sourceCode: string
// ): AbiType<AllowErrors>[] {
//   const { nodes: input } = Parser.parseFile(sourceCode);
//   const handler = new ParserWrapper(input);
//   return handler.allStructs;
// }

export function parseCode(sourceCode: string): {
  functions: AbiFunction[];
  errors: AbiError[];
  structs: AbiType<true>[];
  events: AbiEvent[];
  stateVariables: StateVariable[];
  name?: string;
} {
  const { nodes: input, name } = Parser.parseFile(sourceCode);
  const handler = new ParserWrapper(input);
  return {
    functions: handler.allFunctions,
    errors: handler.allErrors,
    structs: handler.allStructs,
    events: handler.allEvents,
    stateVariables: handler.allStateVariables,
    name,
  };
}
