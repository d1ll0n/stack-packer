/* eslint-disable no-prototype-builtins */
import { BuiltinFunctionIds } from "./builtin";
import { CastableToYulExpression, definitelyIdentifierOrLiteralList } from "./utils";
import { YulExpression, YulFunctionCall } from "./ast";

const ArithmeticPrototypes = {
		add: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.add, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		mul: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mul, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		sub: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sub, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		div: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.div, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		sdiv: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sdiv, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		mod: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mod, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		smod: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.smod, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		addmod: function (this: YulExpression, y: CastableToYulExpression, m: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.addmod, [this, this, ...definitelyIdentifierOrLiteralList([y, m])])
		},
		mulmod: function (this: YulExpression, y: CastableToYulExpression, m: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mulmod, [this, this, ...definitelyIdentifierOrLiteralList([y, m])])
		},
		exp: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.exp, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		signextend: function (this: YulExpression, x: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.signextend, [this, this, ...definitelyIdentifierOrLiteralList([x])])
		},
		lt: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.lt, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		gt: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.gt, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		slt: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.slt, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		sgt: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sgt, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		eq: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.eq, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		iszero: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.iszero, [this, this])
		},
		and: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.and, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		or: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.or, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		xor: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.xor, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		not: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.not, [this, this])
		},
		byte: function (this: YulExpression, x: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.byte, [this, this, ...definitelyIdentifierOrLiteralList([x])])
		},
		shl: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.shl, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		shr: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.shr, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
		sar: function (this: YulExpression, y: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sar, [this, this, ...definitelyIdentifierOrLiteralList([y])])
		},
}

const DataPrototypes = {
		calldataload: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.calldataload, [this, this])
		},
		calldatasize: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.calldatasize, [this, this])
		},
		calldatacopy: function (this: YulExpression, src: CastableToYulExpression, size: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.calldatacopy, [this, this, ...definitelyIdentifierOrLiteralList([src, size])])
		},
		returndatasize: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.returndatasize, [this, this])
		},
		returndatacopy: function (this: YulExpression, src: CastableToYulExpression, size: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.returndatacopy, [this, this, ...definitelyIdentifierOrLiteralList([src, size])])
		},
		mload: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mload, [this, this])
		},
		mstore: function (this: YulExpression, value: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mstore, [this, this, ...definitelyIdentifierOrLiteralList([value])])
		},
		mstore8: function (this: YulExpression, value: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.mstore8, [this, this, ...definitelyIdentifierOrLiteralList([value])])
		},
		sload: function (this: YulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sload, [this, this])
		},
		sstore: function (this: YulExpression, value: CastableToYulExpression) {
			return new YulFunctionCall(BuiltinFunctionIds.sstore, [this, this, ...definitelyIdentifierOrLiteralList([value])])
		},
}

const ExpressionPrototypes = {
	...DataPrototypes
	...ArithmeticPrototypes
}

interface ArithmeticAccessors {
	add(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	mul(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	sub(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	div(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	sdiv(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	mod(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	smod(this: YulExpression, y: CastableToYulExpression): YulFunctionCall;
	addmod(this: YulExpression, y: CastableToYulExpression, m: CastableToYulExpression): YulFunctionCall;
	mulmod(this: YulExpression, y: CastableToYulExpression, m: CastableToYulExpression): YulFunctionCall;
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
	calldatacopy(this: YulExpression, src: CastableToYulExpression, size: CastableToYulExpression): YulFunctionCall;
	returndatasize(this: YulExpression): YulFunctionCall;
	returndatacopy(this: YulExpression, src: CastableToYulExpression, size: CastableToYulExpression): YulFunctionCall;
	mload(this: YulExpression): YulFunctionCall;
	mstore(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
	mstore8(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
	sload(this: YulExpression): YulFunctionCall;
	sstore(this: YulExpression, value: CastableToYulExpression): YulFunctionCall;
}
export interface ExpressionAccessors implements ArithmeticAccessors, DataAccessors {}

export const withExpressionAccessors = <
  OldClass,
  TFunction extends { new (...args: Array<any>): OldClass }
>(
  Class: TFunction & { new (...args: Array<any>): OldClass }
): TFunction & { new (...args: Array<any>): OldClass & ExpressionAccessors } => {
  Reflect.ownKeys(ExpressionPrototypes).forEach((key) => {
    const newPrototype: OldClass & ExpressionAccessors = Class.prototype;
    Reflect.setPrototypeOf(Class, newPrototype);
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
  return Class as TFunction & { new (...args: Array<any>): OldClass & ExpressionAccessors };
};