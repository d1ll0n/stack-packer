export type AbiStructField = {
  name: string;
  type: AbiType;
}

export type AbiStruct = {
  meta: 'struct';
  name: string;
  fields: AbiStructField[];
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
  dynamic?: boolean;
  size?: number;
}

export type AbiType = AbiStruct | AbiArray | AbiElementaryType | AbiEnum;

export type ArrayJoinInput<T = string> = Array<ArrayJoinInput<T>> | Array<T> | T;

export type SolGenState = {
  currentIndex: number;
  variableDefinitions: string[];
  struct: AbiStruct;
  codeChunks: ArrayJoinInput;
  returnLine: string;
}