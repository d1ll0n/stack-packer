import { FileContext } from "../code-gen/context";
// import { getMaxUintForField } from "../code-gen/fields";
import { AbiType } from "../types";

import { hasDynamicLength, maxDynamicDepth } from "./type-check";

import "../lib/String";
import { sumBy } from "lodash";

export type AbiPositionData = {
  headOffset: number;
  baseTailOffset?: number;
  hasDynamicLength?: boolean;
  dynamicDepth?: number;
};

// const setActualSizes = (type: AbiType) => {
//   type.tailPointsToLength = hasDynamicLength(type);
//   if (type.dynamic) type.dynamicChildrenDepth = maxDynamicDepth(type);
//   switch (type.meta) {
//     case "array": {
//       const { baseType, length } = type;
//       setActualSizes(baseType);
//       type.minimumBytes = 32;
//       if (length) {
//         type.bytes = baseType.bytes ? baseType.bytes * length : undefined;
//         type.minimumBytes = baseType.minimumBytes * length;
//       }
//       break;
//     }
//     case "enum": {
//       Object.assign(type, { bytes: 32, minimumBytes: 32 });
//       break;
//     }
//     case "elementary": {
//       Object.assign(type, {
//         bytes: type.dynamic ? undefined : 32,
//         minimumBytes: 32,
//       });
//       break;
//     }
//     case "struct": {
//       type.minimumBytes = 32;
//       type.bytes = 0;
//       for (const { type: member } of type.fields) {
//         setActualSizes(member);
//         type.minimumBytes += member.minimumBytes;
//         type.bytes =
//           member.bytes === undefined || type.bytes === undefined
//             ? undefined
//             : type.bytes + member.bytes;
//       }
//     }
//   }
// };

// export const addPositionDataToStruct = (param: AbiStruct): void => {
//   let offset: number = 0;
//   const headSize = param.fields.length * 32;
//   let baseTailOffset = headSize;
//   const fields: AbiTypeWithPosition[] = [];
//   for (const field of param.fields) {
//     const processed: AbiPositionData = {
//       ...field,
//       headOffset: offset,
//     };
//     // field.type
//     offset += 32;
//     if (field.type.dynamic) {
//       processed.baseTailOffset = baseTailOffset;
//       baseTailOffset += 32;
//       processed.hasDynamicLength = hasDynamicLength(field.type);
//       processed.dynamicDepth = maxDynamicDepth(field.type) - 1;
//     }
//     if (field.type.meta === "struct") {
//       const nextHeadPtr = `let nextHeadPtr := `;
//     }
//   }
// };

// export function copyFromCalldata(param: AbiStructField) {}

// function getCopyCode(
//   param: AbiStruct,
//   cdPtrReference?: string,
//   ptrReference?: string
// ) {
//   const offset: number = 0;
//   const headSize = param.fields.length * 32;
//   const baseTailOffset = headSize;
//   const headCopySize = 0;
//   const code = [``];
//   if (param.dynamic) {
//     const lastStatic = findLastIndex(
//       param.fields,
//       (field) => !field.type.dynamic
//     );
//     if (lastStatic !== -1) {
//     }

//     code.push(`let length := `);
//   }

//   const withCdOffset = (offset?: number) => {
//     if (param.dynamic) return `add(${cdPtrReference}, ${toHex(offset)})`;
//     return toHex(offset + 4);
//   };
//   if (!cdPtrReference) {
//     if (param.dynamic) {
//       code.push(`let cdPtr := add(0x04, calldataload(0x04))`);
//       cdPtrReference = `cdPtr`;
//     }
//   }
//   if (!ptrReference) {
//     code.push("let mPtr := mload(0x40)");
//     ptrReference = `mPtr`;
//   }
//   for (const field of param.fields) {
//     const depth = maxDynamicDepth(field.type);
//     console.log(`Depth of ${field.name} ${depth}`);
//     console.log((field.type as AbiArray).baseType.size);
//     console.log((field.type as AbiArray).size);
//     if (field.type.dynamic) {
//       break;
//     }
//   }
// }

// getCopy = (fields: AbiStructField[], constantCdPtr?: boolean) => {
// let headSize = 0;
// let minTailSize = 0;
// const types = fields.map(field => field.type);
/*     const lastStaticIndex = findLastIndex(fields, isStatic);
  const firstStaticIndex = findIndex(fields, isStatic); */

// const lastCopyableDynamic = findLast(types.filter(isDynamic), isSequentiallyCopyableDynamic);
// const firstStaticIndex = findIndex(types, isStatic);
// const lastStaticIndex = findLastIndex(types, isStatic);
// let tailCopyCount
// const copyCostWithTail = getCopyCost((headSize + copyableTailSize) / 32);
// const copyCost = getCopyCost( / 32);

// const lastSequentialCopyableDynamicField = fields.map(field => field.type).filter(isDynamic)
// const headAndTailCopyEnd = headOffset + firstNonCopyable.headOffset

// const {
//   canContinueCopyingTail,
//   headSize,
//   copyableTailSize,
//   tailCopies,
//   firstStaticIndex,
//   lastStaticIndex,
//   staticHeadStart,
//   staticHeadEnd,
// } = fields.reduce(
//   (allsiz, { type }, i) => {
//     if (type.dynamic) {
//       if (allsiz.canContinueCopyingTail) {
//         // @todo replace with dynamic depth
//         if (type.meta === "elementary") {
//           allsiz.copyableTailSize += 32;
//           allsiz.tailCopies++;
//         } else {
//           allsiz.canContinueCopyingTail = false;
//         }
//       }
//     } else {
//       // const { size } = getActualSizes(field.type)
//       if (i + 1 === length || fields[i + 1].type.dynamic) {
//         allsiz.lastStaticIndex = allsiz.lastStaticIndex ?? i;
//         allsiz.staticHeadEnd = allsiz.staticHeadEnd ?? allsiz.headSize + type.size;
//       }
//       allsiz.firstStaticIndex = allsiz.firstStaticIndex ?? i;
//       allsiz.staticHeadStart = allsiz.staticHeadStart ?? allsiz.headSize;
//     }
//     return allsiz;
//     // const headSize = field.type.dynamic
//     //   ? 32
//     //   : getActualSizes(field.type).size;
//   },
//   {
//     canContinueCopyingTail: true,
//     headSize: 0,
//     copyableTailSize: 0,
//     tailCopies: 0,
//     firstStaticIndex: undefined,
//     lastStaticIndex: undefined,
//     staticHeadStart: undefined,
//     staticHeadEnd: undefined
//   }
// );
// const endCopyableTail = copyableTailSize + staticHeadStart;

// const separatedTailCopyCost = getCopyCost(1) * tailCopies;
// const copyCostWithTail = getCopyCost((headSize + copyableTailSize) / 32);
// const headCopyCost = getCopyCost((staticHeadEnd - staticHeadStart) / 32);
// const writeCost = getWriteHeadCost(fields, constantCdPtr);
// minBy([
//   {type: 'copy', ptr: }
// ], ())
// if (writeCost < copyCostWithoutTail)
// };
