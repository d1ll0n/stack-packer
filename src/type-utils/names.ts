import { AbiStructField, AbiType, MappingType } from "../types";
import { isReferenceType } from "./type-check";

export const toTypeName = (
  def: AbiType | MappingType,
  roundToNearestByte?: boolean
): string => {
  if (def.meta === "mapping") {
    const keys = def.keyTypes.map((k) => toTypeName(k));
    let value = toTypeName(def.valueType);

    for (let i = keys.length - 1; i >= 0; i--) {
      value = `mapping(${keys[i]} => ${value})`;
    }
    return value;
  }
  if (def.meta === "elementary") {
    switch (def.type) {
      case "uint":
      case "int":
        let size = def.size;
        if (roundToNearestByte && size % 8) {
          size += 8 - (size % 8);
        }
        return `${def.type}${size}`;
      case "bool":
        return `bool`;
      case "byte":
        return `byte`;
      case "bytes":
        if (def.isString) return `string`;
        if (def.dynamic) return `bytes`;
        return `bytes${def.size / 8}`;
      case "address":
        return "address";
    }
  }
  if (def.meta === "array")
    return `${toTypeName(def.baseType)}[${def.length || ""}]`;
  return def.name;
};

export const toTypeStringForSignature = (def: AbiType) => {
  if (def.meta === "elementary") {
    switch (def.type) {
      case "uint":
      case "int":
        let size = def.size;
        if (size % 8) {
          size += 8 - (size % 8);
        }
        return `${def.type}${size}`;
      case "bool":
        return `bool`;
      case "byte":
        return `byte`;
      case "bytes":
        if (def.isString) return `string`;
        if (def.dynamic) return `bytes`;
        return `bytes${def.size / 8}`;
      case "address":
        return "address";
    }
  }
  if (def.meta === "array")
    return `${toTypeStringForSignature(def.baseType)}[${def.length || ""}]`;
  if (def.meta === "enum") {
    const size = def.size % 8 ? def.size + (8 - (def.size % 8)) : def.size;
    return `uint${size}`;
  }
  return `(${def.fields
    .map((f: AbiStructField) => toTypeStringForSignature(f.type))
    .join(",")})`;
};

export const getParamDefinition = (
  field: AbiStructField,
  location: "memory" | "calldata" | "(?:memory|calldata)",
  withoutName?: boolean
) => {
  const name = withoutName ? "" : ` ${field.name}`;
  if (isReferenceType(field.type)) {
    return `${toTypeName(field.type)} ${location}${name}`;
  }
  return `${toTypeName(field.type)}${name}`;
};

export const getHighLevelTypeString = (type: AbiType) => {
  if (type.meta === "array") {
    const arraySuffix = type.length?.toString();
    const arrayPrefix = type.dynamic && "dyn";
    return [
      arrayPrefix,
      "array",
      arraySuffix,
      getHighLevelTypeString(type.baseType),
    ]
      .filter(Boolean)
      .join("_");
    // `array_${arraySuffix}${getHighLevelTypeString(type.baseType)}`;
  }
  return toTypeName(type);
};
