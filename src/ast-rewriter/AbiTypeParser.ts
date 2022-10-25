import { bitsRequired } from "../lib/bytes";
import { elementaryToTypeDef } from "../parser";
import {
  AbiArray,
  AbiEnum,
  AbiEventField,
  AbiStruct,
  AbiStructField,
  AbiType,
} from "../types";
import {
  ArrayTypeName,
  ASTNode,
  ElementaryTypeName,
  EnumDefinition,
  FunctionTypeName,
  Literal,
  StructDefinition,
  TypeName,
  UserDefinedTypeName,
  VariableDeclaration,
} from "solc-typed-ast";
import {
  ASTMapDirect,
  ASTTypeNameNode,
  ASTTypeNameString,
  TypeCheck,
} from "./types";

function isLiteral(node: ASTNode): node is Literal {
  return node.type === "Literal";
}

function parseStructDefinition(node: StructDefinition): AbiStruct {
  const { name, vMembers } = node;
  const { fields, size, dynamic } = parseMembers(vMembers);

  const struct: AbiType = {
    meta: "struct",
    size,
    dynamic,
    name,
    fields,
    coderType: "checked",
    groups: [],
  };
  return struct;
}

function parseEnumDefinition(node: EnumDefinition): AbiEnum {
  const fields = node.vMembers.map((member) => member.name);
  return {
    meta: "enum",
    name: node.name,
    fields,
    dynamic: false,
    size: bitsRequired(fields.length),
  } as AbiEnum;
}

const Parsers: {
  [K in ASTTypeNameString]: (typeName: ASTMapDirect[K]) => AbiType;
} = {
  ArrayTypeName: (node: ArrayTypeName) => {
    const { vLength, vBaseType } = node;
    if (!vBaseType) return null;
    let length: number;
    if (vLength && isLiteral(vLength)) {
      length = +vLength.value;
    }
    const baseType = Parsers[vBaseType.type](vBaseType);
    const size = baseType.size && length ? length * baseType.size : null;
    return {
      meta: "array",
      baseType,
      length: length && length,
      dynamic: size == null,
      size,
    } as AbiArray;
  },
  UserDefinedTypeName: (node: UserDefinedTypeName): AbiEnum | AbiStruct => {
    const referencedType = node.vReferencedDeclaration as
      | StructDefinition
      | EnumDefinition;
    if (TypeCheck.isEnumDefinition(referencedType)) {
      return parseEnumDefinition(referencedType);
    }
    return parseStructDefinition(referencedType);
  },
  ElementaryTypeName: (node: ElementaryTypeName) =>
    elementaryToTypeDef(node.typeString),
  FunctionTypeName: (node: FunctionTypeName) => {
    return undefined;
  },
};

export function parseTypeName(typeName: TypeName): AbiType {
  const parser = Parsers[typeName.type];
  if (!parser) {
    throw Error(`Can not parse type ${typeName.typeString}`);
  }
  return parser(typeName as ASTTypeNameNode);
}

function parseVariableDeclaration(
  field: VariableDeclaration
): AbiStructField | AbiEventField {
  const { name, vType, indexed } = field;
  const abiType = parseTypeName(vType);
  if (!abiType) return null;
  return {
    name,
    type: abiType,
    coderType: "checked",
    isIndexed: indexed,
  };
}

function parseMembers(fields: VariableDeclaration[]) {
  const outFields: AbiStructField[] = [];
  let size = 0;
  for (const field of fields) {
    const abiField = parseVariableDeclaration(field);
    outFields.push(abiField);
    if (abiField.type.size == null) size = null;
    else if (size != null) size += abiField.type.size;
  }
  return {
    fields: outFields,
    dynamic: size == null,
    size,
  };
}
