import { coerceArray } from "../lib/text";
import { LiteralKind } from "solc-typed-ast";


export type YulNode =
  | YulBlock
  | YulLiteral
  | YulIdentifier
  | YulTypedName
  | YulFunctionCall
  | YulVariableDeclaration
  | YulExpressionStatement
  | YulAssignment
  | YulIf
  | YulCase
  | YulSwitch
  | YulContinue
  | YulBreak
  | YulLeave
  | YulForLoop
  | YulFunctionDefinition;

// export type YulExpression = YulFunctionCall | YulLiteral;

type MaybeArray<T> = T | T[];
export type YulGenericIdentifier = YulIdentifier | YulTypedName;

export type YulBlock = {
  nodeType: "YulBlock";
  statements: YulNode[];
};

export type YulLiteral = {
  nodeType: "YulLiteral";
  kind: LiteralKind;
  value?: string | number;
  hexValue?: string;
  type: string; // should be empty string
};

export type YulIdentifier = {
  nodeType: "YulIdentifier";
  name: string;
};

export type YulTypedName = {
  nodeType: "YulTypedName";
  name: string;
  type?: string; // should be empty string
};

export type YulFunctionCall = {
  nodeType: "YulFunctionCall";
  functionName: YulIdentifier;
  arguments: YulNode[];
};

export type YulVariableDeclaration = {
  type: string;
  nodeType: "YulVariableDeclaration";
  variables: YulNode[];
  value: YulNode;
};

export type YulExpressionStatement = {
  nodeType: "YulExpressionStatement";
  expression: YulNode;
};

export type YulAssignment = {
  nodeType: "YulAssignment";
  variableNames: YulGenericIdentifier[];
  value: YulNode;
};

export type YulIf = {
  nodeType: "YulIf";
  condition: YulNode;
  body: YulNode;
};

export type YulCase = {
  nodeType: "YulCase";
  body: YulNode;
  value: "default" | YulLiteral;
};

export type YulSwitch = {
  nodeType: "YulSwitch";
  expression: YulNode;
  cases: YulCase[];
};

export type YulContinue = {
  nodeType: "YulContinue";
};

export type YulBreak = {
  nodeType: "YulBreak";
};

export type YulLeave = {
  nodeType: "YulLeave";
};

export type YulForLoop = {
  nodeType: "YulForLoop";
  pre: YulNode;
  condition: YulNode;
  post: YulNode;
  body: YulBlock;
};

export type YulFunctionDefinition = {
  nodeType: "YulFunctionDefinition";
  name: string;
  parameters: YulIdentifier[];
  returnVariables: YulIdentifier[];
  body: YulBlock;
};

export class YulNodeFactory {
  private definitelyIdentifier<T>(identifier: string | T): T | YulIdentifier {
    if (typeof identifier === "string") {
      return this.makeYulIdentifier(identifier);
    }
    return identifier;
  }

  private definitelyLiteral<T>(literal: string | number | T): T | YulLiteral {
    if (typeof literal === "string" || typeof literal === "number") {
      return this.makeYulLiteral(literal);
    }
    return literal;
  }

  private definitelyIdentifierList<T>(
    identifier: MaybeArray<string | T>
  ): (T | YulIdentifier)[] {
    return coerceArray(identifier).map((item) =>
      this.definitelyIdentifier(item)
    );
  }

  private definitelyIdentifierOrLiteral<T>(
    identifier: string | number | T
  ): T | YulIdentifier | YulLiteral {
    if (typeof identifier === "string") {
      return this.makeYulIdentifier(identifier);
    }
    if (typeof identifier === "number") {
      return this.makeYulLiteral(identifier);
    }
    return identifier;
  }

  private definitelyIdentifierOrLiteralList<T>(
    identifier: MaybeArray<string | number | T>
  ): (T | YulIdentifier | YulLiteral)[] {
    return coerceArray(identifier).map((item) =>
      this.definitelyIdentifierOrLiteral(item)
    );
  }

  makeYulBlock(statements: MaybeArray<YulNode>): YulBlock {
    return {
      nodeType: "YulBlock",
      statements: coerceArray(statements),
    };
  }

  block = this.makeYulBlock;

  makeYulLiteral(value: string | number): YulLiteral {
    return {
      nodeType: "YulLiteral",
      kind: LiteralKind.String,
      value,
      type: "",
    };
  }

  literal = this.makeYulLiteral;

  makeYulIdentifier(name: string): YulIdentifier {
    return {
      nodeType: "YulIdentifier",
      name,
    };
  }

