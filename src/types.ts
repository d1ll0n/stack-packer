
export type AbiStructField<T extends string | string[] = string[]> = {
  name: string;
  type: AbiType;
  group?: T;
}

export type AbiStruct<T extends string | string[] = string[]> = {
  meta: 'struct';
  name: string;
  fields: AbiStructField<T>[];
  dynamic?: boolean;
  size?: number;
}

export type AbiArray<T extends string | string[] = string[]> = {
  meta: 'array';
  baseType: AbiType<T>;
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

export type AbiType<T extends string | string[] = string[]> = AbiStruct<T> | AbiArray<T> | AbiElementaryType | AbiEnum;

export type ArrayJoinInput<T = string> = Array<ArrayJoinInput<T>> | Array<T> | T;

export type SolGenState = {
  currentIndex: number;
  variableDefinitions: string[];
  struct: AbiStruct;
  codeChunks: ArrayJoinInput;
  returnLine: string;
}