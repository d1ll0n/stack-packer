import "../lib/String";
import {
  ASTNode,
  ASTNodeFactory,
  Block,
  ContractDefinition,
  DataLocation,
  ElementaryTypeName,
  Expression,
  FunctionDefinition,
  FunctionKind,
  FunctionStateMutability,
  FunctionVisibility,
  IndexAccess,
  InferType,
  LatestCompilerVersion,
  Literal,
  LiteralKind,
  ModifierInvocation,
  Mutability,
  OverrideSpecifier,
  ParameterList,
  SourceUnit,
  StateVariableVisibility,
  StructuredDocumentation,
  SymbolAlias,
  TypeName,
  UserDefinition,
  VariableDeclaration,
} from "solc-typed-ast";
import {
  findConstantDeclaration,
  getParentSourceUnit,
  symbolAliasToId,
} from "./utils";
import { getDir, getRelativePath } from "../project";
import { last } from "lodash";
import { NodeQ } from "./NodeQ";
import { parseTypeName } from "./AbiTypeParser";
import { utf8ToHex } from "../lib/bytes";
import { YulNodeFactory } from "./yul";

export const DefaultInfer = new InferType(LatestCompilerVersion);

export class Factory extends ASTNodeFactory {
  yul: YulNodeFactory = new YulNodeFactory();

  /**
   * Add imports for `symbolAliases` in `importSource` to `sourceUnit`
   * if they are not already imported.
   */
  addImports(
    sourceUnit: SourceUnit,
    importSource: SourceUnit,
    symbolAliases: SymbolAlias[]
  ) {
    const { vImportDirectives } = sourceUnit;
    const directive = vImportDirectives.find(
      (_import) => _import.absolutePath === importSource.absolutePath
    );
    if (!directive) {
      const srcPath = getDir(sourceUnit.absolutePath);
      const directive = this.makeImportDirective(
        getRelativePath(srcPath, importSource.absolutePath),
        importSource.absolutePath,
        "",
        symbolAliases,
        sourceUnit.id,
        importSource.id
      );
      const pragma = last(
        sourceUnit.getChildrenByTypeString("PragmaDirective")
      );

      if (pragma) {
        sourceUnit.insertAfter(pragma, directive);
      } else {
        sourceUnit.insertAtBeginning(directive);
      }
    } else {
      for (const _symbol of directive.symbolAliases) {
        if (
          !directive.symbolAliases.find(
            (s) => symbolAliasToId(s) === symbolAliasToId(_symbol)
          )
        ) {
          directive.symbolAliases.push(_symbol);
        }
      }
    }
  }

  getRequiredImports(fn: FunctionDefinition, sourceUnit: SourceUnit) {
    const children = NodeQ.from(fn).find("UserDefinedTypeName");
    const importsNeeded = children.reduce((importDirectives, childType) => {
      const child = childType.vReferencedDeclaration as UserDefinition;
      if (child.vScope.id === fn.vScope.id) {
        return importDirectives;
      }
      const parent = getParentSourceUnit(child);
      if (!importDirectives[parent.id]) {
        importDirectives[parent.id] = [];
      }
      // If child scoped to file, import child directly.
      // If contract, import contract.
      const foreignSymbol = this.makeIdentifierFor(
        child.vScope.type === "SourceUnit"
          ? child
          : (child.vScope as ContractDefinition)
      );
      if (
        child.vScope.type === "SourceUnit" &&
        parent.absolutePath === sourceUnit.absolutePath
      ) {
        return importDirectives;
      }
      importDirectives[parent.id].push({
        foreign: foreignSymbol,
      } as SymbolAlias);
      return importDirectives;
    }, {} as Record<number, SymbolAlias[]>);
    const entries = Object.entries(importsNeeded);
    for (const [sourceId, symbolAliases] of entries) {
      const importSource = this.context.locate(+sourceId) as SourceUnit;
      this.addImports(sourceUnit, importSource, symbolAliases);
    }
  }

  declareConstant(
    name: string,
    scope: number,
    typeName: TypeName,
    visibility: StateVariableVisibility = StateVariableVisibility.Default,
    value?: Expression,
    documentation?: string | StructuredDocumentation,
    overrideSpecifier?: OverrideSpecifier
  ) {
    return this.makeVariableDeclaration(
      true,
      false,
      name,
      scope,
      false,
      DataLocation.Default,
      visibility,
      Mutability.Constant,
      typeName.typeString,
      documentation,
      typeName,
      overrideSpecifier,
      value
    );
  }

