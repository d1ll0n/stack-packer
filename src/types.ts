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

// type AbiParameterType = AbiStruct<T> | AbiArray<T> | AbiElementaryType | AbiEnum

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

export type BasicElementaryType = 'bool' | 'byte' | 'bytes' | 'uint' | 'address';

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

export type SolGenState = {
  currentIndex: number;
  variableDefinitions: string[];
  struct: AbiStruct;
  codeChunks: ArrayJoinInput;
  returnLine: string;
}