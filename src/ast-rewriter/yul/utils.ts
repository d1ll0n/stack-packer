/* eslint-disable no-redeclare */
import { coerceArray } from "../../lib/text";
import { isNumeric } from "../../type-utils";
import { LiteralKind, VariableDeclaration } from "solc-typed-ast";
import { MaybeArray } from "../../lib/array";
import { simplifyYulExpression } from "./mathjs";
import { TypeCheck } from "../types";
import { YulExpression, YulIdentifier, YulLiteral, YulNode } from "./ast";

export type CastableToIdentifierOrLiteral = YulNode | string | number;

export type CastableToYulExpression = YulExpression | string | number;

export const isYulExpression = (node: YulNode): node is YulExpression => {
  return [
    "YulIdentifier",
    "YulTypedName",
    "YulLiteral",
    "YulFunctionCall",
  ].includes(node.nodeType);
};

export function resolveConstantValue(
  node: CastableToIdentifierOrLiteral,
  numeric: true
): bigint | undefined;
export function resolveConstantValue(
  node: CastableToIdentifierOrLiteral
): string | undefined;
export function resolveConstantValue(
  node: CastableToIdentifierOrLiteral,
  numeric: false
): string | undefined;
export function resolveConstantValue(
  node: CastableToIdentifierOrLiteral,
  numeric?: boolean
): bigint | string | undefined {
  let value: string;
  if (typeof node === "number" || typeof node === "string") {
    value = node.toString();
  } else if (node instanceof YulLiteral) {
    value = node.value.toString();
  } else if (node instanceof YulIdentifier) {
    const { vReferencedDeclaration } = node;
    if (
      vReferencedDeclaration instanceof VariableDeclaration &&
      vReferencedDeclaration?.constant
    ) {
      const { vValue } = vReferencedDeclaration;
      if (vValue && TypeCheck.isLiteral(vValue)) {
        return vValue.value;
      }
    }
  }
  if (value !== undefined) {
    return numeric ? (isNumeric(value) ? BigInt(value) : undefined) : value;
  }
}

export function isConstant(node: CastableToIdentifierOrLiteral) {
  return resolveConstantValue(node) !== undefined;
}

export function smartAdd(
  _a: CastableToYulExpression,
  _b: CastableToYulExpression
) {
  const [a, b] = definitelyExpressionList([_a, _b]);
  return simplifyYulExpression(a.add(b));
}

export function smartMul(
  _a: CastableToYulExpression,
  _b: CastableToYulExpression
) {
  const [a, b] = definitelyExpressionList([_a, _b]);
  return simplifyYulExpression(a.mul(b));
}

/* //////////////////////////////////////////////////////////////
                       Factory Helper Methods
  ////////////////////////////////////////////////////////////// */

export function makeYulLiteral(value: string | number): YulLiteral {
  return new YulLiteral(LiteralKind.String, value);
}

export function makeYulIdentifier(name: string): YulIdentifier {
  return new YulIdentifier(name);
}

export function definitelyIdentifier<T>(
  identifier: string | T
): T | YulIdentifier {
  if (typeof identifier === "string") {
    return makeYulIdentifier(identifier);
  }
  return identifier;
}

export function definitelyLiteral<T>(
  literal: string | number | T
): T | YulLiteral {
  if (isNumeric(literal)) {
    return makeYulLiteral(literal);
  }
  return literal;
}

export function definitelyIdentifierList<T>(
  identifier: MaybeArray<string | T>
): (T | YulIdentifier)[] {
  return coerceArray(identifier).map((item) => definitelyIdentifier(item));
}

export function definitelyExpression<T>(
  identifier: string | number | T
): YulExpression {
  if (isNumeric(identifier)) {
    return makeYulLiteral(identifier);
  }
  if (typeof identifier === "string") {
    return makeYulIdentifier(identifier);
  }
  return identifier as YulExpression;
}

export function definitelyExpressionList<T>(
  identifier: MaybeArray<string | number | T>
): YulExpression[] {
  return coerceArray(identifier).map((item) => definitelyExpression(item));
}
