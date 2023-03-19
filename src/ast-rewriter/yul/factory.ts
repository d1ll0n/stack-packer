/* eslint-disable no-dupe-class-members */
import { isNumeric } from "../../type-utils";

import {
  CastableToIdentifierOrLiteral,
  CastableToYulExpression,
} from "./utils";
import { coerceArray } from "../../lib/text";
import { Identifier, LiteralKind, VariableDeclaration } from "solc-typed-ast";
import { isZero, toHex } from "../../lib/bytes";
import { MaybeArray } from "../../lib/array";
import { TypeCheck } from "../types";
import {
  YulAssignment,
  YulBlock,
  YulBreak,
  YulCase,
  YulContinue,
  YulExpression,
  YulExpressionStatement,
  YulForLoop,
  YulFunctionCall,
  YulFunctionDefinition,
  YulGenericIdentifier,
  YulIdentifier,
  YulIf,
  YulLeave,
  YulLiteral,
  YulNode,
  YulSwitch,
  YulTypedName,
  YulVariableDeclaration,
} from "./ast";

export class YulNodeFactory {
  private definitelyIdentifier<T>(identifier: string | T): T | YulIdentifier {
    if (typeof identifier === "string") {
      return this.makeYulIdentifier(identifier);
    }
    return identifier;
  }

