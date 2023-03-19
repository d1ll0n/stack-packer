/* eslint-disable no-template-curly-in-string */
/* eslint-disable no-prototype-builtins */
import { writeFileSync } from "fs";
import path from "path";
import { arrJoiner } from "../lib/text";
import groups from "./groups.json";

interface X {
  getA: () => void;
  getB: () => void;
}

const ArithmeticPrototypes = {
  getA: function (this: { a: number }) {
    if (!this.a) this.a = 1;
    else this.a++;
  },
  getB: function (this: { a: number }) {
    console.log("a: " + this.a.toString());
  },
};

const ArithmeticCapabilities = <
  OldClass,
  TFunction extends { new (...args: Array<any>): OldClass }
>(
  Class: TFunction & { new (...args: Array<any>): OldClass }
): TFunction & { new (...args: Array<any>): OldClass & X } => {
  Reflect.ownKeys(ArithmeticPrototypes).forEach((key) => {
    const newPrototype: OldClass & X = Class.prototype;
    Reflect.setPrototypeOf(Class, newPrototype);
    if (key !== "constructor") {
      if (Class.prototype.hasOwnProperty(key))
        console.warn(
          `Warning: mixin property overrides ${Class.name}.${String(key)}`
        );
      Object.defineProperty(
        Class.prototype,
        key,
        Object.getOwnPropertyDescriptor(ArithmeticPrototypes, key)
      );
    }
  });
  return Class as TFunction & { new (...args: Array<any>): OldClass & X };
};

// const codeT = `
// export interface ExpressionAccessors {
//   __data_iface__
//   __arithmetic_iface__
// }

// export interface ExpressionAccessors implements ArithmeticAccessors, DataAccessors {}

// export interface YulIdentifier implements ExpressionAccessors {}
// export interface YulTypedName implements ExpressionAccessors {}
// export interface YulLiteral implements ExpressionAccessors {}
// export interface YulFunctionCall implements ExpressionAccessors {}
// `;

type GroupKey = typeof groups[number]["name"];
type Op = typeof groups[number]["ops"][number];

const getOpFn = (op: Op) => {
  const parameters = op.parameters
    .slice(1)
    .map((param) => `${param}: CastableToYulExpression`);
  parameters.unshift(`this: YulExpression`);
  const paramString = parameters.join(", ");
  const interfaceFunction = `${op.name}(${paramString}): YulFunctionCall;`;
  const args =
    op.parameters.length > 1
      ? `this, ...definitelyIdentifierOrLiteralList([${op.parameters
          .slice(1)
          .join(", ")}])`
      : "this";
  const protoFunction = [
    `${op.name}: function (${paramString}) {`,
    [
      `return new YulFunctionCall(BuiltinFunctionIds.${op.name}, [this, ${args}])`,
    ],
    `},`,
  ];
  return { interfaceFunction, protoFunction };
};

function groupFunctions(name: GroupKey) {
  const interfaceBody = [];
  const prototypesBody = [];
  const { ops } = groups.find((group) => group.name === name);
  ops.forEach((op) => {
    const { interfaceFunction, protoFunction } = getOpFn(op);
    interfaceBody.push(interfaceFunction);
    prototypesBody.push(protoFunction);
  });
  return { interfaceBody, prototypesBody };
}

/* for (const op of ops) {
  const parameters = op.parameters
    .slice(1)
    .map((param) => `${param}: CastableToYulExpression`);
  parameters.unshift(`this: YulExpression`);
  const paramString = parameters.join(", ");
  const interfaceFunction = `${op.name}(${paramString}): YulFunctionCall;`;
  const argsString = op.parameters.length
    ? `...definitelyIdentifierOrLiteralList([${op.parameters
        .slice(1)
        .join(", ")}])`
    : "";
  interfaceBody.push(interfaceFunction);
  const fnDef = [
    `${op.name}: function (${paramString}) {`,
    [
      `return new YulFunctionCall(BuiltinFunctionIds.${op.name}, [this, ${argsString}])`,
    ],
    `},`,
  ];
  ArithmeticPrototypesInner.push(fnDef);
} */

// ArithmeticPrototypesInner.unshift(`const ArithmeticPrototypes = {`);
// ArithmeticPrototypesInner.push("}");
const data = groupFunctions("data");
const arithmetic = groupFunctions("arithmetic");

const codeFile = [
  `/* eslint-disable no-prototype-builtins */`,
  `import { BuiltinFunctionIds } from "./builtin";`,
  `import { CastableToYulExpression, definitelyIdentifierOrLiteralList } from "./utils";`,
  `import { YulExpression, YulFunctionCall } from "./ast";`,
  "",
  `const ArithmeticPrototypes = {`,
  arithmetic.prototypesBody,
  "}",
  "",
  `const DataPrototypes = {`,
  data.prototypesBody,
  "}",
  "",
  `const ExpressionPrototypes = {`,
  [`...DataPrototypes`, `...ArithmeticPrototypes`],
  `}`,
  "",
  `interface ArithmeticAccessors {`,
  arithmetic.interfaceBody,
  "}",
  "",
  `interface DataAccessors {`,
  data.interfaceBody,
  "}",
  `export interface ExpressionAccessors implements ArithmeticAccessors, DataAccessors {}`,
  "",
  "export const withExpressionAccessors = <",
  "  OldClass,",
  "  TFunction extends { new (...args: Array<any>): OldClass }",
  ">(",
  "  Class: TFunction & { new (...args: Array<any>): OldClass }",
  "): TFunction & { new (...args: Array<any>): OldClass & ExpressionAccessors } => {",
  "  Reflect.ownKeys(ExpressionPrototypes).forEach((key) => {",
  "    const newPrototype: OldClass & ExpressionAccessors = Class.prototype;",
  "    Reflect.setPrototypeOf(Class, newPrototype);",
  '    if (key !== "constructor") {',
  "      if (Class.prototype.hasOwnProperty(key))",
  "        console.warn(",
  "          `Warning: mixin property overrides ${Class.name}.${String(key)}`",
  "        );",
  "      Object.defineProperty(",
  "        Class.prototype,",
  "        key,",
  "        Object.getOwnPropertyDescriptor(ExpressionPrototypes, key)",
  "      );",
  "    }",
  "  });",
  "  return Class as TFunction & { new (...args: Array<any>): OldClass & ExpressionAccessors };",
  "};",
];

writeFileSync(path.join(__dirname, "iface.ts"), arrJoiner(codeFile));
// type XKey = keyof X;

// function setProto(value: T) {
//   return function <K extends string>(target: Record<K, T>, key: K) {
//       target[key] = value;
//   };
// }

// function addProto()
// type p = Proto;

/* @mixin
export class ABC {
  public a: number;
}

// eslint-disable-next-line no-redeclare
export interface ABC extends X {}

ABC.prototype.getA = function (this: ABC) {
  if (!this.a) this.a = 1;
  else this.a++;
};

ABC.prototype.getB = function (this: ABC) {
  console.log("a: " + this.a.toString());
};

const abc = new ABC();
abc.getA();
abc.getB();
 */
