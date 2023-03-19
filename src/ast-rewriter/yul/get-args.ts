import "../../lib/String";
import {
  ArrayTypeName,
  Assignment,
  ASTNode,
  BinaryOperation,
  Block,
  Break,
  Conditional,
  Continue,
  DoWhileStatement,
  ElementaryTypeName,
  ElementaryTypeNameExpression,
  EmitStatement,
  ErrorDefinition,
  EventDefinition,
  ExpressionStatement,
  ForStatement,
  FunctionCall,
  FunctionCallOptions,
  FunctionDefinition,
  FunctionTypeName,
  Identifier,
  IdentifierPath,
  IfStatement,
  ImportDirective,
  IndexAccess,
  IndexRangeAccess,
  InheritanceSpecifier,
  InlineAssembly,
  Literal,
  Mapping,
  MemberAccess,
  ModifierDefinition,
  ModifierInvocation,
  NewExpression,
  OverrideSpecifier,
  ParameterList,
  PlaceholderStatement,
  PragmaDirective,
  Return,
  RevertStatement,
  SourceUnit,
  StructDefinition,
  StructuredDocumentation,
  Throw,
  TryCatchClause,
  TryStatement,
  TupleExpression,
  UnaryOperation,
  UncheckedBlock,
  UserDefinedTypeName,
  UserDefinedValueTypeDefinition,
  UsingForDirective,
  VariableDeclaration,
  VariableDeclarationStatement,
  WhileStatement,
} from "solc-typed-ast";
import { writeFileSync } from "fs";
import path from "path";
import { arrJoiner } from "../../lib/text";

const classTypes = [
  ErrorDefinition,
  EventDefinition,
  FunctionDefinition,
  ModifierDefinition,
  StructDefinition,
  UserDefinedValueTypeDefinition,
  VariableDeclaration,
  Assignment,
  BinaryOperation,
  Conditional,
  ElementaryTypeNameExpression,
  FunctionCallOptions,
  FunctionCall,
  Identifier,
  IdentifierPath,
  IndexAccess,
  IndexRangeAccess,
  Literal,
  MemberAccess,
  NewExpression,
  TupleExpression,
  UnaryOperation,
  ImportDirective,
  InheritanceSpecifier,
  ModifierInvocation,
  OverrideSpecifier,
  ParameterList,
  PragmaDirective,
  SourceUnit,
  StructuredDocumentation,
  UsingForDirective,
  Block,
  UncheckedBlock,
  Break,
  Continue,
  DoWhileStatement,
  EmitStatement,
  ExpressionStatement,
  ForStatement,
  IfStatement,
  InlineAssembly,
  PlaceholderStatement,
  Return,
  RevertStatement,
  Throw,
  TryCatchClause,
  TryStatement,
  VariableDeclarationStatement,
  WhileStatement,
  ArrayTypeName,
  ElementaryTypeName,
  FunctionTypeName,
  Mapping,
  UserDefinedTypeName,
];

type AllButFirstTwo<Args extends any[]> = Args["length"] extends 0
  ? undefined
  : Args extends [number, string, ...infer I]
  ? I
  : never;

type AllButLastTwo<Args extends any[]> = Args["length"] extends 0
  ? undefined
  : Args extends [...infer I, number, string]
  ? I
  : never;

type AllButLastTwoConstructorParameters<
  SomeClassDef extends { new (...args: any[]): any }
> = AllButLastTwo<ConstructorParameters<SomeClassDef>>;
const toProto = (_obj: any) => {
  const proto = Object.getPrototypeOf(_obj);
  if (typeof proto === "object") return proto;
  return _obj.prototype;
};

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;

