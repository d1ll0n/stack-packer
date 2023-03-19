/* eslint-disable no-prototype-builtins */
import { BuiltinFunctionIds } from "./builtin";

import {
  CastableToYulExpression,
  definitelyExpressionList,
  smartAdd,
  smartMul,
} from "./utils";
import { YulExpression, YulFunctionCall } from "./ast";

const ArithmeticPrototypes = {
  smartAdd: function (this: YulExpression, y: CastableToYulExpression) {
    return smartAdd(this, y);
  },
  smartMul: function (this: YulExpression, y: CastableToYulExpression) {
    return smartMul(this, y);
  },
  add: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.add, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  mul: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.mul, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  sub: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sub, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  div: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.div, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  sdiv: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sdiv, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  mod: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.mod, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  smod: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.smod, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  addmod: function (
    this: YulExpression,
    y: CastableToYulExpression,
    m: CastableToYulExpression
  ) {
    return new YulFunctionCall(BuiltinFunctionIds.addmod, [
      this,
      ...definitelyExpressionList([y, m]),
    ]);
  },
  mulmod: function (
    this: YulExpression,
    y: CastableToYulExpression,
    m: CastableToYulExpression
  ) {
    return new YulFunctionCall(BuiltinFunctionIds.mulmod, [
      this,
      ...definitelyExpressionList([y, m]),
    ]);
  },
  exp: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.exp, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  signextend: function (this: YulExpression, x: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.signextend, [
      this,
      ...definitelyExpressionList([x]),
    ]);
  },
  lt: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.lt, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  gt: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.gt, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  slt: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.slt, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  sgt: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sgt, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  eq: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.eq, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  iszero: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.iszero, [this]);
  },
  and: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.and, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  or: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.or, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  xor: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.xor, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  not: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.not, [this]);
  },
  byte: function (this: YulExpression, x: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.byte, [
      this,
      ...definitelyExpressionList([x]),
    ]);
  },
  shl: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.shl, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  shr: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.shr, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
  sar: function (this: YulExpression, y: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sar, [
      this,
      ...definitelyExpressionList([y]),
    ]);
  },
};

const DataPrototypes = {
  calldataload: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.calldataload, [this]);
  },
  calldatasize: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.calldatasize, [this]);
  },
  calldatacopy: function (
    this: YulExpression,
    src: CastableToYulExpression,
    size: CastableToYulExpression
  ) {
    return new YulFunctionCall(BuiltinFunctionIds.calldatacopy, [
      this,
      ...definitelyExpressionList([src, size]),
    ]);
  },
  returndatasize: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.returndatasize, [this]);
  },
  returndatacopy: function (
    this: YulExpression,
    src: CastableToYulExpression,
    size: CastableToYulExpression
  ) {
    return new YulFunctionCall(BuiltinFunctionIds.returndatacopy, [
      this,
      ...definitelyExpressionList([src, size]),
    ]);
  },
  mload: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.mload, [this]);
  },
  mstore: function (this: YulExpression, value: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.mstore, [
      this,
      ...definitelyExpressionList([value]),
    ]);
  },
  mstore8: function (this: YulExpression, value: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.mstore8, [
      this,
      ...definitelyExpressionList([value]),
    ]);
  },
  sload: function (this: YulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sload, [this]);
  },
  sstore: function (this: YulExpression, value: CastableToYulExpression) {
    return new YulFunctionCall(BuiltinFunctionIds.sstore, [
      this,
      ...definitelyExpressionList([value]),
    ]);
  },
};

export const ExpressionPrototypes = {
  ...DataPrototypes,
  ...ArithmeticPrototypes,
};

interface ArithmeticAccessors {
  smartAdd(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  smartMul(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  add(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  mul(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  sub(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  div(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  sdiv(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  mod(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  smod(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  addmod(
    this: YulExpression,
    y: CastableToYulExpression,
    m: CastableToYulExpression
  ): YulFunctionCall;
  mulmod(
    this: YulExpression,
    y: CastableToYulExpression,
    m: CastableToYulExpression
  ): YulFunctionCall;
  exp(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  signextend(this: YulExpression, x: CastableToYulExpression): YulFunctionCall;
  lt(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  gt(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  slt(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  sgt(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  eq(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  iszero(this: YulExpression): YulFunctionCall;
  and(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  or(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  xor(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  not(this: YulExpression): YulFunctionCall;
  byte(this: YulExpression, x: CastableToYulExpression): YulFunctionCall;
  shl(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  shr(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
  sar(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
}

interface DataAccessors {
  calldataload(this: YulExpression): YulFunctionCall;
  calldatasize(this: YulExpression): YulFunctionCall;
  calldatacopy(
    this: YulExpression,
    src: CastableToYulExpression,
    size: CastableToYulExpression
  ): YulFunctionCall;
  returndatasize(this: YulExpression): YulFunctionCall;
  returndatacopy(
    this: YulExpression,
    src: CastableToYulExpression,
    size: CastableToYulExpression
  ): YulFunctionCall;
  mload(this: YulExpression): YulFunctionCall;
  mstore(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
  mstore8(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
  sload(this: YulExpression): YulFunctionCall;
  sstore(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
}
export interface ExpressionAccessors
  extends ArithmeticAccessors,
    DataAccessors {}

export function mixin<B extends ArithmeticAccessors>(behaviour: B) {
  return function <
    OldClass,
    TFunction extends { new (...args: Array<any>): OldClass }
  >(
    Class: TFunction & { new (...args: Array<any>): OldClass }
  ): TFunction & {
    new (...args: Array<any>): OldClass & ArithmeticAccessors;
  } {
    // Reflect.defineProperty(Class.prototype, "getA", behaviour.getA);
    // Reflect.defineProperty(Class.prototype, "getB", behaviour.getB);
    Reflect.ownKeys(behaviour).forEach((key) => {
      const newPrototype: OldClass & ArithmeticAccessors = Class.prototype;
      Reflect.setPrototypeOf(Class, newPrototype);
      if (key !== "constructor") {
        if (Class.prototype.hasOwnProperty(key))
          console.warn(
            `Warning: mixin property overrides ${Class.name}.${String(key)}`
          );
        Object.defineProperty(
          Class.prototype,
          key,
          Object.getOwnPropertyDescriptor(behaviour, key)
        );
      }
    });
    return Class as TFunction & {
      new (...args: Array<any>): OldClass & ArithmeticAccessors;
    };
  };
}

// export function withExpressionAccessors() {
//   mixin(ExpressionPrototypes);
// }

export const withExpressionAccessors = <
  OldClass,
  TFunction extends { new (...args: Array<any>): OldClass }
>(
  Class: TFunction & { new (...args: Array<any>): OldClass }
): TFunction & {
  new (...args: Array<any>): OldClass & ExpressionAccessors;
} => {
  Reflect.ownKeys(ExpressionPrototypes).forEach((key, i) => {
    // const newPrototype: OldClass & ExpressionAccessors = Class.prototype;
    // Reflect.setPrototypeOf(Class, newPrototype);
    if (key !== "constructor") {
      if (Class.prototype.hasOwnProperty(key))
        console.warn(
          `Warning: mixin property overrides ${Class.name}.${String(key)}`
        );
      Object.defineProperty(
        Class.prototype,
        key,
        Object.getOwnPropertyDescriptor(ExpressionPrototypes, key)
      );
    }
  });
  return Class as TFunction & {
    new (...args: Array<any>): OldClass & ExpressionAccessors;
  };
};
