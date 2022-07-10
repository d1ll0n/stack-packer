import { Accessors, CoderType, GroupType } from "./parser/types";

export type AbiStructField = {
  name: string;
  type: AbiType;
  coderType: CoderType;
  accessors?: Accessors
}

export type AbiStruct = {
  meta: 'struct';
  name: string;
  fields: AbiStructField[];
  dynamic?: boolean;
  size?: number;
  coderType: CoderType;
  accessors?: Accessors
  groups: GroupType[]
}

export type AbiEventField = AbiStructField & { isIndexed: boolean };

export type AbiEvent = {
  meta: 'event';
  name: string;
  fields: AbiEventField[]
  dynamic?: boolean;
  size?: boolean;
}

export type StructGroup = {
  name: string;
  coderType: CoderType;
  accessors?: Accessors;
  members: AbiStructField[]
}

export type AbiFunction = {
  meta: 'function';
  name: string;
  stateMutability: 'pure' | 'constant' | 'payable' | 'view' | null;
  visibility: 'default' | 'external' | 'internal' | 'public' | 'private';
  input: {
    fields: AbiStructField[];
    dynamic?: boolean;
    size?: number;
  }
  output: {
    fields: AbiStructField[];
    dynamic?: boolean;
    size?: number;
  }
}

export type AbiErrorField = {
  name: string;
  type: AbiType<false>;
}

export type AbiError = {
  meta: 'error';
  name: string;
  fields: AbiErrorField[];
  dynamic?: boolean;
  size?: number;
}

export type AbiArray = {
  meta: 'array';
  baseType: AbiType;
  length?: number;
  dynamic?: boolean;
  size?: number;
}

export type BasicElementaryType = 'bool' | 'byte' | 'bytes' | 'uint' | 'address' | 'int';

export type AbiElementaryType = {
  meta: 'elementary';
  type: BasicElementaryType;
  dynamic?: boolean;
  size?: number;
}

export type AbiEnum = {
  meta: 'enum';
  name: string;
  fields: string[];
  dynamic: false;
  size?: number;
}

export type AbiType<
  AllowErrors extends true|false = false,
  AllowEvents extends true|false = false
> = AbiStruct | AbiArray | AbiElementaryType | AbiEnum
| (AllowErrors extends true ? AbiError : never)
| (AllowEvents extends true ? AbiEvent : never);

export type ArrayJoinInput<T = string> = Array<ArrayJoinInput<T>> | Array<T> | T;

export type AccessorOptions = {
  setterName: string;
  getterName: string;
  generateGetter: boolean;
  generateSetter: boolean;
  getterCoderType?: CoderType;
  setterCoderType?: CoderType;
}

export type ProcessedField =
  AbiStructField & AccessorOptions & {
    offset: number;
    readFromWord: string;
    positioned: string;
    update: string;
    parameterDefinition: string;
    structName: string;
    assignment: string;
    originalName: string;
    maxValueReference: string;
    omitMaskReference: string;
    getOverflowCheck: (fieldReference: string) => string
  };

export type ProcessedGroup = GroupType & AccessorOptions & {
  fields: ProcessedField[]
  omitMaskReference: string;
}

export type ProcessedStruct = Omit<Omit<AbiStruct, "fields">, "groups"> & AccessorOptions & {
  fields: ProcessedField[];
  groups: ProcessedGroup[]
}

export type SolGenState = {
  currentIndex: number;
  variableDefinitions: string[];
  struct: AbiStruct;
  codeChunks: ArrayJoinInput;
  returnLine: string;
}

export type CodeGenFunction = {
  name: string
  natspecLines?: string[]
  inputs: { definition: string; name: string; type: AbiType; }[]
  outputs: { definition: string; name: string; type: AbiType; }[]
  visibility?: 'view' | 'pure'
  location: 'external' | 'public' | 'internal'
  body: ArrayJoinInput<string>
  internalType: 'getter' | 'setter'
  inputFields: ProcessedField[]
  outputFields: ProcessedField[]
}