import {
  CustomErrorDefinition,
  EnumDefinition,
  EventDefinition,
  FunctionDefinition,
  StructDefinition,
  StateVariableDeclaration,
  StateVariableDeclarationVariable,
  VariableDeclaration,
} from "@d1ll0n/solidity-parser";

export type StructFieldType =
  | "ElementaryTypeName"
  | "UserDefinedTypeName"
  | "ArrayTypeName";

export type Length = {
  type: "NumberLiteral";
  number: number;
};

export type Accessors = {
  getterCoderType?: CoderType;
  setterCoderType?: CoderType;
};

export type AstMappingType = TypeName & {
  type: "Mapping";
};

export type TypeName = {
  type: StructFieldType | "Mapping";
  baseTypeName?: TypeName;
  name?: string;
  namePath?: string;
  length?: Length | null;
  keyType?: TypeName;
  valueType?: TypeName;
};

export type CoderType = "checked" | "unchecked" | "exact";

export type StructField = {
  name: string;
  typeName: TypeName;
  coderType: CoderType;
  accessors?: Accessors;
};

export type GroupMemberType = {
  name: string;
  coderType?: CoderType;
};

export type GroupType = {
  name: string;
  coderType?: CoderType;
  accessors?: Accessors;
  members: GroupMemberType[];
};

export type EnumType = {
  type: "EnumDefinition";
  name: string;
  namePath: string;
  fields: string[];
  _ast: EnumDefinition;
};

export type StateVariableVariableType = {
  type: "StateVariableDeclarationVariable";
  name: string;
  namePath: string;
  typeName: TypeName;
  visibility: VariableDeclaration["visibility"];
  isStateVar: boolean;
  isDeclaredConst?: boolean;
  isImmutable: boolean;
  storageLocation: string | null;
  _ast: StateVariableDeclarationVariable;
};

export type StateVariableType = {
  type: "StateVariableDeclaration";
  namePath: string;
  members: StateVariableVariableType[];
  _ast: StateVariableDeclaration;
};

export type ErrorParameter = StructField;

export type ErrorType = {
  type: "CustomErrorDefinition";
  name: string;
  namePath: string;
  fields: ErrorParameter[];
  _ast: CustomErrorDefinition;
};

export type StructType = {
  type: "StructDefinition";
  name: string;
  namePath: string;
  fields: StructField[];
  coderType: CoderType;
  accessors?: Accessors;
  groups: GroupType[];
  _ast: StructDefinition;
};

export type FunctionType = {
  type: "FunctionDefinition";
  stateMutability: "pure" | "constant" | "payable" | "view" | null;
  visibility: "default" | "external" | "internal" | "public" | "private";
  name: string;
  namePath: string;
  input: StructField[];
  output: StructField[];
  _ast: FunctionDefinition;
};

export type EventParameter = StructField & { isIndexed: boolean };

export type EventType = {
  type: "EventDefinition";
  name: string;
  namePath: string;
  fields: EventParameter[];
  _ast: EventDefinition;
};

/* export type ContractType = {
  name: string;
  functions
} */

export type ParameterType = EnumType | StructType | StructField;

export type DefinedType =
  | EnumType
  | StructType
  | FunctionType
  | ErrorType
  | EventType
  | StateVariableVariableType
  | StateVariableType;
