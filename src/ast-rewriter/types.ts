import { ASTNode, ASTNodeFactory } from "solc-typed-ast";
import { YulNode } from "./yul";

export type ASTNodeFactoryMap = {
  [K in keyof ASTNodeFactory]: ASTNodeFactory[K] extends (
    ...args: any
  ) => ASTNode
    ? ReturnType<ASTNodeFactory[K]>
    : never;
};
export type addPrefix<TKey, TPrefix extends string> = TKey extends string
  ? "" extends TKey
    ? never
    : `${TPrefix}${TKey}`
  : never;

export type removePrefix<
  TPrefixedKey extends string,
  TPrefix extends string
> = TPrefixedKey extends addPrefix<infer TKey, TPrefix>
  ? TKey extends ""
    ? never
    : TKey
  : never;

type addSuffix<
  TKey extends string,
  TSuffix extends string
> = TKey extends string
  ? "" extends TKey
    ? never
    : `${TKey}${TSuffix}`
  : never;
// ? `${TKey}${TSuffix}`
// : never;v

export type Prefixed<
  TPrefixedKey extends string,
  TPrefix extends string
> = TPrefixedKey extends addPrefix<infer TKey, TPrefix> ? TPrefixedKey : never;

export type NotPrefixed<
  TPrefixedKey extends string,
  TPrefix extends string
> = TPrefixedKey extends addPrefix<infer TKey, TPrefix> ? TPrefixedKey : never;

// type removeSuffix<
//   TSuffixedKey extends string,
//   TSuffix extends string
// > = TSuffixedKey extends addSuffix<infer TKey, TSuffix> ? TKey : never;

export type ASTNodeFactoryMethod = keyof ASTNodeFactoryMap;

type KeysWithPrefix = removePrefix<keyof ASTNodeFactoryMap, "make">;

export type ASTMapDirect = {
  [K in KeysWithPrefix]: ASTNodeFactoryMap[addPrefix<K, "make">];
};

export type ASTNodeTypeMap = {
  [K in keyof ASTMapDirect]: ASTMapDirect[K] & { type: K };
};
// [K in removePrefix<
// keyof ASTNodeFactoryMap,
// "make"
// >]: ASTNodeFactoryMap[addPrefix<K, "make">] & { type: K };

export type ASTNodeTypeString = keyof ASTNodeTypeMap;
export type ASTNodeType = ASTNodeTypeMap[ASTNodeTypeString];

export type StringOrNumberAttributes<T extends ASTNodeType | YulNodeType> = {
  [K in keyof T]: T[K] extends string | number ? T[K] : never;
};

export type ASTNodeWithSuffix<
  K extends ASTNodeTypeString,
  TSuffix extends string
> = K extends `${infer P}${TSuffix}` ? `${P}${TSuffix}` : never;

export type ASTTypeNameString = ASTNodeWithSuffix<
  ASTNodeTypeString,
  "TypeName"
>;
export type ASTTypeNameNode = ASTMapDirect[ASTTypeNameString];

/* export type TypeNames = {
  [K in keyof ASTNodeTypeMap as K extends `${infer P}TypeName`
    ? `${P}TypeName`
    : never]?: ASTNodeTypeMap[K]["type"];
  // removeSuffix<K, "TypeName">
  // ? never
  // : ASTNodeTypeMap[K];

  // ASTNodeFactoryMap[addPrefix<K, "make">] & { type: K };
}; */

type CheckMap = {
  [K in ASTNodeTypeString as `is${K}`]: (
    node: ASTNode
  ) => node is ASTMapDirect[K];
};

export const TypeCheck = Object.getOwnPropertyNames(ASTNodeFactory.prototype)
  .filter((key) => key.match(/^make\w+/))
  .reduce((obj, key) => {
    const type = key.replace("make", "") as ASTNodeTypeString;
    obj[`is${type}`] = (node: ASTNode) => node.type === type;
    return obj;
  }, {}) as CheckMap;

// console.log("ASTNodeFactory");
// console.log(Object.getOwnPropertyNames(ASTNodeFactory.prototype));
// const [k, v] = Object.entries(new ASTNodeFactory()).filter(([key]) =>
//   key.match(/^make/g)
// )[0];
// console.log(`Key: ${k.match(/^make\w+/)}`);

export type YulNodeTypeMap = {
  [K in YulNode["nodeType"]]: YulNode & { nodeType: K };
};
export type YulNodeTypeString = keyof YulNodeTypeMap;
export type YulNodeType = YulNodeTypeMap[YulNodeTypeString];