  identifier = this.makeYulIdentifier;
  id = this.makeYulIdentifier;

  makeYulTypedName(name: string): YulTypedName {
    return {
      nodeType: "YulTypedName",
      name,
    };
  }

  typed = this.makeYulTypedName;

  makeYulFunctionCall(
    functionName: string | YulIdentifier,
    _arguments: MaybeArray<YulNode | string | number> = []
  ): YulFunctionCall {
    return {
      nodeType: "YulFunctionCall",
      functionName: this.definitelyIdentifier(functionName),
      arguments: this.definitelyIdentifierOrLiteralList(_arguments),
    };
  }

  fnCall = this.makeYulFunctionCall;

  makeYulVariableDeclaration(
    variables: MaybeArray<YulGenericIdentifier | string>,
    value: YulNode
  ): YulVariableDeclaration {
    if (!Array.isArray(variables)) {
      variables = [variables];
    }
    return {
      type: "",
      nodeType: "YulVariableDeclaration",
      variables: variables.map((v) => this.definitelyIdentifier(v)),
      value,
    };
  }

  declaration = this.makeYulVariableDeclaration;

  let = this.makeYulVariableDeclaration;

  makeYulExpressionStatement(expression: YulNode): YulExpressionStatement {
    return {
      nodeType: "YulExpressionStatement",
      expression,
    };
  }

  statement = this.makeYulExpressionStatement;

  makeYulAssignment(
    variableNames: MaybeArray<YulIdentifier | YulTypedName | string>,
    value: YulNode
  ): YulAssignment {
    return {
      nodeType: "YulAssignment",
      variableNames: this.definitelyIdentifierList(variableNames),
      value,
    };
  }

  assignment = this.makeYulAssignment;

  makeYulIf(condition: YulNode, body: YulNode): YulIf {
    return {
      nodeType: "YulIf",
      condition,
      body,
    };
  }

  if = this.makeYulIf;

  makeYulCase(body: YulNode, value: YulLiteral | string | "default"): YulCase {
    return {
      nodeType: "YulCase",
      body,
      value:
        value === ("default" as "default")
          ? value
          : this.definitelyLiteral(value),
    };
  }

  case = this.makeYulCase;

  makeYulSwitch(expression: YulNode, cases: YulCase[]): YulSwitch {
    return {
      nodeType: "YulSwitch",
      expression,
      cases,
    };
  }

  switch = this.makeYulSwitch;

  makeYulContinue(): YulContinue {
    return {
      nodeType: "YulContinue",
    };
  }

  continue = this.makeYulContinue;

  makeYulBreak(): YulBreak {
    return {
      nodeType: "YulBreak",
    };
  }

  break = this.makeYulBreak;

  makeYulLeave(): YulLeave {
    return {
      nodeType: "YulLeave",
    };
  }

  leave = this.makeYulLeave;

  makeYulForLoop(
    pre: YulNode,
    condition: YulNode,
    post: YulNode,
    body: YulBlock
  ): YulForLoop {
    return {
      nodeType: "YulForLoop",
      pre,
      condition,
      post,
      body,
    };
  }

  for = this.makeYulForLoop;

  makeYulFunctionDefinition(
    name: string,
    parameters: YulIdentifier[],
    returnVariables: YulIdentifier[],
    body: YulBlock
  ): YulFunctionDefinition {
    return {
      nodeType: "YulFunctionDefinition",
      name,
      parameters,
      returnVariables,
      body,
    };
  }

  stop = () => this.fnCall("stop");
  add = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("add", [x, y]);

  sub = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("sub", [x, y]);

  mul = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("mul", [x, y]);

  div = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("div", [x, y]);

  sdiv = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("sdiv", [x, y]);

  mod = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("mod", [x, y]);

  smod = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("smod", [x, y]);

  exp = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("exp", [x, y]);

  not = (x: YulNode | string | number) => this.fnCall("not", [x]);
  lt = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("lt", [x, y]);

  gt = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("gt", [x, y]);

  slt = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("slt", [x, y]);

  sgt = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("sgt", [x, y]);

  eq = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("eq", [x, y]);

  iszero = (x: YulNode | string | number) => this.fnCall("iszero", [x]);
  and = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("and", [x, y]);

  or = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("or", [x, y]);

  xor = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("xor", [x, y]);

  byte = (n: YulNode | string | number, x: YulNode | string | number) =>
    this.fnCall("byte", [n, x]);

  shl = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("shl", [x, y]);

  shr = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("shr", [x, y]);

  sar = (x: YulNode | string | number, y: YulNode | string | number) =>
    this.fnCall("sar", [x, y]);

