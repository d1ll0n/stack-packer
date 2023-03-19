import { getGroupOmissionMask } from "../../lib/bytes";
import { AbiStruct, ProcessedStruct, ProcessedGroup } from "../../types";
import { FileContext } from "../context";

import { getAccessorOptions } from "./accessors";
import { processFields } from "./fields";
import { resolveGroupMembers } from "./groups";

export const processStruct = (abiStruct: AbiStruct, context: FileContext) => {
  const fields = processFields(abiStruct, context);
  const struct: ProcessedStruct = {
    ...abiStruct,
    fields,
    ...getAccessorOptions(abiStruct.name, abiStruct.accessors),
    getterName: "decode",
    setterName: "encode",
    groups: [],
  };
  for (const abiGroup of abiStruct.groups) {
    const groupFields = resolveGroupMembers(struct, abiGroup, fields);
    const groupMask = getGroupOmissionMask(groupFields);
    const omitMaskName = `${struct.name}_${abiGroup.name}_maskOut`;
    const maskReference = context.addConstant(omitMaskName, groupMask);
    const group: ProcessedGroup = {
      ...abiGroup,
      fields: groupFields,
      ...getAccessorOptions(abiGroup.name, abiGroup.accessors),
      omitMaskReference: maskReference,
    };
    struct.groups.push(group);
  }
  return struct;
};
