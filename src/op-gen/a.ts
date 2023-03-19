/* eslint-disable no-useless-constructor */
// import { ABC } from "./gen-code";

// const abc = new ABC();
// abc.getA()
// abc.getA()
// abc.getB()
// const def = new ABC()
// def.getA()
// def.getB()

class BaseClass {
  constructor(public id: number, public value: string) {}
}

class ABC extends BaseClass {
  constructor(public name: string, id: number, value: string) {
    super(id, value);
  }
}

type AllButLastTwo<Args extends any[]> = Args["length"] extends 0
  ? undefined
  : Args extends [...infer I, number, string]
  ? I
  : never;

// type X = AllButLastTwo<ConstructorParameters<typeof ABC>>;

export type NodeConstructor<T extends ABC = ABC> = new (
  value: string,
  id: number,
  ...args: any[]
) => T;

// type SomeConstructor<
//   SomeClassDef
// > = SomeClassDef extends { new (...args: any[]): infer SomeClass }
//   ? [SomeClass, ConstructorParameters<SomeClassDef>]
//   : never;

type AllButLastTwoConstructorParameters<
  SomeClassDef extends { new (...args: any[]): any }
> = AllButLastTwo<ConstructorParameters<SomeClassDef>>;

type UpdatedConstructor<SomeClassDef> = SomeClassDef extends {
  new (...args: any[]): infer SomeClass;
}
  ? {
      new (
        id: number,
        src: string,
        ...rest: AllButLastTwoConstructorParameters<SomeClassDef>
      ): SomeClass;
    }
  : never;

export function getModifiedYulConstructor<
  SomeClass extends { new (...args: any[]): BaseClass }
>(C: SomeClass): UpdatedConstructor<SomeClass> {
  class ModifiedClass extends C {
    constructor(...args: any[]) {
      const [id, src, ...rest] = args as [
        number,
        string,
        ...AllButLastTwo<ConstructorParameters<SomeClass>>
      ];
      super(...rest, id, src);
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    ModifiedClass.prototype.constructor,
    "name"
  );
  Object.defineProperty(ModifiedClass.prototype.constructor, "name", {
    ...descriptor,
    value: C.prototype.constructor.name,
  });

  return ModifiedClass as any;
}

console.log(ABC.prototype.constructor.toString())

// function getNewABC() {
//   const OldAbc = ABC;
//   const getNewClass = <SomeClass extends { new (...args: any[]): BaseClass }>(
//     C: SomeClass
//   ): UpdatedConstructor<SomeClass> => {
//     class ABCDef extends C {
//       constructor(...args: any[]) {
//         const [id, value, ...rest] = args as [
//           number,
//           string,
//           ...AllButLastTwo<ConstructorParameters<SomeClass>>
//         ];
//         super(...rest, id, value);
//       }
//     }
//     const descriptor = Object.getOwnPropertyDescriptor(
//       ABCDef.prototype.constructor,
//       "name"
//     );
//     Object.defineProperty(ABCDef.prototype.constructor, "name", {
//       ...descriptor,
//       value: C.prototype.constructor.name,
//     });

//     return ABCDef as any as UpdatedConstructor<SomeClass>;
//   };
//   const UpdatedClass = getNewClass(ABC);
//   const obj = new UpdatedClass(10, "value", "my-name");
//   console.log({
//     id: obj.id,
//     value: obj.value,
//     name: obj.name,
//   });
//   console.log(obj instanceof ABC);
//   console.log(obj.constructor.name);
// }

// getNewABC();
// const val = new Ax("value", 10);

// const getACtor = (typeCtor: ) => {
//   function ABC
// }

// DEF.prototype
