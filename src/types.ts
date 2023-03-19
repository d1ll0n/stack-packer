import { EventDefinition, FunctionDefinition } from "@d1ll0n/solidity-parser";

import { Accessors, CoderType, GroupType } from "./parser/types";

export type Include<T, K extends (keyof T)[]> = Pick<T, K[number]>;

export type AbiOffsets = {
  /** @deprecated Use `memoryHeadOffset` and `calldataHeadOffset` */
  headOffset?: number;

  /** @description Offset to parameter in the head of its parent in memory. */
  memoryHeadOffset?: number;
  /** @description Offset to parameter in the head of its parent in calldata. */
  calldataHeadOffset?: number;

  /** @description Size of parameter's head in memory. */
  memoryHeadSize?: number;
  /** @description Size of parameter's head in calldata. */
  calldataHeadSize?: number;

  /** @description Minimum size of parameter's tail in memory. */
  memoryTailSize?: number;
  /** @description Minimum size of parameter's tail in calldata. */
  calldataTailSize?: number;

  canCopyHead?: boolean;
  canCopyTail?: boolean;

  headBytes?: number;
  minimumBytes?: number;
  bytes?: number;
  isFirstDynamicType?: boolean;
  /** Minimum offset within the tail of the parent. */
  minimumTailOffset?: number;
  tailPointsToLength?: boolean;
  dynamicChildrenDepth?: number;
  hasHeadInMemory?: boolean;
  hasHeadInCalldata?: boolean;
};

export type AbiStruct = AbiOffsets & {
  meta: "struct";
  name: string;
  fields: (AbiOffsets & {
    name: string;
    type: AbiType;
    coderType: CoderType;
    accessors?: Accessors;
  })[];
  dynamic?: boolean;
  size?: number;
  /**
   * @param memberHeadBytes Size of the members' head sizes
   */
  memberHeadBytes?: number;
  /** Size of child element's heads in calldata */
  memberHeadSizeCalldata?: number;
  /** Size of child element's heads in memory */
  memberHeadSizeMemory?: number;
  coderType: CoderType;
  accessors?: Accessors;
  groups: GroupType[];
};

export type AbiStructField = AbiStruct["fields"][number];

export type AbiArray = AbiOffsets & {
  meta: "array";
  baseType: AbiType;
  length?: number;
  dynamic?: boolean;
  size?: number;
  /** Size of child element's heads in calldata */
  memberHeadSizeCalldata?: number;
  /** Size of child element's heads in memory */
  memberHeadSizeMemory?: number;
};

export type BasicElementaryType =
  | "bool"
  | "byte"
  | "bytes"
  | "uint"
  | "address"
  | "int";

export type AbiElementaryType = AbiOffsets & {
  meta: "elementary";
  isString?: boolean;
  type: BasicElementaryType;
  dynamic?: boolean;
  size?: number;
};

export type AbiEnum = AbiOffsets & {
  meta: "enum";
  name: string;
  fields: string[];
  dynamic: false;
  size?: number;
};

export type AbiEventField = AbiStructField & { isIndexed: boolean };

export type AbiEvent = {
  meta: "event";
  anonymous?: boolean;
  name: string;
  fields: AbiEventField[];
  dynamic?: boolean;
  size?: number;
  _ast?: EventDefinition;
};

export type MappingType = {
  meta: "mapping";
  keyTypes: AbiType[];
  valueType: AbiType;
};

export type StructGroup = {
  name: string;
  coderType: CoderType;
  accessors?: Accessors;
  members: AbiStructField[];
};

