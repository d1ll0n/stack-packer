import "../lib/String";
import { addSeparators, coerceArray, wrapBrackets } from "../lib/text";
import {
  ASTNode,
  CallableDefinition,
  ContractDefinition,
  ContractKind,
  FunctionDefinition,
  FunctionVisibility,
  InlineAssembly,
  StateVariableVisibility,
  XPath,
} from "solc-typed-ast";
import {
  ASTNodeTypeMap,
  ASTNodeTypeString,
  StringOrNumberAttributes,
  YulNodeTypeMap,
  YulNodeTypeString,
} from "./types";
import {
  translateYulNode,
  YulFunctionDefinition,
  YulNode,
  YulXPath,
} from "./yul";

export function getParentsRecursive(
  contract: ContractDefinition,
  allowInterfaces?: boolean
): ContractDefinition[] {
  const parents = contract.vInheritanceSpecifiers
    .map((parent) => parent.vBaseType.vReferencedDeclaration)
    .filter(
      (parent: ContractDefinition) =>
        allowInterfaces || parent.kind === ContractKind.Contract
    ) as ContractDefinition[];
  for (const parent of parents) {
    const _parents = getParentsRecursive(parent, allowInterfaces);
    _parents.forEach((ancestor) => {
      if (!parents.find((p) => p.name === ancestor.name)) {
        parents.push(ancestor);
      }
    });
  }
  return parents;
}

export class NodeQ {
  xPaths: XPath[] = [];
  constructor(nodes: ASTNode[]) {
    this.xPaths = nodes.map((unit) => new XPath(unit));
  }

  queryAll<T = any>(xPathQueryString: string): T[] {
    const result: T[] = [];
    for (const xpath of this.xPaths) {
      result.push(...(xpath.query(xPathQueryString) || []));
    }
    return result;
  }

  findContract(name: string): ContractDefinition {
    return this.queryAll<ContractDefinition>(
      `//ContractDefinition[@name="${name}"]`
    )[0];
  }

  findFunctionsByName(name: string): FunctionDefinition[] {
    return this.queryAll(`//FunctionDefinition[@name="${name}"]`);
  }

  find<T extends ASTNodeTypeString>(
    tag: T,
    attributes: Partial<StringOrNumberAttributes<ASTNodeTypeMap[T]>> = {}
  ): ASTNodeTypeMap[T][] {
    const attributeComponents = addSeparators(
      Object.keys(attributes).map((key, i) => {
        const value = attributes[key];
        if (key[0] !== "@") key = `@${key}`;
        return `${key}=${typeof value === "number" ? value : `"${value}"`}`;
      }),
      " and "
    );
    if (attributeComponents.length) {
      wrapBrackets(attributeComponents);
    }
    const attributeString = attributeComponents.join("");
    console.log(attributeString);
    return this.queryAll(`//${tag}${attributeString}`);
  }

  findFunctionsByVisibility(visibility: FunctionVisibility) {
    return this.find("FunctionDefinition", { visibility });
  }

  findStateVariablesByVisibility(visibility: StateVariableVisibility) {
    return this.find("VariableDeclaration", { visibility });
  }

  findFunctionCalls(fn: CallableDefinition) {
    return this.find("FunctionCall", { vIdentifier: fn.name }).filter(
      (fnCall) => fnCall.vReferencedDeclaration.id === fn.id
    );
  }

  isFunctionInternallyReferenced(fn: CallableDefinition): boolean {
    return this.findFunctionCalls(fn).length > 0;
  }

  static fromContract(contract: ContractDefinition, allowInterfaces?: boolean) {
    const ancestors = getParentsRecursive(contract, allowInterfaces);
    return new NodeQ([contract, ...ancestors]);
  }

  fromContract(name: string, allowInterfaces?: boolean): NodeQ {
    return NodeQ.fromContract(this.findContract(name), allowInterfaces);
  }

  static from(node: ASTNode | ASTNode[]) {
    return new NodeQ(coerceArray(node));
  }
}

export class YulQ {
  xPaths: YulXPath[] = [];
  constructor(nodes: YulNode[]) {
    this.xPaths = nodes.map((unit) => new YulXPath(unit));
  }

  queryAll<T = any>(xPathQueryString: string): T[] {
    const result: T[] = [];
    for (const xpath of this.xPaths) {
      result.push(...(xpath.query(xPathQueryString) || []));
    }
    return result;
  }

  findFunctionsByName(name: string): YulFunctionDefinition[] {
    return this.queryAll(`//YulFunctionDefinition[@name="${name}"]`);
  }

  find<T extends YulNodeTypeString>(
    tag: T,
    attributes: Partial<StringOrNumberAttributes<YulNodeTypeMap[T]>> = {}
  ): YulNodeTypeMap[T][] {
    const attributeComponents = addSeparators(
      Object.keys(attributes).map((key, i) => {
        const value = attributes[key];
        if (key[0] !== "@") key = `@${key}`;
        return `${key}=${typeof value === "number" ? value : `"${value}"`}`;
      }),
      " and "
    );
    if (attributeComponents.length) {
      wrapBrackets(attributeComponents);
    }
    const attributeString = attributeComponents.join("");
    console.log(attributeString);
    return this.queryAll(`//${tag}${attributeString}`);
  }

  findFunctionCalls(fn: YulFunctionDefinition) {
    return this.find("YulFunctionCall", { vFunctionName: fn.name });
  }

  isFunctionInternallyReferenced(fn: YulFunctionDefinition): boolean {
    return this.findFunctionCalls(fn).length > 0;
  }

  static from(node: YulNode | YulNode[]) {
    return new YulQ(coerceArray(node));
  }

  static fromInlineAssembly(node: InlineAssembly) {
    const stmts = node.yul.statements.map((stmt) =>
      translateYulNode(stmt, node)
    );
    return new YulQ(stmts);
  }
}
