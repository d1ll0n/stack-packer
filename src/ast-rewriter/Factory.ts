import "../lib/String";
import { utf8ToHex } from "../lib/bytes";
import { YulNodeFactory } from "./yul";
import {
  ASTNodeFactory,
  Block,
  DataLocation,
  ElementaryTypeName,
  Expression,
  FunctionKind,
  FunctionStateMutability,
  FunctionVisibility,
  IndexAccess,
  InferType,
  isReferenceType,
  LatestCompilerVersion,
  Literal,
  LiteralKind,
  ModifierInvocation,
  Mutability,
  OverrideSpecifier,
  ParameterList,
  StateVariableVisibility,
  StructuredDocumentation,
  TypeName,
  VariableDeclaration,
} from "solc-typed-ast";
import { parseTypeName } from "./parse";

export const DefaultInfer = new InferType(LatestCompilerVersion);

export class Factory extends ASTNodeFactory {
  yul: YulNodeFactory = new YulNodeFactory();

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
