/* eslint-disable no-redeclare */
/* eslint-disable no-useless-constructor */
/* eslint-disable no-dupe-class-members */
import { CastableToIdentifierOrLiteral } from "./utils";
import { coerceArray } from "../../lib/text";
import { ExpressionAccessors, withExpressionAccessors } from "./arithmetic";
import {
  InlineAssembly,
  LiteralKind,
  SourceFormatter,
  StructuredDocumentation,
  VariableDeclaration,
} from "solc-typed-ast";
import { MaybeArray } from "../../lib/array";
import { YulNodeFactory } from "./factory";
import { YulXPath } from "./xpath";

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

export type YulExpression =
  | YulIdentifier
  | YulTypedName
  | YulLiteral
  | YulFunctionCall;

// interface CanArithmetic {
//   mul(n: YulExpression): YulFunctionCall;
// }

export type YulGenericIdentifier = YulIdentifier | YulTypedName;
// type NewYulNode = Overwrite

// function writeDocs(documentation: string | string[], formatter: SourceFormatter) {}

let randomId = 100000;

export class BaseYulNode {
  documentation?: string[];

  constructor(public id = ++randomId, public src = "0:0:0") {}

  /**
   * Returns children nodes of the current node
   */
  get children(): readonly BaseYulNode[] {
    return this.pickNodes();
  }

  protected pickNodes(...args: Array<any | Iterable<any>>): BaseYulNode[] {
    const result: BaseYulNode[] = [];

    for (const arg of args) {
      if (arg instanceof BaseYulNode) {
        result.push(arg);
      } else if (arg === null || arg === undefined || typeof arg === "string") {
        continue;
      } else if (typeof arg[Symbol.iterator] === "function") {
        result.push(...this.pickNodes(...arg));
      }
    }

    return result;
  }

  getFieldValues(): Map<string, any> {
    return new Map(Object.entries(this));
  }

  getGettersValues(): Map<string, any> {
    const getters: string[] = [];

    let proto = Object.getPrototypeOf(this);

    while (proto) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === "__proto__") {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(proto, name);

        if (
          descriptor &&
          typeof descriptor.get === "function" &&
          !getters.includes(name)
        ) {
          getters.push(name);
        }
      }

      proto = Object.getPrototypeOf(proto);
    }

    const result = new Map<string, any>();

    for (const g of getters) {
      result.set(g, this[g as keyof this]);
    }

    return result;
  }

  get xpath() {
    return new YulXPath(this as any);
  }

  write(formatter: SourceFormatter): string {
    return this.writeNode(formatter);
  }

  writeNode(formatter: SourceFormatter) {
    return "";
  }
}

export class YulBlock extends BaseYulNode {
  nodeType: "YulBlock" = "YulBlock";
  factory?: YulNodeFactory;
  public statements: YulNode[] = [];

  constructor(
    stmts: YulNode[] = [],
    public parent?:
      | YulCase
      | YulIf
      | YulForLoop
      | YulFunctionDefinition
      | InlineAssembly
  ) {
    super();
    for (const stmt of stmts) {
      this.appendChild(stmt);
    }
  }

  get children() {
    return this.pickNodes(this.statements);
  }

  appendChild(node: YulNode) {
    this.statements.push(node);
    if (
      node instanceof YulIf ||
      node instanceof YulForLoop ||
      node instanceof YulFunctionDefinition ||
      node instanceof YulSwitch
    ) {
      node.parent = this;
    }
  }

  get rootBlock(): Omit<YulBlock, "parent"> & { parent: InlineAssembly } {
    // let parent: YulBlock["parent"] | YulSwitch | YulBlock = this.block.parent;
    let block:
      | Exclude<YulBlock["parent"], InlineAssembly>
      | YulSwitch
      | YulBlock = this;
    while (block.parent && !(block.parent instanceof InlineAssembly)) {
      block = block.parent;
    }
    if (
      !(block.parent instanceof InlineAssembly && block instanceof YulBlock)
    ) {
      throw Error(`Could not find root InlineAssembly node for YulBlock`);
    }
    return block as YulBlock & { parent: InlineAssembly };
  }

  get rootInlineAssembly() {
    return this.rootBlock.parent;
  }

  insertAtBeginning(node: YulNode) {
    this.statements.unshift(node);
  }

  get functions(): YulFunctionDefinition[] {
    return this.children.filter((node) =>
      node instanceof YulFunctionDefinition ? node : undefined
    ) as YulFunctionDefinition[];
  }

  addFunctionIfNotExists(fn: YulFunctionDefinition): YulFunctionDefinition {
    const exists = this.functions.find((_fn) => _fn.name === fn.name);
    if (!exists) {
      this.insertAtBeginning(fn);
      return fn;
    }
    return exists;
  }