  toTypeNode = (typeName: TypeName) => {
    if (typeName.constructor.name === "ElementaryTypeName") {
      typeName = this.makeElementaryTypeNameExpression(
        typeName.typeString,
        typeName as ElementaryTypeName
      );
    }
    return DefaultInfer.typeOf(typeName);
  };

  addLocation(decl: VariableDeclaration) {
    const type = parseTypeName(decl.vType);
    const needsLocation =
      ["array", "struct"].includes(type.meta) || type.dynamic;

    if (needsLocation) {
      decl.storageLocation = DefaultInfer.inferVariableDeclLocation(decl);
    }
  }

  addParameter(
    parameters: ParameterList,
    name: string,
    typeName: TypeName,
    documentation?: string | StructuredDocumentation
  ) {
    const decl = this.makeVariableDeclaration(
      false,
      false,
      name,
      parameters.id,
      false,
      DataLocation.Default,
      StateVariableVisibility.Default,
      Mutability.Mutable,
      typeName.typeString,
      documentation,
      typeName
    );
    parameters.appendChild(decl);
    this.addLocation(decl);

    return decl;
  }

  literalUint256(n: string | number): Literal {
    const value = n.toString();
    return this.makeLiteral(
      `int_const ${value}`,
      LiteralKind.Number,
      utf8ToHex(value),
      value
    );
  }

  getConstant(node: ASTNode, name: string, value: string | number) {
    const sourceUnit = getParentSourceUnit(node);
    let existingConstant = findConstantDeclaration(sourceUnit, name);
    if (!existingConstant) {
      existingConstant = this.makeConstantUint256(name, value, sourceUnit.id);
      sourceUnit.appendChild(existingConstant);
    }
    return this.makeIdentifierFor(existingConstant);
  }

  getYulConstant(node: ASTNode, name: string, value: string | number) {
    return this.yul.identifierFor(this.getConstant(node, name, value));
  }

  makeTypeNameUint256() {
    return this.makeElementaryTypeName("uint256", "uint256", "nonpayable");
  }

  makeConstantUint256(name: string, value: string | number, scope: number) {
    return this.makeVariableDeclaration(
      true,
      false,
      name,
      scope,
      false,
      DataLocation.Default,
      StateVariableVisibility.Internal,
      Mutability.Constant,
      "uint256",
      undefined,
      this.makeTypeNameUint256(),
      undefined,
      this.literalUint256(value)
    );
  }

  makeMappingAccess(
    mapping: VariableDeclaration,
    index: string | number | Expression
  ): IndexAccess {
    const expression =
      typeof index === "string" || typeof index === "number"
        ? this.literalUint256(index)
        : index;
    return this.makeIndexAccess(
      mapping.typeString,
      this.makeIdentifierFor(mapping),
      expression
    );
  }

  defineFunction(
    scope: number,
    name: string,
    parameters: ParameterList = this.makeParameterList([]),
    returnParameters: ParameterList = this.makeParameterList([]),
    visibility: FunctionVisibility = FunctionVisibility.Internal,
    stateMutability: FunctionStateMutability = FunctionStateMutability.NonPayable,
    kind: FunctionKind = FunctionKind.Function,
    virtual: boolean = false,
    isConstructor: boolean = false,
    modifiers: ModifierInvocation[] = [],
    overrideSpecifier?: OverrideSpecifier,
    body?: Block,
    documentation?: string | StructuredDocumentation
  ) {
    return this.makeFunctionDefinition(
      scope,
      kind,
      name,
      virtual,
      visibility,
      stateMutability,
      isConstructor,
      parameters,
      returnParameters,
      modifiers,
      overrideSpecifier,
      body,
      documentation
    );
  }

  makeYulBlock = this.yul.makeYulBlock;

  makeYulLiteral = this.yul.makeYulLiteral;

  makeYulIdentifier = this.yul.makeYulIdentifier;

  makeYulTypedName = this.yul.makeYulTypedName;

  makeYulFunctionCall = this.yul.makeYulFunctionCall;

  makeYulVariableDeclaration = this.yul.makeYulVariableDeclaration;

  makeYulExpressionStatement = this.yul.makeYulExpressionStatement;

  makeYulAssignment = this.yul.makeYulAssignment;

  makeYulIf = this.yul.makeYulIf;

  makeYulCase = this.yul.makeYulCase;

  makeYulSwitch = this.yul.makeYulSwitch;

  makeYulContinue = this.yul.makeYulContinue;

  makeYulBreak = this.yul.makeYulBreak;

  makeYulLeave = this.yul.makeYulLeave;

  makeYulForLoop = this.yul.makeYulForLoop;

  makeYulFunctionDefinition = this.yul.makeYulFunctionDefinition;
}