  addmod = (x: YulNode | string | number, m: YulNode | string | number) =>
    this.fnCall("addmod", [x, m]);

  mulmod = (x: YulNode | string | number, m: YulNode | string | number) =>
    this.fnCall("mulmod", [x, m]);

  signextend = (i: YulNode | string | number, x: YulNode | string | number) =>
    this.fnCall("signextend", [i, x]);

  keccak256 = (p: YulNode | string | number, n: YulNode | string | number) =>
    this.fnCall("keccak256", [p, n]);

  pc = () => this.fnCall("pc");
  pop = (x: YulNode | string | number) => this.fnCall("pop", [x]);
  mload = (p: YulNode | string | number) => this.fnCall("mload", [p]);
  mstore = (p: YulNode | string | number, v: YulNode | string | number) =>
    this.fnCall("mstore", [p, v]);

  mstore8 = (p: YulNode | string | number, v: YulNode | string | number) =>
    this.fnCall("mstore8", [p, v]);

  sload = (p: YulNode | string | number) => this.fnCall("sload", [p]);
  sstore = (p: YulNode | string | number, v: YulNode | string | number) =>
    this.fnCall("sstore", [p, v]);

  msize = () => this.fnCall("msize");
  gas = () => this.fnCall("gas");
  address = () => this.fnCall("address");
  balance = (a: YulNode | string | number) => this.fnCall("balance", [a]);
  selfbalance = () => this.fnCall("selfbalance");
  caller = () => this.fnCall("caller");
  callvalue = () => this.fnCall("callvalue");
  calldataload = (p: YulNode | string | number) =>
    this.fnCall("calldataload", [p]);

  calldatasize = () => this.fnCall("calldatasize");
  calldatacopy = (t: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("calldatacopy", [t, s]);

  codesize = () => this.fnCall("codesize");
  codecopy = (t: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("codecopy", [t, s]);

  extcodesize = (a: YulNode | string | number) =>
    this.fnCall("extcodesize", [a]);

  extcodecopy = (a: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("extcodecopy", [a, s]);

  returndatasize = () => this.fnCall("returndatasize");
  returndatacopy = (
    t: YulNode | string | number,
    s: YulNode | string | number
  ) => this.fnCall("returndatacopy", [t, s]);

  extcodehash = (a: YulNode | string | number) =>
    this.fnCall("extcodehash", [a]);

  create = (v: YulNode | string | number, n: YulNode | string | number) =>
    this.fnCall("create", [v, n]);

  create2 = (v: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("create2", [v, s]);

  call = (g: YulNode | string | number, outsize: YulNode | string | number) =>
    this.fnCall("call", [g, outsize]);

  callcode = (
    g: YulNode | string | number,
    outsize: YulNode | string | number
  ) => this.fnCall("callcode", [g, outsize]);

  delegatecall = (
    g: YulNode | string | number,
    outsize: YulNode | string | number
  ) => this.fnCall("delegatecall", [g, outsize]);

  staticcall = (
    g: YulNode | string | number,
    outsize: YulNode | string | number
  ) => this.fnCall("staticcall", [g, outsize]);

  return = (p: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("return", [p, s]);

  revert = (p: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("revert", [p, s]);

  selfdestruct = (a: YulNode | string | number) =>
    this.fnCall("selfdestruct", [a]);

  invalid = () => this.fnCall("invalid");
  log0 = (p: YulNode | string | number, s: YulNode | string | number) =>
    this.fnCall("log0", [p, s]);

  log1 = (p: YulNode | string | number, t1: YulNode | string | number) =>
    this.fnCall("log1", [p, t1]);

  log2 = (p: YulNode | string | number, t2: YulNode | string | number) =>
    this.fnCall("log2", [p, t2]);

  log3 = (p: YulNode | string | number, t3: YulNode | string | number) =>
    this.fnCall("log3", [p, t3]);

  log4 = (p: YulNode | string | number, t4: YulNode | string | number) =>
    this.fnCall("log4", [p, t4]);

  chainid = () => this.fnCall("chainid");
  basefee = () => this.fnCall("basefee");
  origin = () => this.fnCall("origin");
  gasprice = () => this.fnCall("gasprice");
  blockhash = (b: YulNode | string | number) => this.fnCall("blockhash", [b]);
  coinbase = () => this.fnCall("coinbase");
  timestamp = () => this.fnCall("timestamp");
  number = () => this.fnCall("number");
  difficulty = () => this.fnCall("difficulty");
  gaslimit = () => this.fnCall("gaslimit");
}
