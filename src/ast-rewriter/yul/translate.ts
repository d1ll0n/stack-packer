import { YulNodeTypeString } from "../types";

import { InlineAssembly, YulNode as OriginalYulNode } from "solc-typed-ast";
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
  YulIdentifier,
  YulIf,
  YulLeave,
  YulLiteral,
  YulNode,
  YulSwitch,
  YulTypedName,
  YulVariableDeclaration,
} from "./ast";

export const YulTranslator = new Map<
  YulNodeTypeString,
  (node: OriginalYulNode, parent?: YulNode | InlineAssembly) => YulNode
>([
  [
    "YulBlock",
    (node: OriginalYulNode, parent?: YulNode | InlineAssembly) =>
      new YulBlock(
        (node.statements || []).map((stmt) => translateYulNode(stmt)),
        parent as YulBlock["parent"] | undefined
      ),
  ],
  [
    "YulLiteral",
    (node: OriginalYulNode) =>
      new YulLiteral(node.kind, node.value, node.hexValue, node.type),
  ],
  ["YulIdentifier", (node: OriginalYulNode) => new YulIdentifier(node.name)],
  ["YulTypedName", (node: OriginalYulNode) => new YulTypedName(node.name)],
  [
    "YulFunctionCall",
    (node: OriginalYulNode) =>
      new YulFunctionCall(
        translateYulNode(node.functionName) as YulIdentifier,
        (node.arguments || []).map((arg) => translateYulNode(arg))
      ),
  ],
  [
    "YulVariableDeclaration",
    (node: OriginalYulNode) =>
      new YulVariableDeclaration(
        (node.variables || []).map((node) => translateYulNode(node)),
        translateYulNode(node.value)
      ),
  ],
  [
    "YulExpressionStatement",
    (node: OriginalYulNode) =>
      new YulExpressionStatement(translateYulNode(node.expression)),
  ],
  [
    "YulAssignment",
    (node: OriginalYulNode) =>
      new YulAssignment(
        (node.variableNames || []).map((node) => translateYulNode(node)),
        translateYulNode(node.value)
      ),
  ],
  [
    "YulIf",
    (node: OriginalYulNode, parent?: YulNode) =>
      new YulIf(
        translateYulNode(node.condition),
        translateYulNode(node.body),
        parent as YulBlock | undefined
      ),
  ],
  [
    "YulCase",
    (node: OriginalYulNode, parent?: YulNode) =>
      new YulCase(
        translateYulNode(node.value) as YulLiteral,
        translateYulNode(node.body),
        parent as YulSwitch | undefined
      ),
  ],
  [
    "YulSwitch",
    (node: OriginalYulNode, parent?: YulNode) =>
      new YulSwitch(
        translateYulNode(node.expression),
        (node.cases || []).map((_case) => translateYulNode(_case)),
        parent as YulBlock | undefined
      ),
  ],
  ["YulContinue", (node: OriginalYulNode) => new YulContinue()],
  ["YulBreak", (node: OriginalYulNode) => new YulBreak()],
  ["YulLeave", (node: OriginalYulNode) => new YulLeave()],
  [
    "YulForLoop",
    (node: OriginalYulNode, parent?: YulNode) =>
      new YulForLoop(
        translateYulNode(node.pre) as YulBlock,
        translateYulNode(node.condition) as YulExpression,
        translateYulNode(node.post) as YulBlock,
        translateYulNode(node.body) as YulBlock,
        parent as YulBlock | undefined
      ),
  ],
  [
    "YulFunctionDefinition",
    (node: OriginalYulNode, parent?: YulNode) =>
      new YulFunctionDefinition(
        node.name,
        (node.parameters || []).map((v) => translateYulNode(v)),
        (node.returnVariables || []).map((v) => translateYulNode(v)),
        translateYulNode(node.body) as YulBlock,
        parent as YulBlock | undefined
      ),
  ],
]);

export const translateYulNode = (
  node: OriginalYulNode,
  parent?: OriginalYulNode | InlineAssembly
): YulNode => {
  const translator = YulTranslator.get(node.nodeType as YulNodeTypeString);
  if (!translator) {
    throw Error(`Translator does not exist for ${node.nodeType}`);
  }
  return translator(
    node,
    parent &&
      (parent instanceof InlineAssembly ? parent : translateYulNode(parent))
  );
};