function $args(func: string) {
  return (func + "")
    .replace(/[/][/].*$/gm, "") // strip single-line comments
    .replace(/\s+/g, "") // strip white space
    .replace(/[/][*][^/*]*[*][/]/g, "") // strip multi-line comments
    .split("){", 1)[0]
    .replace(/^[^(]*[(]/, "") // extract the parameters
    .replace(/=[^,]+/g, "") // strip any ES6 defaults
    .split(",")
    .filter(Boolean); // split & filter [""]
}
function getParamNames(func: Function) {
  if (!func) return undefined;
  const fnStr = func.toString().replace(STRIP_COMMENTS, "");
  if (!fnStr.includes("constructor")) {
    return getParamNames(Object.getPrototypeOf(func));
  }
  return $args(fnStr);
  // const result = fnStr
  //   .slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")"))
  //   .match(ARGUMENT_NAMES);
  // if (result === null) return [];
  // return result;
}

type UpdatedConstructor<SomeClassDef> = SomeClassDef extends {
  new (...args: any[]): infer SomeClass extends ASTNode;
}
  ? {
      new (
        id: number,
        src: string,
        ...rest: AllButLastTwoConstructorParameters<SomeClassDef>
      ): SomeClass;
    }
  : never;

// console.log(Reflect.ownKeys(classTypes[0].prototype));

function getAllPropertyNames(obj: any) {
  const propertyNames = new Set<string>();
  const setters = new Set<string>();
  const getters = new Set<string>();

  let i = 0;
  for (; obj != null; obj = toProto(obj)) {
    if (i++ > 30) throw Error("");
    Object.getOwnPropertyNames(obj).forEach((k) => propertyNames.add(k));
    Object.keys(obj).forEach((k) => propertyNames.add(k));
    const descriptors = [
      ...Object.entries(Object.getOwnPropertyDescriptors(obj)),
    ];
    for (const [key, descriptor] of descriptors) {
      propertyNames.add(key);
      if (descriptor.set) setters.add(key);
      if (descriptor.get) getters.add(key);
    }
  }
  return {
    properties: propertyNames,
    setters,
    getters,
  };
}
const replacements = {
  typeName: "vType",
  options: "vOptionsMap",
  args: "vArguments",
  components: "vOriginalComponents",
};
const outCode = [];
for (const type of classTypes) {
  try {
    const name = type.prototype.constructor.name;
    const { getters, setters } = getAllPropertyNames(type);
    const parameterNames = getParamNames(type.prototype.constructor);
    const constructorParams = parameterNames.map((n) => {
      if (n === "id") return 0;
      if (n === "src") return "0:0:0";
      let value = [];
      if (setters.has(n) || setters.has(`v${n.toPascalCase()}`)) {
        value = undefined;
      }
      return value;
    });
    const _instance = new (type as { new (...args: any[]): any })(
      ...constructorParams
    );
    const instance = getAllPropertyNames(_instance);
    const usedParams = [];
    parameterNames.forEach((param, i) => {
      const replacementParam = replacements[param];
      if (replacementParam && instance.properties.has(replacementParam)) {
          param = replacementParam;
          usedParams.push(param);
      } else if (instance.properties.has(param)) {
        usedParams.push(param);
      } else {
        usedParams.push(`v${param.toPascalCase()}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(_instance, param);
      // if (instance.getters.has(param) && !instance.setters.has(param)) {
        // if ()
      // }
      if (descriptor) {
        if (!descriptor.writable) {
          console.log(`Readonly property: ${param}`);
        }
      }
      if (
        !instance.properties.has(param) &&
        !instance.properties.has(`v${param.toPascalCase()}`)
      ) {
        // console.log(
        //   `${name}: Constructor param "${param}" or "${`v${param.toPascalCase()}`}" not found in prototype`
        // );
        // // const key = _instance[param] ? param : `v${param.toPascalCase()}`;
        // console.log(
        //   `Input var given: ${typeof constructorParams[i]} ${JSON.stringify(
        //     constructorParams[i]
        //   )}`
        // );
        // console.log(
        //   `Has Getter: ${
        //     getters.has(param) ||
        //     getters.has(`v${param.toPascalCase()}`) ||
        //     instance.getters.has(param) ||
        //     instance.getters.has(`v${param.toPascalCase()}`)
        //   }`
        // );
        // console.log(
        //   `Has Setter: ${
        //     setters.has(param) ||
        //     setters.has(`v${param.toPascalCase()}`) ||
        //     instance.setters.has(param) ||
        //     instance.setters.has(`v${param.toPascalCase()}`)
        //   }`
        // );
        // console.log(
        //   constructorParams
        //     .map((p, i) => `${parameterNames[i]} = ${JSON.stringify(p)}`)
        //     .join(", ")
        // );
      } else {
        if (!instance.properties.has(param)) {
          // console.log(
          // `${name}: Use derived type v${param.toPascalCase()} for ${param}`
          // );
        }
      }
    });
    const myArgFn = [
      `[`,
      [
        `${name},`,
        `(node: ${name}): Specific<ConstructorParameters<typeof ${name}>> => [`,
        usedParams.slice(2).map((p) => `node.${p},`),
        `]`,
      ],
      `],`,
    ];
    outCode.push(myArgFn);
    /*   [
    BinaryOperation,
    (
      node: BinaryOperation
    ): Specific<ConstructorParameters<typeof BinaryOperation>> => [
      node.typeString,
      node.operator,
      node.vLeftExpression,
      node.vRightExpression,
      node.raw,
    ],
  ], */
  } catch (err) {
    console.log(`\n Caught error in ${type.prototype.constructor.name} \n`);
    throw err;
  }
}
// console.log(Object.getOwnPropertyDescriptors(Block.prototype))

// console.log(getAllPropertyNames(Block));
// console.log(Object.getOwnPropertyDescriptor(Block.prototype, "vStatements"));
writeFileSync(path.join(__dirname, "arg_types.ts"), arrJoiner(outCode));
