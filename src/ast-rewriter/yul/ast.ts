/* eslint-disable no-redeclare */
/* eslint-disable no-useless-constructor */
/* eslint-disable no-dupe-class-members */
import {
  ASTNode,
  InlineAssembly,
  LiteralKind,
  SourceFormatter,
  StructuredDocumentation,
  VariableDeclaration,
} from "solc-typed-ast";
import {
  CastableToIdentifierOrLiteral,
  definitelyIdentifierList,
  isConstant,
  makeYulIdentifier,
  makeYulLiteral,
} from "./utils";
import { coerceArray } from "../../lib/text";
import { ExpressionAccessors, withExpressionAccessors } from "./arithmetic";
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

function renderDocs(text: string, formatter: SourceFormatter) {
  const indent = formatter.renderIndent();
  const prefix = "/// ";

  const documentation = text.replace(/\n/g, (sub) => sub + indent + prefix);

  return prefix + documentation;
}

export class BaseYulNode extends ASTNode {
  documentation?: string | string[];

  constructor(public id = ++randomId, public src = "0:0:0") {
    super(id, src);
  }

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
          !getters.includes(name) &&
          name !== "requiredContext"
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
    const inner = [this.writeNode(formatter)];
    const indent = formatter.renderIndent();
    if (this.documentation) {
      inner[0] = indent + inner[0];
      const doc = coerceArray(this.documentation).join("\n");
      inner.unshift(doc);
    }
    return inner.join(formatter.renderWrap());
  }

  writeNode(formatter: SourceFormatter) {
    return "";
  }
}
export class YulBlock extends BaseYulNode {
  nodeType: "YulBlock" = "YulBlock";

  get type(): "YulBlock" {
    return this.nodeType;
  }

  factory?: YulNodeFactory;
  public statements: YulNode[] = [];

