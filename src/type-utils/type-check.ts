import {
  AbiArray,
  AbiElementaryType,
  AbiEnum,
  AbiError,
  AbiErrorField,
  AbiEvent,
  AbiEventField,
  AbiFunction,
  AbiOffsets,
  AbiStruct,
  AbiType,
} from "../types";
import { sumBy } from "lodash";

export type DynamicBytes = AbiElementaryType & { type: "bytes"; dynamic: true };
type DynamicArray = AbiArray & { dynamic: true };
type DynamicStruct = AbiStruct & { dynamic: true };
type DynamicType = DynamicBytes | DynamicArray | DynamicStruct;
type TypeOrWrapper = AbiType | { type: AbiType };
export type AbiReferenceType = AbiArray | AbiStruct | DynamicBytes;
export type AbiValueType = AbiEnum | (AbiElementaryType & { dynamic: false });

/* //////////////////////////////////////////////////////////////
                              Helpers
////////////////////////////////////////////////////////////// */

const isType = (_t: TypeOrWrapper): _t is AbiType =>
  typeof (_t as any) !== "object";

export const extractType = (_t: TypeOrWrapper) => (isType(_t) ? _t : _t.type);

export const extractTypes = (_t: TypeOrWrapper[]) => _t.map(extractType);

/* //////////////////////////////////////////////////////////////
                         Static value types
  ////////////////////////////////////////////////////////////// */

export const isElementary = (_t: AbiType): _t is AbiElementaryType =>
  _t.meta === "elementary";

export const isStatic = (_t: AbiType): boolean => !_t.dynamic;

export const isUint = (_t: AbiType): _t is AbiElementaryType =>
  isElementary(_t) && _t.type === "uint";

export const isInt = (_t: AbiType): _t is AbiElementaryType =>
  isElementary(_t) && _t.type === "int";

export const isEnum = (_t: AbiType): _t is AbiEnum => _t.meta === "enum";

/* //////////////////////////////////////////////////////////////
                          Dynamic types
////////////////////////////////////////////////////////////// */

export const isDynamicBytes = (_t: AbiType): _t is DynamicBytes =>
  isElementary(_t) && _t.type === "bytes" && _t.dynamic;

export const isDynamic = (_t: AbiType): _t is DynamicType => _t.dynamic;

export const hasDynamicLength = (_t: AbiType): _t is AbiArray | DynamicBytes =>
  (isArray(_t) && !_t.length) || isDynamicBytes(_t);

// export const

export const isArray = (_t: AbiType): _t is AbiArray => _t.meta === "array";

export const isStruct = (_t: AbiType): _t is AbiStruct => _t.meta === "struct";

export const maxDynamicDepth = (_t: AbiType<true, true>) => {
  if (!_t.dynamic) return 0;
  if (isError(_t) || isEvent(_t))
    return Math.max(
      ..._t.fields.map((f: AbiErrorField | AbiEventField) =>
        maxDynamicDepth(f.type)
      )
    );
  if (isArray(_t)) return (_t.length ? 0 : 1) + maxDynamicDepth(_t.baseType);
  if (isStruct(_t)) {
    return (
      +_t.dynamic +
      Math.max(..._t.fields.map((field) => maxDynamicDepth(field.type)))
    );
  }
  return 1;
};

export const maxReferenceTypeDepth = (_t: AbiType<true, true>) => {
  if (isError(_t) || isEvent(_t))
    return Math.max(
      ..._t.fields.map((f: AbiErrorField | AbiEventField) =>
        maxReferenceTypeDepth(f.type)
      )
    );
  if (isValueType(_t)) return 0;
  if (isArray(_t)) return 1 + maxReferenceTypeDepth(_t.baseType);
  if (isStruct(_t)) {
    return (
      1 +
      Math.max(..._t.fields.map((field) => maxReferenceTypeDepth(field.type)))
    );
  }
  return 1;
};

export const isSequentiallyCopyableDynamic = (
  t: AbiType
): t is AbiArray | AbiElementaryType =>
  t.dynamic && t.dynamicChildrenDepth === 1;

export const canBeSequentiallyCopied = (t: AbiType) =>
  !t.dynamic || isSequentiallyCopyableDynamic(t);

export const canNotBeSequentiallyCopied = (t: AbiType) =>
  !canBeSequentiallyCopied(t);

export const isValueType = (t: AbiType): t is AbiValueType =>
  t.meta === "enum" || (t.meta === "elementary" && !t.dynamic);

