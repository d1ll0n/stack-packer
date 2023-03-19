import { arrJoiner } from "../../lib/text";
import {
  expressionEq,
  mathStringToYul,
  simplifyYulExpression,
  yulToStringExpression,
} from "./mathjs";
import { makeYulIdentifier, makeYulLiteral } from "./utils";
import { PrettyFormatter } from "solc-typed-ast";

const formatter = new PrettyFormatter(2);

const compareAdd = (_a: string | number, _b: string | number, _c?: string) => {
  const a = typeof _a === "string" ? makeYulIdentifier(_a) : makeYulLiteral(_a);
  const b = typeof _b === "string" ? makeYulIdentifier(_b) : makeYulLiteral(_b);
  const smart = a.smartAdd(b);
  const simplified = simplifyYulExpression(a.add(b));
  if (expressionEq(smart, simplified) !== 1) {
    const str = arrJoiner([
      `smartAdd != simplifyYulExpression for ${_a} + ${_b}`,
      `smartAdd result: ${yulToStringExpression(smart)}`,
      `simplifyYulExpression result: ${yulToStringExpression(simplified)}`,
    ]);
    throw Error(str);
  }
  if (_c) {
    const c = mathStringToYul(_c);
    if (expressionEq(c, simplified) !== 1) {
      const str = arrJoiner([
        `${_a} + ${_b} !== ${_c}`,
        `actual: ${yulToStringExpression(simplified)}`,
        `expected: ${yulToStringExpression(c)}`,
      ]);
      throw Error(str);
    }
  }
  console.log(
    `(${a.type}: ${a.write(formatter)}) + (${b.type}: ${b.write(
      formatter
    )}) => ${smart.write(formatter)}`
  );
};
const compareMul = (_a: string | number, _b: string | number, _c: string) => {
  const a = typeof _a === "string" ? makeYulIdentifier(_a) : makeYulLiteral(_a);
  const b = typeof _b === "string" ? makeYulIdentifier(_b) : makeYulLiteral(_b);
  const simplified = simplifyYulExpression(a.mul(b));
  const c = mathStringToYul(_c);
  if (expressionEq(c, simplified) !== 1) {
    const str = arrJoiner([
      `${_a} + ${_b} !== ${_c}`,
      `actual: ${yulToStringExpression(simplified)}`,
      `expected: ${yulToStringExpression(c)}`,
    ]);
    throw Error(str);
  }
  console.log(
    `(${a.type}: ${a.write(formatter)}) + (${b.type}: ${b.write(
      formatter
    )}) => ${simplified.write(formatter)}`
  );
};

compareAdd("x", 10, "x+10");
compareAdd(10, "x", "x+10");

compareAdd("x", 0, "x");
compareAdd(0, "y", "y");

compareAdd(0, 1, "1");
compareAdd(1, 0, "1");

compareAdd("x", "y", "x+y");

compareMul(0, "y", "0");
compareMul("y", 0, "0");

compareMul("x", 1, "x");
compareMul(1, "x", "x");

compareMul(2, "x", "2*x");
compareMul("x", 2, "2*x");

compareMul("x", "y", "x*y");
compareMul("y", "x", "x*y");
