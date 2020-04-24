import { AbiType, AbiStruct, ArrayJoinInput, AbiStructField, AbiEnum } from "./types";

export const bitsRequired = (n: number): number => {
  let a = Math.ceil(Math.log2(n + 1));
  let m = a % 8;
  return (m == 0) ? a : a + 8 - m
}

export const elementaryToTypeDef = (typeName: string): AbiType => {
  const isBool = /bool/g.exec(typeName);
  if (isBool) return {
    meta: 'elementary',
    dynamic: false,
    size: 8,
    type: 'bool'
  }
  const isUint = /uint(\d{0,2})/g.exec(typeName);
  if (isUint) {
    const size = isUint[1];
    return {
      meta: 'elementary',
      dynamic: !size,
      size: size ? +size : null,
      type: 'uint'
    }
  }
  const isBytes = /bytes(\d{0,2})/g.exec(typeName);
  if (isBytes) {
    console.log(`got bytes -- ${isBytes[0]} -- size ${8 * +isBytes[1]}`)
    const size = isBytes[1];
    return {
      meta: 'elementary',
      dynamic: !size,
      size: size ? 8 * (+size) : null,
      type: 'bytes'
    }
  }
}

export const toTypeName = (def: AbiType): string => {
  if (def.meta == 'elementary') {
    switch(def.type) {
      case 'uint': return `uint${def.size}`;
      case 'bool': return `bool`;
      case 'byte': return `byte`;
      case 'bytes': return `bytes${def.size / 8}`;
    }
  }
  if (def.meta == 'array') return `${toTypeName(def.baseType)}[${def.length || ''}]`;
  return def.name;
}

export const abiStructToSol = (struct: AbiStruct | AbiEnum): ArrayJoinInput<string> => {
  let arr: ArrayJoinInput = [];
  if (struct.meta == 'enum') {
    let size = 7 + struct.name.length + struct.fields.reduce((sum, f) => sum + f.length, 0);
    if (size < 60) arr = [[`enum ${struct.name} { ${struct.fields.join(', ')} }`].join('')]
    else arr = [
      `enum ${struct.name} {`,
      struct.fields.map(f => `${f},`),
      // struct.fields.map(f => `${f},`),
      `}`
    ];
  }
  else arr = [
    `struct ${struct.name} {`,
    struct.fields.map(field => `${toTypeName(field.type)} ${field.name};`),
    `}`
  ];
  return arr;
}

export const scopedName = (def: AbiStructField, scopeName?: string): string => [scopeName, def.name].filter(x => x).join('_');

export function arrJoiner(arr: ArrayJoinInput) {
  const ret: string[] = [];
  const doMap = (subArr: ArrayJoinInput<string>, depth = 0) => {
    if (Array.isArray(subArr)) for (let x of subArr) doMap(x, depth + 1);
    else if (subArr.length > 0) ret.push(`${'\t'.repeat(depth)}${subArr}`)
    else ret.push('');
  }
  for (let x of arr) doMap(x);
  return ret.join(`\n`)
}

/**
 * Returns the solidity code needed to build the struct, assuming the variable names are already assigned.
 * @example Using the structs below:
 * - getFieldConstructor(ABC, 'a') should yield `ABC(a_a)`
 * - getFieldConstructor(DEF) should yield `DEF(ABC(a_a), ABC(b_a))
 * - struct ABC { uint256 a; }
 * - struct DEF { ABC a; ABC b;}
 * @param struct abi struct definition
 */
export const getFieldConstructor = (struct: AbiStruct, scopeName?: string): string => {
  let arr: string[] = [];
  for (let field of struct.fields) {
    let name = scopedName(field, scopeName);
    if (field.type.meta == 'struct') arr.push(getFieldConstructor(field.type, name));
    else arr.push(scopedName(field, scopeName))
  }
  return `${struct.name}(${arr.join(', ')})`
}

/**
 * If a struct has an array field, it will only be unpackable if the array
 * has a static size or comes at the end of the struct definition.
 * @param struct Struct definition.
 */
export const isStructAllowed = (struct: AbiStruct): boolean => {
  let len = struct.fields.length;
  // return struct.fields.filter((field, i) => field.type.dynamic && i != len - 1).length > 0
  for (let i = 0; i < len; i++) {
    const field = struct.fields[i];
    if (field.type.dynamic) {
      /* If field is dynamic and not at the end of the struct, it is not allowed. */
      if (i != len - 1) return false;
      /* If field is at the end of the struct but is composed of unacceptable child fields, it is not allowed. */
      if (field.type.meta == 'array' && field.type.baseType.dynamic) return false;
      if (field.type.meta == 'struct' && !isStructAllowed(field.type)) return false;
    }
  }
  return true;
}