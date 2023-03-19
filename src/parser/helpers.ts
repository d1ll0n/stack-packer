import _ from "lodash";
import {
  AbiArray,
  AbiElementaryType,
  AbiEnum,
  AbiStruct,
  AbiStructField,
  AbiType,
  StructGroup,
} from "../types";

import { GroupType, TypeName } from "./types";

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
      dynamic: false, // @todo re-evaluate why this was set to !size
      size: size ? +size : null,
      type: "uint",
    };
  }
  const isInt = /int(\d{0,3})/g.exec(typeName);
  if (isInt) {
    const size = isInt[1];
    if (!size || +size % 8)
      throw Error(`Signed ints must have size that is a multiple of 8`);
    return {
      meta: "elementary",
      dynamic: false,
      size: size ? +size : null,
      type: "int",
    };
  }
  const isString = typeName === "string";
  const isBytes = /bytes(\d{0,2})/g.exec(typeName) || isString;
  if (isBytes) {
    const size = isBytes[1];
    return {
      meta: "elementary",
      dynamic: !size,
      size: size ? 8 * +size : null,
      type: "bytes",
      isString,
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

export const buildGroup = (
  struct: AbiStruct,
  group: GroupType
): StructGroup => {
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
};

export function convertFieldType(
  typeName: TypeName,
  structs: Record<string, AbiStruct>,
  enums: Record<string, AbiEnum>,
  useAbiSize?: boolean
): AbiType {
  const { type, baseTypeName, name, namePath, length } = typeName;
  switch (type) {
    case "ArrayTypeName":
      const baseType = convertFieldType(
        baseTypeName,
        structs,
        enums,
        useAbiSize
      );
      if (!baseType) return null;
      const size =
        baseType.size && length ? length.number * baseType.size : null;
      return {
        meta: "array",
        baseType,
        length: length && length.number,
        dynamic: size == null,
        size,
      } as AbiArray;
    case "ElementaryTypeName":
      return elementaryToTypeDef(name) as AbiElementaryType;
    case "UserDefinedTypeName":
      return _.cloneDeep(structs[namePath] || enums[namePath] || null);
  }
}