  private definitelyLiteral<T>(literal: string | number | T): T | YulLiteral {
    if (isNumeric(literal)) {
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
    if (isNumeric(identifier)) {
      return this.makeYulLiteral(identifier);
    }
    if (typeof identifier === "string") {
      return this.makeYulIdentifier(identifier);
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

  resolveConstantValue(
    node: CastableToIdentifierOrLiteral,
    numeric: true
  ): bigint | undefined;

  resolveConstantValue(node: CastableToIdentifierOrLiteral): string | undefined;

  resolveConstantValue(
    node: CastableToIdentifierOrLiteral,
    numeric: false
  ): string | undefined;

  resolveConstantValue(
    node: CastableToIdentifierOrLiteral,
    numeric?: boolean
  ): bigint | string | undefined {
    let value: string;
    console.log(node);
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

  isConstant(node: CastableToIdentifierOrLiteral) {
    return this.resolveConstantValue(node) !== undefined;
  }

  // addConstants(
  //   a: CastableToIdentifierOrLiteral,
  //   b: CastableToIdentifierOrLiteral
  // ) {
  //   return toHex(
  //     BigInt(this.resolveConstantValue(a)) +
  //       BigInt(this.resolveConstantValue(b))
  //   );
  // }

  smartAdd(_a: CastableToYulExpression, _b: CastableToYulExpression) {
    const [a, b] = this.definitelyIdentifierOrLiteralList([_a, _b]);
    const constA = this.resolveConstantValue(a, true);
    const constB = this.resolveConstantValue(b, true);
    if (isZero(constA)) return b;
    if (isZero(constB)) return a;

    if (constA !== undefined && constB !== undefined) {
      return this.makeYulLiteral(toHex(constA + constB));
    }
    return this.add(a, b);
  }

  makeYulBlock(statements: MaybeArray<YulNode> = []): YulBlock {
    const block = new YulBlock(coerceArray(statements));
    block.factory = this;
    return block;
  }

  block = this.makeYulBlock;

  makeYulLiteral(value: string | number): YulLiteral {
    return new YulLiteral(LiteralKind.String, value);
  }

  literal = this.makeYulLiteral;

  makeYulIdentifier(name: string): YulIdentifier {
    return new YulIdentifier(name);
  }

  identifier = this.makeYulIdentifier;
  id = this.makeYulIdentifier;

  identifierFor(
    node: VariableDeclaration | YulFunctionDefinition | Identifier
  ): YulIdentifier {
    const vReferencedDeclaration =
      node instanceof Identifier
        ? (node.vReferencedDeclaration as VariableDeclaration)
        : node;
    return new YulIdentifier(node.name, vReferencedDeclaration);
  }

  makeYulTypedName(name: string): YulTypedName {
    return new YulTypedName(name);
  }

  typed = this.makeYulTypedName;

  makeYulFunctionCall(
    fn: string | YulIdentifier | YulFunctionDefinition,
    _arguments: MaybeArray<YulNode | string | number> = []
  ): YulFunctionCall {
    const functionName =
      fn instanceof YulFunctionDefinition ? this.identifierFor(fn) : fn;
    return new YulFunctionCall(
      this.definitelyIdentifier(functionName),
      this.definitelyIdentifierOrLiteralList(_arguments)
    );
  }

  fnCall = this.makeYulFunctionCall;

  makeYulVariableDeclaration(
    variables: MaybeArray<YulGenericIdentifier | string>,
    value: YulNode
  ): YulVariableDeclaration {
    if (!Array.isArray(variables)) {
      variables = [variables];
    }
    return new YulVariableDeclaration(
      this.definitelyIdentifierList(variables),
      value
    );
  }

  declaration = this.makeYulVariableDeclaration;

  let = this.makeYulVariableDeclaration;

  makeYulExpressionStatement(expression: YulNode): YulExpressionStatement {
    return new YulExpressionStatement(expression);
  }

  statement = this.makeYulExpressionStatement;

  makeYulAssignment(
    variableNames: MaybeArray<YulIdentifier | YulTypedName | string>,
    value: YulNode
  ): YulAssignment {
    return new YulAssignment(
      this.definitelyIdentifierList(variableNames),
      value
    );
  }

  assignment = this.makeYulAssignment;

  makeYulIf(condition: YulNode, body: YulNode, parent?: YulBlock): YulIf {
    if (!(body instanceof YulBlock)) {
      body = this.makeYulBlock(body);
    }

    const def = new YulIf(condition, body, parent);
    (body as YulBlock).parent = def;
    return def;
  }

  if = this.makeYulIf;

  makeYulCase(
    value: YulLiteral | string | "default",
    body: YulNode,
    parent?: YulSwitch
  ): YulCase {
    return new YulCase(
      value === ("default" as "default")
        ? value
        : this.definitelyLiteral(value),
      body,
      parent
    );
  }

  case = this.makeYulCase;

  makeYulSwitch(
    expression: YulNode,
    cases: YulCase[],
    parent?: YulBlock
  ): YulSwitch {
    return new YulSwitch(expression, cases, parent);
  }

  switch = this.makeYulSwitch;

  makeYulContinue(): YulContinue {
    return new YulContinue();
  }

  continue = this.makeYulContinue;

  makeYulBreak(): YulBreak {
    return new YulBreak();
  }

  break = this.makeYulBreak;

  makeYulLeave(): YulLeave {
    return new YulLeave();
  }

  leave = this.makeYulLeave;

  makeYulForLoop(
    pre: YulBlock = this.makeYulBlock(),
    condition: YulExpression,
    post: YulBlock = this.makeYulBlock(),
    body: YulBlock = this.makeYulBlock(),
    parent?: YulBlock
  ): YulForLoop {
    const forLoop = new YulForLoop(pre, condition, post, body, parent);
    body.parent = forLoop;
    return forLoop;
  }

  for = this.makeYulForLoop;

  makeYulFunctionDefinition(
    name: string,
    parameters: (string | YulIdentifier)[],
    returnVariables: (string | YulIdentifier)[],
    body: YulBlock = this.makeYulBlock([]),
    parent?: YulBlock
  ): YulFunctionDefinition {
    const fnDef = new YulFunctionDefinition(
      name,
      this.definitelyIdentifierList(parameters),
      this.definitelyIdentifierList(returnVariables),
      body,
      parent
    );
    body.parent = fnDef;
    return fnDef;
  }

  stop = () => this.fnCall("stop");

  add = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("add", [x, y]);

  sub = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("sub", [x, y]);

  mul = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("mul", [x, y]);

  div = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("div", [x, y]);

  sdiv = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("sdiv", [x, y]);

  mod = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("mod", [x, y]);

  smod = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("smod", [x, y]);

  exp = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("exp", [x, y]);

  not = (x: CastableToIdentifierOrLiteral) => this.fnCall("not", [x]);

  lt = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("lt", [x, y]);

  gt = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("gt", [x, y]);

  slt = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("slt", [x, y]);

  sgt = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("sgt", [x, y]);

  eq = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("eq", [x, y]);

  iszero = (x: CastableToIdentifierOrLiteral) => this.fnCall("iszero", [x]);

  and = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("and", [x, y]);

  or = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("or", [x, y]);

  xor = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("xor", [x, y]);

  byte = (
    index: CastableToIdentifierOrLiteral,
    x: CastableToIdentifierOrLiteral
  ) => this.fnCall("byte", [index, x]);

  shl = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("shl", [x, y]);

  shr = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("shr", [x, y]);

  sar = (x: CastableToIdentifierOrLiteral, y: CastableToIdentifierOrLiteral) =>
    this.fnCall("sar", [x, y]);

  addmod = (
    x: CastableToIdentifierOrLiteral,
    y: CastableToIdentifierOrLiteral,
    m: CastableToIdentifierOrLiteral
  ) => this.fnCall("addmod", [x, y, m]);

  mulmod = (
    x: CastableToIdentifierOrLiteral,
    y: CastableToIdentifierOrLiteral,
    m: CastableToIdentifierOrLiteral
  ) => this.fnCall("mulmod", [x, y, m]);

  signextend = (
    i: CastableToIdentifierOrLiteral,
    x: CastableToIdentifierOrLiteral
  ) => this.fnCall("signextend", [i, x]);

  keccak256 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("keccak256", [ptr, size]);

  pc = () => this.fnCall("pc");

  pop = (x: CastableToIdentifierOrLiteral) => this.fnCall("pop", [x]);

  mload = (ptr: CastableToIdentifierOrLiteral) => this.fnCall("mload", [ptr]);

  mstore = (
    ptr: CastableToIdentifierOrLiteral,
    value: CastableToIdentifierOrLiteral
  ) => this.fnCall("mstore", [ptr, value]);

  mstore8 = (
    ptr: CastableToIdentifierOrLiteral,
    value: CastableToIdentifierOrLiteral
  ) => this.fnCall("mstore8", [ptr, value]);

  sload = (slot: CastableToIdentifierOrLiteral) => this.fnCall("sload", [slot]);

  sstore = (
    slot: CastableToIdentifierOrLiteral,
    value: CastableToIdentifierOrLiteral
  ) => this.fnCall("sstore", [slot, value]);

  msize = () => this.fnCall("msize");

  gas = () => this.fnCall("gas");

  address = () => this.fnCall("address");

  balance = (address: CastableToIdentifierOrLiteral) =>
    this.fnCall("balance", [address]);

  selfbalance = () => this.fnCall("selfbalance");

  caller = () => this.fnCall("caller");

  callvalue = () => this.fnCall("callvalue");

  calldataload = (ptr: CastableToIdentifierOrLiteral) =>
    this.fnCall("calldataload", [ptr]);

  calldatasize = () => this.fnCall("calldatasize");

  calldatacopy = (
    dst: CastableToIdentifierOrLiteral,
    src: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("calldatacopy", [dst, src, size]);

  codesize = () => this.fnCall("codesize");

  codecopy = (
    dst: CastableToIdentifierOrLiteral,
    src: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("codecopy", [dst, src, size]);

  extcodesize = (address: CastableToIdentifierOrLiteral) =>
    this.fnCall("extcodesize", [address]);

  extcodecopy = (
    address: CastableToIdentifierOrLiteral,
    dst: CastableToIdentifierOrLiteral,
    src: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("extcodecopy", [address, dst, src, size]);

  returndatasize = () => this.fnCall("returndatasize");

  returndatacopy = (
    dst: CastableToIdentifierOrLiteral,
    src: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("returndatacopy", [dst, src, size]);

  extcodehash = (address: CastableToIdentifierOrLiteral) =>
    this.fnCall("extcodehash", [address]);

  create = (
    value: CastableToIdentifierOrLiteral,
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("create", [value, ptr, size]);

  create2 = (
    value: CastableToIdentifierOrLiteral,
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral,
    salt: CastableToIdentifierOrLiteral
  ) => this.fnCall("create2", [value, ptr, size, salt]);

  call = (
    gas: CastableToIdentifierOrLiteral,
    address: CastableToIdentifierOrLiteral,
    value: CastableToIdentifierOrLiteral,
    inPtr: CastableToIdentifierOrLiteral,
    inSize: CastableToIdentifierOrLiteral,
    outPtr: CastableToIdentifierOrLiteral,
    outSize: CastableToIdentifierOrLiteral
  ) =>
    this.fnCall("call", [gas, address, value, inPtr, inSize, outPtr, outSize]);

  callcode = (
    gas: CastableToIdentifierOrLiteral,
    address: CastableToIdentifierOrLiteral,
    value: CastableToIdentifierOrLiteral,
    inPtr: CastableToIdentifierOrLiteral,
    inSize: CastableToIdentifierOrLiteral,
    outPtr: CastableToIdentifierOrLiteral,
    outSize: CastableToIdentifierOrLiteral
  ) =>
    this.fnCall("callcode", [
      gas,
      address,
      value,
      inPtr,
      inSize,
      outPtr,
      outSize,
    ]);

  delegatecall = (
    gas: CastableToIdentifierOrLiteral,
    address: CastableToIdentifierOrLiteral,
    inPtr: CastableToIdentifierOrLiteral,
    inSize: CastableToIdentifierOrLiteral,
    outPtr: CastableToIdentifierOrLiteral,
    outSize: CastableToIdentifierOrLiteral
  ) =>
    this.fnCall("delegatecall", [gas, address, inPtr, inSize, outPtr, outSize]);

  staticcall = (
    gas: CastableToIdentifierOrLiteral,
    address: CastableToIdentifierOrLiteral,
    inPtr: CastableToIdentifierOrLiteral,
    inSize: CastableToIdentifierOrLiteral,
    outPtr: CastableToIdentifierOrLiteral,
    outSize: CastableToIdentifierOrLiteral
  ) =>
    this.fnCall("staticcall", [gas, address, inPtr, inSize, outPtr, outSize]);

  return = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("return", [ptr, size]);

  revert = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("revert", [ptr, size]);

  selfdestruct = (address: CastableToIdentifierOrLiteral) =>
    this.fnCall("selfdestruct", [address]);

  invalid = () => this.fnCall("invalid");

  log0 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral
  ) => this.fnCall("log0", [ptr, size]);

  log1 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral,
    topic1: CastableToIdentifierOrLiteral
  ) => this.fnCall("log1", [ptr, size, topic1]);

  log2 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral,
    topic1: CastableToIdentifierOrLiteral,
    topic2: CastableToIdentifierOrLiteral
  ) => this.fnCall("log2", [ptr, size, topic1, topic2]);

  log3 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral,
    topic1: CastableToIdentifierOrLiteral,
    topic2: CastableToIdentifierOrLiteral,
    topic3: CastableToIdentifierOrLiteral
  ) => this.fnCall("log3", [ptr, size, topic1, topic2, topic3]);

  log4 = (
    ptr: CastableToIdentifierOrLiteral,
    size: CastableToIdentifierOrLiteral,
    topic1: CastableToIdentifierOrLiteral,
    topic2: CastableToIdentifierOrLiteral,
    topic3: CastableToIdentifierOrLiteral,
    topic4: CastableToIdentifierOrLiteral
  ) => this.fnCall("log4", [ptr, size, topic1, topic2, topic3, topic4]);

  chainid = () => this.fnCall("chainid");

  basefee = () => this.fnCall("basefee");

  origin = () => this.fnCall("origin");

  gasprice = () => this.fnCall("gasprice");

  blockhash = (b: CastableToIdentifierOrLiteral) =>
    this.fnCall("blockhash", [b]);

  coinbase = () => this.fnCall("coinbase");

  timestamp = () => this.fnCall("timestamp");

  number = () => this.fnCall("number");

  difficulty = () => this.fnCall("difficulty");

  gaslimit = () => this.fnCall("gaslimit");
}