export type AbiFunction = {
  meta: "function";
  name: string;
  stateMutability: "pure" | "constant" | "payable" | "view" | null;
  visibility: "default" | "external" | "internal" | "public" | "private";
  input: AbiOffsets & {
    fields: AbiStructField[];
    memberHeadBytes?: number;
    /** Size of child element's heads in calldata */
    memberHeadSizeCalldata?: number;
    /** Size of child element's heads in memory */
    memberHeadSizeMemory?: number;
    dynamic?: boolean;
    size?: number;
  };
  output: AbiOffsets & {
    fields: AbiStructField[];
    memberHeadBytes?: number;
    dynamic?: boolean;
    size?: number;
  };
  stateVariable?: StateVariable;
  _ast?: FunctionDefinition;
};

export type AbiErrorField = {
  name: string;
  type: AbiType<false>;
};

export type AbiError = {
  meta: "error";
  name: string;
  fields: AbiErrorField[];
  dynamic?: boolean;
  size?: number;
};

export type AbiType<
  AllowErrors extends true | false = false,
  AllowEvents extends true | false = false,
  AllowFunctions extends true | false = false
> =
  | AbiStruct
  | AbiArray
  | AbiElementaryType
  | AbiEnum
  | (AllowErrors extends true ? AbiError : never)
  | (AllowEvents extends true ? AbiEvent : never)
  | (AllowFunctions extends true ? AbiFunction : never);

export type ArrayJoinInput<T = string> =
  | Array<ArrayJoinInput<T>>
  | Array<T>
  | T;

export type AccessorOptions = {
  setterName: string;
  getterName: string;
  generateGetter: boolean;
  generateSetter: boolean;
  getterCoderType?: CoderType;
  setterCoderType?: CoderType;
};

export type ProcessedField = AbiStructField &
  AccessorOptions & {
    offset: number;
    readFromWord: string;
    positioned: string;
    update: string;
    parameterDefinition: string;
    structName: string;
    assignment: string;
    originalName: string;
    maxValueReference: string;
    omitMaskReference: string;
    getOverflowCheck: (fieldReference: string) => string;
  };

export type ParameterLocation =
  | "memory"
  | "calldata"
  | "storage"
  | "stack"
  | "returndata";

/* type LocatedField = {
  name: string;
  type: AbiType;
  src: ParameterLocation;
} */
/*   definition: string;
  offset: number;
  parameterDefinition: string;
  assignment: string[];
  strictDynamicValidation: string;
  overflowCheck: string; */

/**
 * Defines how the offset to a dynamic value (its length or the start of its tail)
 * is derived.
 */
export type StrictOffsetSummary =
  | {
      type: "constant";
      value: number;
    }
  | {
      // type:
    };

/*
For strict validation:
If value is an array of dynamic types:
- 
- If length can be derived from one calldata access, process the value inside a simple for loop.
    Track `nextOffset = startOffset`
*/

export type ProcessedCalldataField = {
  name: string;
  type: AbiType;
  definition: string;
  offset: number;
  parameterDefinition: string;
  assignment: string[];
  strictOffsetValidation: string;
  overflowCheck: string;
};

/* export type CalldataField = AbiStructField & {
  // getAbsolutePositionGetter
  offset: number;
  assignment: string;
  strictValidationExpression: string;
  // originalName: string;
  maxValueReference: string;
  omitMaskReference: string;
  getOverflowCheck: (fieldReference: string) => string;
} */

type CalldataElementaryType = {};

type CalldataArray = {
  headOffset: number;
};

// What if there's a fn to generate yul code to get an offset into a field