  let(names: string, node: CastableToIdentifierOrLiteral): YulIdentifier;
  let(names: string[], node: CastableToIdentifierOrLiteral): YulIdentifier[];
  let(names: MaybeArray<string>, node: CastableToIdentifierOrLiteral) {
    if (this.factory.isConstant(node)) {
      if (typeof node !== "object") node = this.factory.literal(node);
    }
    this.statements.push(this.factory.let(names, node as YulNode));
    if (!Array.isArray(names)) return this.factory.identifier(names);
    return names.map((name) => this.factory.identifier(name));
  }

  set(nodes: YulIdentifier | string, value: YulExpression): YulIdentifier;
  set(nodes: (YulIdentifier | string)[], value: YulExpression): YulIdentifier[];
  set(nodes: MaybeArray<YulIdentifier | string>, value: YulExpression) {
    // set(node: YulIdentifier | string, value: YulExpression) {
    const identifiers = Array.isArray(nodes)
      ? nodes.map((node) =>
          node instanceof YulIdentifier ? node : this.factory.identifier(node)
        )
      : nodes;
    if (coerceArray(nodes).some((n) => n instanceof YulIdentifier)) {
      this.appendChild(this.factory.assignment(nodes, value));
    } else {
      this.let(nodes as string[], value);
    }

    return identifiers;
  }

  writeNode(formatter: SourceFormatter) {
    if (this.statements.length === 0) {
      return "{}";
    }

    formatter.increaseNesting();
    const statements = this.statements.map(
      (stmt) => formatter.renderIndent() + stmt.write(formatter)
    );
    formatter.decreaseNesting();
    const wrap = formatter.renderWrap();
    const indent = formatter.renderIndent();
    return "{" + wrap + statements.join(wrap) + wrap + indent + "}";
  }
}

@withExpressionAccessors
export class YulLiteral extends BaseYulNode /* implements CanArithmetic */ {
  nodeType: "YulLiteral" = "YulLiteral";
  type: string = "";
  constructor(
    public kind: LiteralKind,
    public value?: string | number,
    public hexValue?: string
  ) {
    super();
  }

  writeNode(formatter: SourceFormatter) {
    let result;
    if (this.kind === "string") {
      if (this.value !== undefined) {
        result = JSON.stringify(this.value);
      } else if (this.hexValue !== undefined) {
        result = `hex"${this.hexValue}"`;
      } else {
        throw new Error(
          "Unable to pick string YulLiteral value: " + JSON.stringify(this)
        );
      }
    } else {
      result = this.value;
    }
    return this.type !== "" ? result + ":" + this.type : result;
  }
}
export interface YulLiteral extends ExpressionAccessors {}

@withExpressionAccessors
export class YulIdentifier extends BaseYulNode {
  nodeType: "YulIdentifier" = "YulIdentifier";
  constructor(
    public name: string,
    public vReferencedDeclaration?: VariableDeclaration | YulFunctionDefinition
  ) {
    super();
  }

  writeNode(formatter: SourceFormatter) {
    return this.name;
  }
}
export interface YulIdentifier extends ExpressionAccessors {}

@withExpressionAccessors
export class YulTypedName extends BaseYulNode {
  nodeType: "YulTypedName" = "YulTypedName";
  type: string = ""; // should be empty string

  constructor(public name: string) {
    super();
  }

  writeNode(formatter: SourceFormatter) {
    return this.type !== "" ? this.name + ":" + this.type : this.name;
  }
}
export interface YulTypedName extends ExpressionAccessors {}

@withExpressionAccessors
export class YulFunctionCall extends BaseYulNode {
  nodeType: "YulFunctionCall" = "YulFunctionCall";
  public arguments: YulNode[];
  constructor(public functionName: YulIdentifier, _arguments: YulNode[]) {
    super();
    this.arguments = _arguments;
  }

  get vFunctionName(): string {
    return this.functionName.name;
  }

  get children() {
    return this.pickNodes(this.functionName, this.arguments);
  }

  writeNode(formatter: SourceFormatter) {
    const id = this.functionName.write(formatter);
    const args = this.arguments.map((arg) => arg.write(formatter));
    return id + "(" + args.join(", ") + ")";
  }
}
export interface YulFunctionCall extends ExpressionAccessors {}

export class YulVariableDeclaration extends BaseYulNode {
  nodeType: "YulVariableDeclaration" = "YulVariableDeclaration";
  type: string = "";
  constructor(public variables: YulNode[], public value: YulNode) {
    super();
  }

  get children() {
    return this.pickNodes(this.variables, this.value);
  }

  writeNode(formatter: SourceFormatter) {
    const vars = this.variables.map((v) => v.write(formatter));
    const rhs = this.value === null ? undefined : this.value.write(formatter);
    const lhs = "let " + vars.join(", ");
    return rhs !== undefined ? lhs + " := " + rhs : lhs;
  }
}

