/* eslint-disable no-prototype-builtins */
import { writeFileSync } from "fs";
import path from "path";
import { arrJoiner } from "../lib/text";
import groups from "./groups.json";
import allops from "./ops.json";
const identifiersObjectInner = [];
for (const op of allops) {
  identifiersObjectInner.push(
    `get ${op.name}() {`,
    [`return new YulIdentifier("${op.name}");`],
    `},`
  );
}

const identifiersObject = [
  `import { YulIdentifier } from "./ast";`,
  "",
  `export const BuiltinFunctionIds = {`,
  identifiersObjectInner,
  `};`,
  "",
];

writeFileSync(path.join(__dirname, "builtin.ts"), arrJoiner(identifiersObject));

interface X {
  getA: () => void;
  getB: () => void;
}

const mixin =
  <B extends X>(behaviour: B) =>
  <OldClass, TFunction extends { new (...args: Array<any>): OldClass }>(
    Class: TFunction & { new (...args: Array<any>): OldClass }
  ): TFunction & { new (...args: Array<any>): OldClass & X } => {
    // Reflect.defineProperty(Class.prototype, "getA", behaviour.getA);
    // Reflect.defineProperty(Class.prototype, "getB", behaviour.getB);
    Reflect.ownKeys(behaviour).forEach((key) => {
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
          Object.getOwnPropertyDescriptor(behaviour, key)
        );
      }
    });
    return Class as TFunction & { new (...args: Array<any>): OldClass & X };
  };

// // type XKey = keyof X;

// // function setProto(value: T) {
// //   return function <K extends string>(target: Record<K, T>, key: K) {
// //       target[key] = value;
// //   };
// // }

// // function addProto()
// // type p = Proto;

// const ArithmeticPrototypes = {
//   getA: function (this: { a: number }) {
//     if (!this.a) this.a = 1;
//     else this.a++;
//   },
//   getB: function (this: { a: number }) {
//     console.log("a: " + this.a.toString());
//   },
// };

// @mixin(ArithmeticPrototypes)
// export class ABC {
//   public a: number;
// }

// // eslint-disable-next-line no-redeclare
// export interface ABC extends X {}

// ABC.prototype.getA = function (this: ABC) {
//   if (!this.a) this.a = 1;
//   else this.a++;
// };

// ABC.prototype.getB = function (this: ABC) {
//   console.log("a: " + this.a.toString());
// };

// const abc = new ABC();
// abc.getA();
// abc.getB();