  constructor(
    stmts: YulNode[] = [],
    public parent?:
      | YulCase
      | YulIf
      | YulForLoop
      | YulFunctionDefinition
      | InlineAssembly,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  addFunction(
    name: string,
    parameters: (string | YulIdentifier)[],
    returnVariables: (string | YulIdentifier)[],
    body: YulBlock = new YulBlock([])
  ) {
    const fnDef = new YulFunctionDefinition(
      name,
      definitelyIdentifierList(parameters),
      definitelyIdentifierList(returnVariables),
      body,
      this
    );
    body.parent = fnDef;
    // const fn =
    return this.addFunctionIfNotExists(fnDef);
    // return new YulIdentifier(fn.name, fn);
  }

  let(
    names: string,
    node: CastableToIdentifierOrLiteral,
    documentation?: string | string[]
  ): YulIdentifier;

  let(
    names: string[],
    node: CastableToIdentifierOrLiteral,
    documentation?: string | string[]
  ): YulIdentifier[];

  let(
    names: MaybeArray<string>,
    node: CastableToIdentifierOrLiteral,
    documentation?: string | string[]
  ) {
    if (isConstant(node)) {
      if (typeof node !== "object") node = makeYulLiteral(node);
    }
    const decl = new YulVariableDeclaration(
      definitelyIdentifierList(names) as YulGenericIdentifier[],
      node as YulNode
    );
    decl.documentation = documentation;
    this.statements.push(decl);
    // this.factory.let(names, node as YulNode));
    if (!Array.isArray(names)) return makeYulIdentifier(names);
    return names.map((name) => makeYulIdentifier(name));
  }

  set(
    nodes: YulIdentifier | string,
    value: YulExpression,
    documentation?: string | string[]
  ): YulIdentifier;

  set(
    nodes: (YulIdentifier | string)[],
    value: YulExpression,
    documentation?: string | string[]
  ): YulIdentifier[];

  set(
    nodes: MaybeArray<YulIdentifier | string>,
    value: YulExpression,
    documentation?: string | string[]
  ) {
    // set(node: YulIdentifier | string, value: YulExpression) {
    const identifiers = Array.isArray(nodes)
      ? nodes.map((node) =>
          node instanceof YulIdentifier ? node : makeYulIdentifier(node)
        )
      : nodes;
    if (coerceArray(nodes).some((n) => n instanceof YulIdentifier)) {
      const assignment = new YulAssignment(
        definitelyIdentifierList(nodes),
        value
      );
      this.appendChild(assignment);
      assignment.documentation = documentation;
    } else {
      this.let(nodes as string[], value, documentation);
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

  get type(): "YulLiteral" {
    return this.nodeType;
  }

  constructor(
    public kind: LiteralKind,
    public value?: string | number,
    public hexValue?: string,
    public typeString?: string,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

    const typeSuffix = this.typeString ? ":" + this.typeString : "";
    return result + typeSuffix;
  }
}
export interface YulLiteral extends ExpressionAccessors {}

@withExpressionAccessors
export class YulIdentifier extends BaseYulNode {
  nodeType: "YulIdentifier" = "YulIdentifier";

  get type(): "YulIdentifier" {
    return this.nodeType;
  }

  constructor(
    public name: string,
    public vReferencedDeclaration?: VariableDeclaration | YulFunctionDefinition,
    id?: number,
    src?: string
  ) {
    super(id, src);
  }

  writeNode(formatter: SourceFormatter) {
    return this.name;
  }
}
export interface YulIdentifier extends ExpressionAccessors {}

@withExpressionAccessors
export class YulTypedName extends BaseYulNode {
  nodeType: "YulTypedName" = "YulTypedName";

  get type(): "YulTypedName" {
    return this.nodeType;
  }

  constructor(
    public name: string,
    public typeString?: string,
    id?: number,
    src?: string
  ) {
    super(id, src);
  }

  writeNode(formatter: SourceFormatter) {
    const typeSuffix = this.typeString ? ":" + this.typeString : "";
    return this.name + typeSuffix;
  }
}
export interface YulTypedName extends ExpressionAccessors {}

@withExpressionAccessors
export class YulFunctionCall extends BaseYulNode {
  nodeType: "YulFunctionCall" = "YulFunctionCall";

  get type(): "YulFunctionCall" {
    return this.nodeType;
  }

  public arguments: YulNode[];
  constructor(
    public functionName: YulIdentifier,
    _arguments: YulNode[],
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulVariableDeclaration" {
    return this.nodeType;
  }

  constructor(
    public variables: YulNode[],
    public value: YulNode,
    public typeString?: string,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulExpressionStatement" {
    return this.nodeType;
  }

  constructor(public expression: YulNode, id?: number, src?: string) {
    super(id, src);
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

  get type(): "YulAssignment" {
    return this.nodeType;
  }

  constructor(
    public variableNames: YulGenericIdentifier[],
    public value: YulNode,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulIf" {
    return this.nodeType;
  }

  constructor(
    public condition: YulNode,
    public body: YulNode,
    public parent?: YulBlock,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulCase" {
    return this.nodeType;
  }

  constructor(
    public value: "default" | YulLiteral,
    public body: YulNode,
    public parent?: YulSwitch,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulSwitch" {
    return this.nodeType;
  }

  constructor(
    public expression: YulNode,
    public cases: YulCase[],
    public parent?: YulBlock,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulContinue" {
    return this.nodeType;
  }

  writeNode(formatter: SourceFormatter) {
    return "continue";
  }
}

export class YulBreak extends BaseYulNode {
  nodeType: "YulBreak" = "YulBreak";

  get type(): "YulBreak" {
    return this.nodeType;
  }

  writeNode(formatter: SourceFormatter) {
    return "break";
  }
}

export class YulLeave extends BaseYulNode {
  nodeType: "YulLeave" = "YulLeave";

  get type(): "YulLeave" {
    return this.nodeType;
  }

  writeNode(formatter: SourceFormatter) {
    return "leave";
  }
}

export class YulForLoop extends BaseYulNode {
  nodeType: "YulForLoop" = "YulForLoop";

  get type(): "YulForLoop" {
    return this.nodeType;
  }

  constructor(
    public pre: YulBlock,
    public condition: YulExpression,
    public post: YulBlock,
    public body: YulBlock,
    public parent?: YulBlock,
    id?: number,
    src?: string
  ) {
    super(id, src);
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

  get type(): "YulFunctionDefinition" {
    return this.nodeType;
  }

  constructor(
    public name: string,
    public parameters: YulIdentifier[],
    public returnVariables: YulIdentifier[],
    public body: YulBlock,
    public parent?: YulBlock,
    id?: number,
    src?: string
  ) {
    super(id, src);
  }

  get children() {
    return this.pickNodes(this.parameters, this.returnVariables, this.body);
  }

  call(parameters: YulExpression[]) {
    return new YulFunctionCall(makeYulIdentifier(this.name), parameters);
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