export class YulExpressionStatement extends BaseYulNode {
  nodeType: "YulExpressionStatement" = "YulExpressionStatement";
  constructor(public expression: YulNode) {
    super();
  }

  get children() {
    return this.pickNodes(this.expression);
  }

  writeNode(formatter: SourceFormatter) {
    return this.expression.write(formatter);
  }
}

export class YulAssignment extends BaseYulNode {
  nodeType: "YulAssignment" = "YulAssignment";
  constructor(
    public variableNames: YulGenericIdentifier[],
    public value: YulNode
  ) {
    super();
  }

  get children() {
    return this.pickNodes(this.variableNames, this.value);
  }

  writeNode(formatter: SourceFormatter) {
    const lhs = this.variableNames.map((v) => v.write(formatter));
    const rhs = this.value.write(formatter);
    return lhs.join(", ") + " := " + rhs;
  }
}

export class YulIf extends BaseYulNode {
  nodeType: "YulIf" = "YulIf";

  constructor(
    public condition: YulNode,
    public body: YulNode,
    public parent?: YulBlock
  ) {
    super();
  }

  get children() {
    return this.pickNodes(this.condition, this.body);
  }

  writeNode(formatter: SourceFormatter) {
    const condition = this.condition.write(formatter);
    const body = this.body.write(formatter);
    return "if " + condition + " " + body;
  }
}

export class YulCase extends BaseYulNode {
  nodeType: "YulCase" = "YulCase";
  constructor(
    public value: "default" | YulLiteral,
    public body: YulNode,
    public parent?: YulSwitch
  ) {
    super();
  }

  get children() {
    return this.pickNodes(this.value, this.body);
  }

  writeNode(formatter: SourceFormatter) {
    const body = this.body.write(formatter);
    if (this.value === "default") {
      return "default " + body;
    }
    const value = this.value.write(formatter);
    return "case " + value + " " + body;
  }
}

export class YulSwitch extends BaseYulNode {
  nodeType: "YulSwitch" = "YulSwitch";
  constructor(
    public expression: YulNode,
    public cases: YulCase[],
    public parent?: YulBlock
  ) {
    super();
    for (const _case of cases) {
      _case.parent = this;
    }
  }

  get children() {
    return this.pickNodes(this.expression, this.cases);
  }

  writeNode(formatter: SourceFormatter) {
    const expression = this.expression.write(formatter);

    const cases = this.cases.map(
      (clause) => formatter.renderIndent() + clause.write(formatter)
    );
    const wrap = formatter.renderWrap();
    return "switch " + expression + wrap + cases.join(wrap);
  }
}

export class YulContinue extends BaseYulNode {
  nodeType: "YulContinue" = "YulContinue";
  writeNode(formatter: SourceFormatter) {
    return "continue";
  }
}

export class YulBreak extends BaseYulNode {
  nodeType: "YulBreak" = "YulBreak";
  writeNode(formatter: SourceFormatter) {
    return "break";
  }
}

export class YulLeave extends BaseYulNode {
  nodeType: "YulLeave" = "YulLeave";
  writeNode(formatter: SourceFormatter) {
    return "leave";
  }
}

export class YulForLoop extends BaseYulNode {
  nodeType: "YulForLoop" = "YulForLoop";

  constructor(
    public pre: YulBlock,
    public condition: YulExpression,
    public post: YulBlock,
    public body: YulBlock,
    public parent?: YulBlock
  ) {
    super();
  }

  get children() {
    return this.pickNodes(this.pre, this.condition, this.post, this.body);
  }

  writeNode(formatter: SourceFormatter) {
    const pre = this.pre.write(formatter);
    const condition = this.condition.write(formatter);
    const post = this.post.write(formatter);
    const body = this.body.write(formatter);
    return `for ${pre} ${condition} ${post} ${body}`;
  }
}

export class YulFunctionDefinition extends BaseYulNode {
  nodeType: "YulFunctionDefinition" = "YulFunctionDefinition";
  constructor(
    public name: string,
    public parameters: YulIdentifier[],
    public returnVariables: YulIdentifier[],
    public body: YulBlock,
    public parent?: YulBlock
  ) {
    super();
  }

  get children() {
    return this.pickNodes(this.parameters, this.returnVariables, this.body);
  }

  writeNode(formatter: SourceFormatter) {
    const args = this.parameters
      ? this.parameters.map((arg) => arg.write(formatter))
      : undefined;
    const rets = this.returnVariables
      ? this.returnVariables.map((v) => v.write(formatter))
      : undefined;
    const body = this.body.write(formatter);
    const definition = ["function", this.name];
    definition.push(args ? "(" + args.join(", ") + ")" : "()");
    if (rets) {
      definition.push("-> " + rets.join(", "));
    }
    definition.push(body);
    return definition.join(" ");
  }
}
