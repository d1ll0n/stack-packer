import { BuiltinFunctionIds } from "./builtin";
import {
  ConstantNode,
  FunctionNode,
  MathNode,
  OperatorNode,
  parse,
  simplify,
  SymbolNode,
} from "mathjs";
import { inspect } from "util";
import {
  isConstant,
  makeYulIdentifier,
  makeYulLiteral,
  resolveConstantValue,
} from "./utils";
import { YulExpression, YulFunctionCall } from "./ast";

const operatorTemplates = {
  add: `($0 + $1)`,
  mul: `($0 * $1)`,
  sub: `($0 - $1)`,
  div: `($0 / $1)`,
  sdiv: `($0 / $1)`,
  mod: `($0 % $1)`,
  smod: `($0 % $1)`,
  addmod: `(($0 + $1) % $2)`,
  mulmod: `(($0 * $1) % $2)`,
  exp: `($0^$1)`,
  and: `($0 & $1)`,
  or: `($0 | $1)`,
  iszero: `($0 == 0)`,
  eq: `($0 == $1)`,
  gt: `($0 > $1)`,
  lt: `($0 < $1)`,
  shl: `($1 << $0)`,
  shr: `($1 >> $0)`,
};

export function yulToStringExpression(a: YulExpression) {
  switch (a.nodeType) {
    case "YulFunctionCall":
      let formatString = operatorTemplates[a.vFunctionName];
      const values = (a.arguments as YulExpression[]).map(
        yulToStringExpression
      );
      if (!formatString) {
        return `${a.vFunctionName}(${values.join(", ")})`;
      }
      values.forEach((value, i) => {
        formatString = formatString.replace(`$${i}`, value);
      });
      return formatString;
    case "YulIdentifier":
      if (!isConstant(a)) {
        return a.name;
      }
      return resolveConstantValue(a).toString();
    case "YulTypedName":
      return a.name;
    case "YulLiteral":
      return a.value;
  }
}

const OperationLookup: Record<string, keyof typeof BuiltinFunctionIds> = {
  add: "add",
  multiply: "mul",
  subtract: "sub",
  divide: "div",
  mod: "mod",
  pow: "exp",
  bitAnd: "and",
  bitOr: "or",
  equal: "eq",
  larger: "gt",
  smaller: "lt",
  leftShift: "shl",
  rightArithShift: "shr",
};

const NodeConverters = {
  SymbolNode: (node: SymbolNode) => makeYulIdentifier(node.name),
  ConstantNode: (node: ConstantNode) => makeYulLiteral(node.value),
  OperatorNode: (node: OperatorNode) => {
    const name = (node.fn as SymbolNode).toString();
    const yulName = OperationLookup[name];
    if (!yulName) {
      console.log("-".repeat(8) + "inspect output" + "-".repeat(8));
      console.log(inspect(node, { depth: 7 }));
      console.log("-".repeat(30));
      console.log(node.toString());
      throw Error(`${node.fn} operation not recognized as Yul function`);
    }
    const id = BuiltinFunctionIds[yulName];
    return new YulFunctionCall(id, node.args.map(mathNodeToYul));
  },
  FunctionNode: (node: FunctionNode) => {
    const name = (node.fn as SymbolNode).toString();
    return new YulFunctionCall(
      makeYulIdentifier(name),
      node.args.map(mathNodeToYul)
    );
  },
};

export function mathNodeToYul(node: MathNode): YulExpression {
  const converter = NodeConverters[node.type];
  if (!converter) {
    throw Error(`Unimplemented MathNode ${node.type}`);
  }
  return converter(node);
}

export function mathStringToYul(str: string): YulExpression {
  const mathNode = parse(str);
  return mathNodeToYul(mathNode);
}

export function yulToMathNode(node: YulExpression) {
  return parse(yulToStringExpression(node));
}

export function simplifyYulExpression(node: YulExpression) {
  const str = yulToStringExpression(node);
  return mathNodeToYul(simplify(str));
}

/**
 * Determine whether expression `a` is greater than expression `b`
 * @returns `0` if it can not be determined;
 * @returns `1` if `a` is definitely greater than `b`;
 * @returns `-1` if `a` is definitely not greater than `b`;
 */
export function expressionGt(a: YulExpression, b: YulExpression) {
  const gtNode = simplify(yulToMathNode(a.sub(b).gt(0)));
  if (gtNode.type === "ConstantNode") {
    return gtNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

/**
 * Determine whether expression `a` is greater than or equal to expression `b`
 * @returns `0` if it can not be determined;
 * @returns `1` if `a` is definitely greater than or equal to `b`;
 * @returns `-1` if `a` is definitely not greater than or equal to `b`;
 */
export function expressionGte(a: YulExpression, b: YulExpression) {
  const gtNode = simplify(yulToMathNode(a.sub(b).gt(-1)));
  if (gtNode.type === "ConstantNode") {
    return gtNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

/**
 * Determine whether expression `a` is less than expression `b`
 * @returns `0` if it can not be determined;
 * @returns `1` if `a` is definitely less than `b`;
 * @returns `-1` if `a` is definitely not less than `b`;
 */
export function expressionLt(a: YulExpression, b: YulExpression) {
  const ltNode = simplify(yulToMathNode(a.sub(b).lt(0)));
  if (ltNode.type === "ConstantNode") {
    return ltNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

/**
 * Determine whether expression `a` is less than or equal to expression `b`
 * @returns `0` if it can not be determined;
 * @returns `1` if `a` is definitely less than or equal to `b`;
 * @returns `-1` if `a` is definitely not less than or equal to `b`;
 */
export function expressionLte(a: YulExpression, b: YulExpression) {
  const gtNode = simplify(yulToMathNode(a.sub(b).lt(1)));
  if (gtNode.type === "ConstantNode") {
    return gtNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

/**
 * Determine whether expression `a` is equivalent to expression `b`
 * @returns `0` if it can not be determined;
 * @returns `1` if `a` is definitely equal to `b`;
 * @returns `-1` if `a` is definitely not equal to `b`;
 */
export function expressionEq(a: YulExpression, b: YulExpression) {
  const ltNode = simplify(yulToMathNode(a.sub(b).eq(0)));
  if (ltNode.type === "ConstantNode") {
    return ltNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

// const a = makeYulLiteral("12").add("x");
// const b = makeYulLiteral("11").add("x");
// console.log(expressionGte(a, b));