/*

If array/struct elements are non-dynamic:
- Copy entire buffer, then repair offset = ptr
If they are dynamic:
- 

struct A {
  uint256 a;
  bytes b;
  uint256[] c;
}

// let nextTailOffset = ``
let structHeadSize = params.length * 32;
let nextTailBaseOffset
for (let i in params) {
  let declareLength = i < params.length - 1;
  let head = i * 32;
  let tailOffset = 
  if (params[i].dynamic) {
    if (params[i] === 'array' || 'bytes' || params[i] == 'string']) {

    }
  }
}

let ptr := 0x04

// Minimum size = 160 bytes

// STRICT
let b_length := calldataload(0x60)
let c_length := calldataload(add(0x80, b_length))
calldatacopy(dst, 0, add(0xa0, b_length, shl(5, c_length)))
let b_head_invalid := xor(mload(add(dst, 0x20)), 0x60)
let c_head_invalid := xor(mload(add(dst, 0x40)), 0x80)
if or(b_head_invalid, c_head_invalid) {
  revert(0, 0)
}
mstore(add(dst, 0x20), add(dst, 0x60))
mstore(add(dst, 0x40), add(dst, add(0x80, b_length)))

// NON STRICT
let b_cdptr := add(ptr, calldataload(add(ptr, 0x20)))
let b_length := calldataload(offset_b)
let c_cdptr := 

let len := add(
  160,
)
*/
// let structHeadSize = params.length * 32;
// let nextTailBaseOffset
// for (let i in params) {
//   let declareLength = i < params.length - 1;
//   let head = i * 32;
//   let tailOffset =
//   if (params[i].dynamic) {
//     if (params[i] === 'array' || 'bytes' || params[i] == 'string']) {

//     }
//   }
// }

/*
struct A {
  uint256 a;
  bytes b;
  uint256[] c;
}

let b_length := calldataload(0x60)
let c_length := calldataload(add(0x80, b_length))
calldatacopy(dst, 0, add(0xa0, b_length, shl(5, c_length)))
let b_head_invalid := xor(mload(add(dst, 0x20)), 0x60)
let c_head_invalid := xor(mload(add(dst, 0x40)), 0x80)
if or(b_head_invalid, c_head_invalid) {
  revert(0, 0)
}
mstore(add(dst, 0x20), add(dst, 0x60))
mstore(add(dst, 0x40), add(dst, add(0x80, b_length)))
*/

/*
struct C {
  bytes data;
  uint256 x;
}
struct A {
  uint256 a;
  bytes b;
  C[] c;
  bytes d;
}

uint256 constant RoundUp32Mask = 0xffffe0;

let minSize = sum(
  (params.filter(dynamic).length) * 64,
  ...params.filter(!dynamic).map(size)
)
let offsetBytes;
for (param of params) {
  if (param.dynamic) {
    expectedOffset = head_size + offsetBytes
    pushCode(
      invalid |= read(head) != expectedOffset
    )
    if (param.array) {
      pushCode(
        while (head < finalHead) {

        }
      )
    }
  }
}

For param:
- If dynamic:
-- Separate into function taking (dst, src)
---- 

Two options for copying partially dynamic values:
1. Copy head of dynamic parts first, then change offsets ptrs
- copy
- push mem ptr, add offset
- mload, add mem ptr, mstore
-- 5 ops
2. Just write ptr
- for each ptr to write:
- push cd ptr, add offset
- calldataload offset
- add mem ptr
- add mem ptr to mem offset, mstore
-- 6 ops

Copying 2 values:
- 6
- push mem ptr
- push cd ptr
- push length
- cd copy
- 18 gas

Load & write 2 values
- push cdptr / cdload / push mptr / mstore == 12
- push cdptr / push 32 / add / cdload / push mptr / add 32 / mstore == 21
- 30 total

Post-copy fix mptr:
- push mptr / push offset / add / mload / push mptr / add / push mptr / mstore == 24 gas

Copy costs an additional 3 gas total

Copy data:
- Get size of head

Copy array:
- Write heads 

function copy_validate_c_element(cdPtr, memPtr) -> invalid, dynamicSize {
  let data_offset := calldataload(cdPtr)
  invalid := xor(data_offset, 0x40)
  // mstore(memPtr, add(memPtr, 0x40))
  let data_length := calldataload(add(cdPtr, 0x40))
  // 0x120 = 0xe0 + 0x40
  // round up to nearest 32 bytes
  // copy(x, data.length, data.tail) to memPtr
  calldatacopy(memPtr, add(cdPtr, 0x20), add(0x40, data_length))
  
  let bytesUsed := and(add(x, 0x120), RoundUp32Mask)
  dynamicSize := 

}

function validate_A_c_strict(memPtr, headPtr, ) -> invalid, numBytes {
  let c_length := calldataload(add(0xa0, priorDynamicBytes))
  let headPtr := add(0xc0, priorDynamicBytes)
  let nextHeadPtr := headPtr
  let end := add(headPtr, mul(c_length, 0x20))
  // Each C has min 3 words for data.head,x,data.length
  numBytes := mul(c_length, 0x60)
  let nextExpectedOffset := mul(c_length, 0x20)

  for {} lt(nextHeadPtr, end) {nextHeadPtr := add(nextHeadPtr, 0x20)} {
    let tailOffset := calldataload(nextHeadPtr)
    // c[i].head == size(c[0:i]) + c.length*32
    invalid := or(invalid, xor(tailOffset, nextExpectedOffset))
    let tailPtr := add(headPtr, tailOffset)

  }
}

let b_length := calldataload(0x60)
let c_length := calldataload(add(0x80, b_length))


calldatacopy(dst, 0, add(0xa0, b_length, shl(5, c_length)))
let b_head_invalid := xor(mload(add(dst, 0x20)), 0x60)
let c_head_invalid := xor(mload(add(dst, 0x40)), 0x80)
if or(b_head_invalid, c_head_invalid) {
  revert(0, 0)
}
mstore(add(dst, 0x20), add(dst, 0x60))
mstore(add(dst, 0x40), add(dst, add(0x80, b_length)))
*/
class CopyGenerator {
  reusedAssignments: string[];
  currentParam: AbiStructField;
  params: AbiStructField[];
  currentCopy: {
    dst: string;
    src: string;
    length: number;
  };