export const isReferenceType = (t: AbiType): t is AbiReferenceType =>
  !isValueType(t);

export const typeHasHeadInMemory = (type: AbiType) => isReferenceType(type);

/*
  fixed struct has no head
  dynamic length, fixed struct array:
  - baseType has no head
  - array has head
  */
export const typeHasHeadInCalldata = (type: AbiType) => !type.bytes;

export const canCopyAllFromCalldata = (type: AbiType) => {
  if (!typeHasHeadInCalldata(type) && typeHasHeadInMemory(type)) return false;
  if (type.meta === "array") {
    return canCopyAllFromCalldata(type.baseType);
  } else if (type.meta === "struct") {
    const children = [...extractTypes(type.fields)];
    return !children.some((c) => !canCopyAllFromCalldata(c));
  }
  return true;
};

/* //////////////////////////////////////////////////////////////
                          Callable types
  ////////////////////////////////////////////////////////////// */

export const isFunction = (_t: AbiType<true, true, true>): _t is AbiFunction =>
  _t.meta === "function";

export const isError = (_t: AbiType<true, true, true>): _t is AbiError =>
  _t.meta === "error";

export const isEvent = (_t: AbiType<true, true, true>): _t is AbiEvent =>
  _t.meta === "event";

export const isCallableType = (
  _t: AbiType<true, true, true>
): _t is AbiError | AbiEvent | AbiFunction =>
  ["event", "function", "error"].includes(_t.meta);

/*
Copy static struct to memory = no offset repair
Copy struct in 
*/

export const isNumeric = <T = any>(
  value: number | string | T
): value is number | string =>
  typeof value === "number" ||
  (typeof value === "string" && !!value.match(/^(0x)?\d+$/));

/* //////////////////////////////////////////////////////////////
                      Offsets and real sizes
////////////////////////////////////////////////////////////// */

export const sumBytes = (types: AbiType[]) =>
  types.some((t) => t.bytes === undefined) ? undefined : sumBy(types, "bytes");

export const sumHeadBytes = (types: AbiType[]) => sumBy(types, "headBytes");

export const sumMinimumBytes = (types: AbiType[]) =>
  sumBy(types, "minimumBytes");

export const getCopyCost = (numFields: number) => 12 + 3 * numFields;
/*
s, d, d, d, d, s
12 + 18 = 30
vs.
15 + 15 = 30
vs.
If (intermediate + 1) * 3 > 12,

*/
export const getWriteCost = (
  numWords: number,
  startAtZeroOffset?: boolean,
  constantCdPtr?: boolean
) => {
  const wordCopyCost = +(!constantCdPtr && 6) + 18;
  let cost = 0;
  if (startAtZeroOffset) {
    // push cdptr, calldataload, push ptr, mstore
    cost += 12;
    numWords--;
  }
  // push cdptr, (push offset, add)?, calldataload, push ptr, push offset, add, mstore
  return cost + numWords * wordCopyCost;
};

export function addSizesToTuple(type: AbiStruct | AbiFunction["input"]) {
  const types = type.fields.map((f) => f.type);
  type.memberHeadBytes = 0;
  type.memberHeadSizeCalldata = 0;
  type.memberHeadSizeMemory = 0;
  type.calldataTailSize = 0;
  type.memoryTailSize = 0;
  type.canCopyHead = type.dynamic;
  type.canCopyTail = true;

  let minTailSize = 0;
  types.forEach((fieldType) => {
    setActualSizes(fieldType);

    // type.canCopyHead = type.canCopyHead && fieldType.canCopyHead;
    type.canCopyTail =
      type.canCopyTail && fieldType.canCopyHead && fieldType.canCopyTail;

    fieldType.calldataHeadOffset = type.memberHeadSizeCalldata;
    type.memberHeadSizeCalldata += fieldType.calldataHeadSize;
    // type.calldataHeadSize += fieldType.calldataHeadSize;
    type.calldataTailSize += fieldType.calldataTailSize;
    /* + fieldType.calldataTailSize; */

    fieldType.memoryHeadOffset = type.memberHeadSizeMemory;
    type.memberHeadSizeMemory += 32;
    type.memoryTailSize += fieldType.memoryHeadSize + fieldType.memoryTailSize;

    fieldType.headOffset = type.memberHeadBytes;
    type.memberHeadBytes += fieldType.headBytes;

    if (fieldType.dynamic) {
      fieldType.isFirstDynamicType = minTailSize === 0;
      fieldType.minimumTailOffset = minTailSize;
      minTailSize += 32;
    }
    // type.memoryTailSize = memberHeadSizeMemory
  });
  // type.memoryHeadOffset
  type.headBytes = type.dynamic ? 32 : type.memberHeadBytes;
  // type.calldataHeadSize = type.dynamic ? 32 : type.memberHeadSizeCalldata;
  if (type.dynamic) {
    type.calldataHeadSize = 32;
    type.calldataTailSize += type.memberHeadSizeCalldata;
  } else {
    type.calldataHeadSize = type.memberHeadSizeCalldata;
    // type.calldataTailSize += type.memberHeadSizeCalldata;
  }
  type.memoryHeadSize = 32;

  Object.assign(type, {
    bytes: sumBytes(types),
    // headBytes: sumHeadBytes(types),
    minimumBytes: sumMinimumBytes(types),
  });
}

