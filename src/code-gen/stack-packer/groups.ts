import { CoderType, GroupType } from "../../parser/types";
import { AbiStruct, ProcessedField } from "../../types";

import { getParameterDefinition } from "./fields";

export const resolveGroupMembers = (
  struct: AbiStruct,
  group: GroupType,
  fields: ProcessedField[]
): ProcessedField[] => {
  const fieldCopies: ProcessedField[] = [];
  for (const member of group.members) {
    const field = fields.find((field) => field.name === member.name);
    if (!field)
      throw Error(
        `Member ${member.name} of group ${group.name} not found in ${struct.name}`
      );

    // Shallow copy because we won't need to modify nested values
    const fieldCopy = { ...field };

    // If group member defines coder type, it will override the group's coder type
    // and the coder type of the original field in the struct.
    // If group defines coder type, it will override the coder type of the original
    // field in the struct.
    if (member.coderType) applyCoderType(fieldCopy, member.coderType);
    else if (group.coderType) applyCoderType(fieldCopy, group.coderType);

    fieldCopies.push(fieldCopy);
  }
  return fieldCopies;
};

export const applyGroupAccessCoder = (
  group: GroupType,
  fields: ProcessedField[],
  groupCoderLocation: "get" | "set"
) => {
  const groupCoderType =
    groupCoderLocation === "get"
      ? group.accessors?.getterCoderType
      : group.accessors?.setterCoderType;

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const member = group.members[i];
    // If group member defines coder type, it will override the group's coder type
    // and the coder type of the original field in the struct.
    // If group defines coder type, it will override the coder type of the original
    // field in the struct.
    if (member.coderType) applyCoderType(field, member.coderType);
    else if (groupCoderType) applyCoderType(field, groupCoderType);
  }
};

export const applyCoderType = (field: ProcessedField, coderType: CoderType) => {
  field.coderType = coderType;
  field.parameterDefinition = getParameterDefinition(field);
};