  get headSize() {
    return this.params.length * 32;
  }

  stopCopy = () => {};
}
/*   AbiStructField & AccessorOptions & {
    offset: number;
    readFromWord: string;
    positioned: string;
    update: string;
    parameterDefinition: string;
    structName: string;
    assignment: string;
    originalName: string;
    maxValueReference: string;
    omitMaskReference: string;
    getOverflowCheck: (fieldReference: string) => string; */

// const getCopy = (
//   param: AbiType<true, true>,
//   pointer: number
// ) => {
//   const addExpressions = [];
//   if (param.meta === 'array') {

//   }
//   // Return next head ptr expression
//   if (param.type.dynamic) {

//   }
// }

export type ProcessedGroup = GroupType &
  AccessorOptions & {
    fields: ProcessedField[];
    omitMaskReference: string;
  };

export type ProcessedStruct = Omit<Omit<AbiStruct, "fields">, "groups"> &
  AccessorOptions & {
    fields: ProcessedField[];
    groups: ProcessedGroup[];
  };

export type SolGenState = {
  currentIndex: number;
  variableDefinitions: string[];
  struct: AbiStruct;
  codeChunks: ArrayJoinInput;
  returnLine: string;
};

export type CodeGenFunction = {
  name: string;
  modifiers?: string[];
  natspecLines?: string[];
  inputs: { definition: string; name: string; type?: AbiType }[];
  outputs: { definition: string; name: string; type?: AbiType }[];
  visibility: "default" | "external" | "internal" | "public" | "private";
  stateMutability?: "pure" | "constant" | "payable" | "view" | null;
  body: ArrayJoinInput<string>;
  internalType?: "getter" | "setter" | "comparison";
  virtual?: boolean;
  inputFields?: ProcessedField[];
  outputFields?: ProcessedField[];
};

export type StateVariable = {
  meta: "statevar";
  name: string;
  visibility: "external" | "internal" | "public" | "private";
  type: AbiType | MappingType;
  isStateVar: boolean;
  isDeclaredConst?: boolean;
  isImmutable: boolean;
  storageLocation: string | null;
};

export type Visibility = CodeGenFunction["visibility"];
