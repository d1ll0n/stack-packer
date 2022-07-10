// import keccak256 from "keccak256";
// import { toHex } from "../lib/bytes";
// import { AbiArray, AbiElementaryType, AbiEnum, AbiStruct, AbiStructField, AbiType, ArrayJoinInput } from "../types";
// import { toTypeName } from "./fields";

// export const getTypeStringAndHash = ({ name, fields }: AbiStruct) => {
//   const typeString = `${name}(${fields.map(f => toTypeName(f.type).concat(` ${f.name}`)).join(',')})`;
//   const typeHash = `0x${keccak256(typeString).toString('hex')}`;
//   return {
//     typeString,
//     typeHash
//   }
// }

// /* 

// bytes[] memory arrB

// let outPtr := 0
// for () {
//   // Hash arrB[i] and write it to memory
//   keccak256(arrB[i])
// }

// */

// const iteratorNames = ['i', 'j', 'k', 'l', 'm']

// const singleWordTypes = ['enum', 'elementary'];
// const isElementaryType = (field: AbiType): field is AbiElementaryType | AbiEnum => singleWordTypes.includes(field.meta);

// function deriveHashElementaryType(
//   ref: FieldReference<AbiElementaryType | AbiEnum>,
//   outputPointerStatement: string,
//   outputPointerSummary: string
// ) {
//   const code: ArrayJoinInput<string>[] = [];
//   let hashStatement: string;
//   if (ref.field.dynamic) {
//     hashStatement = `keccak256(add(${ref.referenceStatement}, 0x20), mload(${ref.referenceStatement}))`;
//   } else if (ref.memory) {
//     hashStatement = `keccak256(${ref.referenceStatement}, 0x20)`
//   } else {
//     code.push(
//       `// Write ${ref.nameForComments} to first word of scratch space`,
//       `mstore(0, ${ref.referenceStatement})`,
//     );
//     hashStatement = `keccak256(0, 0x20)`
//   }
//   return [
//     ...code,
//     `// Hash ${ref.nameForComments} and write it to ${outputPointerSummary}`,
//     `mstore(`,
//     [
//       `${outputPointerStatement},`,
//       hashStatement
//     ],
//     ')'
//   ];
// }

// const getIterator = (depth: number) => {
//   let i: string;
//   if (depth > iteratorNames.length) {
//     const n = Math.floor(depth / iteratorNames.length).toString();
//     i = [iteratorNames[depth % iteratorNames.length], n].join('')
//   } else {
//     i = iteratorNames[depth];
//   }
//   return i;
// }

// function deriveHashStruct(
//   ref: FieldReference<AbiStruct>,
//   outputPointerStatement: string,
//   outputPointerSummary: string
// ) {

// }

// function deriveHashArrayType(
//   ref: FieldReference<AbiArray>,
//   outputPointerStatement: string,
//   outputPointerSummary: string
// ) {
//   // Handle arrays of single-word types
//   if (isElementaryType(ref.field.baseType) && !ref.field.baseType.dynamic) {
//     const [usedRef, usedFullLengthRef] = ref.field.length
//       ? [ref.referenceStatement, toHex(ref.field.length * 32)]
//       : [`add(${ref.referenceStatement}, 0x20)`, `mul(mload(${ref.referenceStatement}), 0x20)`]

//     return [
//       `// Hash ${ref.nameForComments} and write it to ${outputPointerSummary}`,
//       `mstore(`,
//       [
//         `${outputPointerStatement},`,
//         `keccak256(${usedRef}, ${usedFullLengthRef})`
//       ],
//       ')'
//     ]
//   }

//   if (!ref.field.length) {
//     const i = getIterator(ref.depth)
//     const lengthRef = `${ref.nameForVariables}Length`
//     const code: ArrayJoinInput<string>[] = [
//       `// Read length of ${ref.nameForComments} from memory`,
//       `let ${lengthRef} := mload(${ref.referenceStatement})`,
//       `// Create a variable to track position in ${ref.nameForComments}`,
//       `let ${ref.nameForVariables}HeadPtr := add(${ref.referenceStatement}, 0x20)`,
//       `for {let ${i} := 0} lt(${i}, ${lengthRef}) {${i} := add(${i}, 1)} {`,
//     ];
//   }
// }

// type FieldReference<T extends AbiType = AbiType> = {
//   field: T;
//   memory?: boolean;
//   referenceStatement: string;
//   nameForVariables: string;
//   nameForComments: string;
//   depth: number;
// }

// const getReadLengthWithComment = <T = true | false>(
//   ref: FieldReference<AbiArray>,
// ): [string[], string] => {
//   const varName = `${ref.nameForVariables}Length`
//   const code = [
//     `// Read length of ${ref.nameForComments} from memory`,
//     `let ${varName} := mload(${ref.referenceStatement})`,
//   ];
//   return [code, varName]
// }

// function deriveAssemblyBlockToHash(
//   field: AbiType,
//   fieldNameForComments: string,
//   fieldNameForVariables: string,
//   fieldReferenceStatement: string,
//   usableBufferPtr: string,
//   depth: number,
//   // Callback to generate code to handle the output
//   // either assign it to a variable or store it
//   getHashOutputHandler: (hashStatement: string) => string[]
// ) {
//   if (isElementaryType(field)) {
//     if (field.dynamic) {

//     }
//     return [
//       `// Write ${fieldNameForComments} to first word of scratch space`,
//       `mstore(0, ${fieldReferenceStatement})`,
//       ...getHashOutputHandler(`keccak256(0, 0x20)`)
//     ]
//   }
//   if (field.meta === 'array') {
//     if (isElementaryType(field.baseType)) {
//       const arrLength = field.length ? `mload(${})`
//     }
//     if (!field.length) {
      
//       let i: string;
//       if (depth > iteratorNames.length) {
//         const n = Math.floor(depth / iteratorNames.length).toString();
//         i = [iteratorNames[depth % iteratorNames.length], n].join('')
//       } else {
//         i = iteratorNames[depth];
//       }
//       const lengthRef = `${fieldNameForVariables}Length`
//       const code: ArrayJoinInput<string>[] = [
//         `// Read length of ${fieldNameForComments} from memory`,
//         `let ${lengthRef} := mload(${fieldReferenceStatement})`,
//         `// Create a variable to track position in ${fieldNameForComments}`,
//         `let ${fieldNameForVariables}HeadPtr := add(${fieldReferenceStatement}, 0x20)`,
//         `for {let ${i} := 0} lt(${i}, ${lengthRef}) {${i} := add(${i}, 1)} {`,

//       ];

//     }
//     return [

//     ]
//   }
// }

// /*
// struct MyData {
//   bytes[] memory arr;
//   uint256 x;
//   uint256 y;
// }
// let bufferPtr := mload(0x40)

// let len := mload(arr)
// let arrHeadPtr := add(arr, 0x20)
// for {let i := 0} lt(i, len) {i := add(i, 1)} {
//   let ptr := mload(arrHeadPtr)

// }
// */

// export function getEIP712DigestFunction(struct: AbiStruct) {
//   const { typeString, typeHash } = getTypeStringAndHash(struct);
//   const code: string[] = [];
//   for (const field of struct.fields) {
//     if (field.type.meta === 'array') {
//       if (field.type.)
//     }
//   }
// }