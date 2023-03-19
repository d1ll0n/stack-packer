import {
  ASTNode,
  SourceUnit,
  SymbolAlias,
  VariableDeclaration,
} from "solc-typed-ast";
import { getDir, getRelativePath } from "../project";
import { last } from "lodash";
import { NodeQ } from "./NodeQ";

export const symbolAliasToId = (symbolAlias: SymbolAlias) =>
  typeof symbolAlias.foreign === "number"
    ? symbolAlias.foreign
    : symbolAlias.foreign.id;

export const getParentSourceUnit = (node: ASTNode): SourceUnit => {
  if (node instanceof SourceUnit) return node;
  const sourceUnit = node.getClosestParentByTypeString("SourceUnit") as
    | SourceUnit
    | undefined;
  if (!sourceUnit) {
    throw Error(`Could not find SourceUnit ancestor of provided ${node.type}`);
  }
  return sourceUnit;
};

export const findConstantDeclaration = (
  node: ASTNode,
  name: string
): VariableDeclaration | undefined => {
  const sourceUnit = getParentSourceUnit(node);
  return NodeQ.from(sourceUnit).find("VariableDeclaration", {
    name,
  })[0];
};
