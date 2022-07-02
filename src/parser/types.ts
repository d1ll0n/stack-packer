export type StructFieldType = 'ElementaryTypeName' | 'UserDefinedTypeName' | 'ArrayTypeName';

export type Length = {
  type: 'NumberLiteral',
  number: number,
}

export type TypeName = {
  type: StructFieldType;
  baseTypeName?: TypeName;
  name?: string;
  namePath?: string;
  length?: Length | null;
}

export type StructField = {
  name: string;
  typeName: TypeName;
}

export type DefinedType<AllowFunctions extends true|false = false> = AllowFunctions extends true
  ? EnumType | StructType | FunctionType
  : EnumType | StructType;

export type EnumType = {
  type: 'EnumDefinition';
  name: string;
  namePath: string;
  fields: Array<string>;
}

export type StructType = {
  type: 'StructDefinition';
  name: string;
  namePath: string;
  fields: Array<StructField>;
}

export type FunctionType = Omit<StructType, "type"> & {
  type: "FunctionDefinition";
}