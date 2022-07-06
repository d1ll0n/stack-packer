export type StructFieldType = 'ElementaryTypeName' | 'UserDefinedTypeName' | 'ArrayTypeName';

export type Length = {
  type: 'NumberLiteral',
  number: number,
}

export type Accessors = {
  getterCoderType?: CoderType
  setterCoderType?: CoderType
}

export type TypeName = {
  type: StructFieldType;
  baseTypeName?: TypeName;
  name?: string;
  namePath?: string;
  length?: Length | null;
}

export type CoderType = 'checked' | 'unchecked' | 'exact';

export type StructField = {
  name: string;
  typeName: TypeName;
  coderType: CoderType;
  accessors?: Accessors
}

export type GroupMemberType = {
  name: string;
  coderType?: CoderType;
}

export type GroupType = {
  name: string;
  coderType?: CoderType;
  accessors?: Accessors;
  members: GroupMemberType[]
}

export type ParameterType = EnumType | StructType | StructField;

export type DefinedType = EnumType | StructType | FunctionType | ErrorType | EventType

export type EnumType = {
  type: 'EnumDefinition';
  name: string;
  namePath: string;
  fields: string[];
}

export type ErrorParameter = StructField;

export type ErrorType = {
  type: 'CustomErrorDefinition';
  name: string;
  namePath: string;
  fields: ErrorParameter[];
}

export type StructType = {
  type: 'StructDefinition';
  name: string;
  namePath: string;
  fields: StructField[];
  coderType: CoderType;
  accessors?: Accessors
  groups: GroupType[]
}

export type FunctionType = {
  type: "FunctionDefinition";
  stateMutability: 'pure' | 'constant' | 'payable' | 'view' | null;
  visibility: 'default' | 'external' | 'internal' | 'public' | 'private';
  name: string;
  namePath: string;
  input: StructField[]
  output: StructField[]
}

export type EventParameter = StructField & { isIndexed: boolean; }

export type EventType = {
  type: 'EventDefinition';
  name: string;
  namePath: string;
  fields: EventParameter[];
}