export const setActualSizes = (type: AbiType<true, true, true>) => {
  if (!isCallableType(type) && isReferenceType(type)) {
    type.tailPointsToLength = hasDynamicLength(type);
    type.dynamicChildrenDepth = maxDynamicDepth(type);
  }
  switch (type.meta) {
    case "array": {
      const { baseType, length } = type;
      setActualSizes(baseType);
      type.minimumBytes = 32;
      // const isEmbeddedInCalldata = Boolean(baseType.bytes) && Boolean(length);
      // type.hasHeadInCalldata = !isEmbeddedInCalldata;
      // type.hasHeadInMemory = true;
      type.memoryHeadSize = 32;

      /*
      Array with dynamic length can be copied if base type can be copied

      */
      if (length) {
        type.bytes = baseType.bytes ? baseType.bytes * length : undefined;
        type.minimumBytes = baseType.minimumBytes * length;
        type.headBytes = type.bytes ?? 32; // @todo remove, deprecated

        // If size is unknown, cd head is offset, cd tail is data
        type.calldataHeadSize = type.bytes ?? 32; // item directly embedded or offset
        type.calldataTailSize = baseType.dynamic
          ? length * (32 + baseType.calldataTailSize)
          : 0;
        type.memoryTailSize = length * (32 + baseType.memoryTailSize);

        // Fixed size array can be copied only if the base type is
        // a reference type of unknown size,
        type.canCopyHead = baseType.dynamic;

        type.canCopyTail =
          baseType.dynamic && baseType.canCopyHead && baseType.canCopyTail;
        // baseType.canCopyTail && type.memoryTailSize === type.calldataTailSize;
        type.memberHeadSizeCalldata = baseType.dynamic
          ? length * 32
          : type.calldataHeadSize;
        // If type has known size, tail size in memory will be that size * 32
        // If type is reference type, add 32 for heads
        if (isReferenceType(baseType)) {
          type.memberHeadSizeMemory = 32 * length;

          if (baseType.bytes) {
            // type.mem;
          }
          // type.memberHeadSizeCalldata =
          // length * (32 + baseType.memoryTailSize);
        }
      } else {
        type.canCopyHead = true;
        type.canCopyTail =
          baseType.canCopyTail && (isValueType(baseType) || baseType.dynamic);
        type.calldataHeadSize = 32; // offset
        type.memoryHeadSize = 32; // ptr
        type.memoryTailSize = 32; // length
        type.calldataTailSize = 32;
      }
      break;
    }
    case "enum": {
      Object.assign(type, {
        bytes: 32,
        minimumBytes: 32,
        headBytes: 32,
        calldataHeadSize: 32,
        memoryHeadSize: 32,
        memoryTailSize: 0,
        calldataTailSize: 0,
        canCopyHead: true,
        // No tail, but this simplifies the process for checking nested copyability
        canCopyTail: true,
      } as Partial<AbiOffsets>);
      break;
    }
    case "elementary": {
      Object.assign(type, {
        bytes: type.dynamic ? undefined : 32,
        minimumBytes: 32,
        headBytes: 32,
        calldataHeadSize: 32,
        memoryHeadSize: 32,
        memoryTailSize: type.dynamic ? 32 : 0,
        calldataTailSize: type.dynamic ? 32 : 0,
        canCopyHead: true,
        canCopyTail: true,
      } as Partial<AbiOffsets>);
      break;
    }
    case "struct": {
      addSizesToTuple(type);
      break;
    }
    case "function": {
      addSizesToTuple(type.input);
      addSizesToTuple(type.output);
      break;
    }
  }
};
