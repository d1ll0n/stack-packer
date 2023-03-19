import "../lib/String";
// import { ABIEncoderVersion } from "solc-typed-ast/dist/types/abi";

import path from "path";
import { compileSources } from "./compile";
import { NodeQ } from "./NodeQ";

import {
  ASTContext,
  ASTReader,
  ASTWriter,
  CompileResult,
  DefaultASTWriterMapping,
  Expression,
  FunctionCallKind,
  FunctionDefinition,
  FunctionKind,
  FunctionStateMutability,
  FunctionVisibility,
  LatestCompilerVersion,
  PrettyFormatter,
  replaceNode,
  Return,
  SourceUnit,
  TypeName,
  VariableDeclaration,
} from "solc-typed-ast";

import { Factory } from "./Factory";
import { getParentSourceUnit } from "./utils";
import { TypeCheck } from "./types";

const JumpTableTemplatePath = path.join(
  __dirname,
  "../../lib/src/JumpTable.sol"
);

export class ProjectRewriter extends NodeQ {
  ["$"]: Factory;
  // reader: ASTReader;
  writer: ASTWriter;
  context: ASTContext;
  // sourceUnits: SourceUnit[];
  ownSources: Record<string, SourceUnit> = {};

  get entryFile() {
    return this.sourceUnits.find(
      (source) => source.absolutePath === this.entryPath
    );
  }

  constructor(
    public compileResult: CompileResult,
    public sourceUnits: SourceUnit[],
    public reader: ASTReader,
    public projectRoot: string,
    public entryPath: string
  ) {
    super(sourceUnits);
    const formatter = new PrettyFormatter(4, 0);
    this.writer = new ASTWriter(
      DefaultASTWriterMapping,
      formatter,
      compileResult.compilerVersion
        ? compileResult.compilerVersion
        : LatestCompilerVersion
    );
    this.context = reader.context;
    this.$ = new Factory(reader.context);
  }

  static async create(entryPath: string) {
    const { compileResult, reader, projectRoot, sourceUnits } =
      await compileSources(entryPath);

    const rewriter = new ProjectRewriter(
      compileResult,
      sourceUnits,
      reader,
      projectRoot,
      entryPath
    );
    await rewriter.copyJumpTableLibrary();
    return rewriter;
  }

  moveInputDeclarationsToBody(fn: FunctionDefinition) {
    const { vBody, vParameters } = fn;

    for (const parameter of vParameters.children as VariableDeclaration[]) {
      const copy = this.$.copy(parameter);
      vParameters.removeChild(parameter);
      const statement = this.$.makeVariableDeclarationStatement(
        [copy.id],
        [copy]
      );
      vBody.insertAtBeginning(statement);
    }
  }

  async copyJumpTableLibrary() {
    // @todo map lib fns relevant to this contract
    const libFile = this.makeSourceUnit("JumpTable.sol");
    const {
      sourceUnits: [jumpTableSource],
    } = await compileSources(JumpTableTemplatePath);
    for (const child of jumpTableSource.children) {
      libFile.appendChild(this.$.copy(child));
    }
    // const gotoFns = NodeQ.from(libFile).findFunctionsByName("goto");
    return libFile;
  }

  makeSourceUnit(fileName: string) {
    if (this.ownSources[fileName]) {
      return this.ownSources[fileName];
    }
    const absolutePath = path.join(this.projectRoot, fileName);
    const source = this.$.makeSourceUnit(
      absolutePath,
      this.sourceUnits.length,
      absolutePath,
      new Map<string, number>(),
      []
    );
    this.sourceUnits.push(source);
    this.ownSources[fileName] = source;

    return source;
  }

  _makeReturnFunction(originalFunction: FunctionDefinition) {
    const { vReturnParameters } = originalFunction;
    const ioFile = this.makeSourceUnit("FunctionInputOutput.sol");

    const returnFunction = this.$.makeFunctionDefinition(
      ioFile.id,
      FunctionKind.Function,
      `_return${originalFunction.name.toPascalCase()}`,
      true,
      FunctionVisibility.Default,
      FunctionStateMutability.Pure,
      false,
      this.$.copy(vReturnParameters),
      this.$.makeParameterList([]),
      []
    );
    ioFile.appendChild(returnFunction);
    this.$.getRequiredImports(originalFunction, ioFile);

    return returnFunction;
  }

  getMappingAccess(mapping: VariableDeclaration) {
    // if (map)
    // mapping.
    console.log(this.writer.write(mapping.vType));
    console.log(this.writer.write(mapping.vValue));
  }

  handleReturn(fn: FunctionDefinition) {
    const { vBody, vReturnParameters } = fn;
    if (!vReturnParameters.children.length) return;
    // @todo - handle by adding wrapper fn
    if (this.findFunctionCalls(fn).length > 0) return;
    const returnFn = this._makeReturnFunction(fn);

    const returnStatements = fn.getChildrenByTypeString(
      "Return",
      true
    ) as Return[];

    const paramTypeStrings = vReturnParameters.vParameters.map(
      (v: VariableDeclaration) => v.typeString
    );
    const returnTypeString = (
      paramTypeStrings.length > 1
        ? `tuple(${paramTypeStrings.join(",")})`
        : paramTypeStrings[0]
    )
      .replace(/(struct\s+)([\w\d]+)/g, "$1$2 memory")
      .replace(/\[\]/g, "[] memory");

    for (const returnStatement of returnStatements) {
      const identifier = this.$.makeIdentifierFor(returnFn);

      const _call = this.$.makeFunctionCall(
        returnTypeString,
        FunctionCallKind.FunctionCall,
        identifier,
        returnStatement.children as Expression[]
      );
      const callExpression = this.$.makeExpressionStatement(_call);
      replaceNode(returnStatement, callExpression);
    }

    while (vReturnParameters.children.length > 0) {
      const parameter = vReturnParameters.children[0] as VariableDeclaration;
      const copy = this.$.copy(parameter);
      const statement = this.$.makeVariableDeclarationStatement(
        [copy.id],
        [copy]
      );
      // Define return params at start of body
      if (parameter.name) {
        vBody.insertAtBeginning(statement);
      }
      // Remove return parameter
      vReturnParameters.removeChild(parameter);
    }
  }

  makeStateVariableGetter(stateVariable: VariableDeclaration) {
    const parameters = this.$.makeParameterList([]);
    const returnParameters = this.$.makeParameterList([]);
    const body = this.$.makeBlock([]);
    const fn = this.$.makeFunctionDefinition(
      getParentSourceUnit(stateVariable).id,
      FunctionKind.Function,
      `fn_${stateVariable.name}`,
      true,
      FunctionVisibility.External,
      FunctionStateMutability.View,
      false,
      parameters,
      returnParameters,
      [],
      undefined,
      body
    );
    let accessor: Expression = this.$.makeIdentifierFor(stateVariable);
    let i = 0;
    let vType = stateVariable.vType;
    let hasKey = TypeCheck.isArrayTypeName(vType) || TypeCheck.isMapping(vType);
    while (hasKey) {
      let key: TypeName;
      if (TypeCheck.isMapping(vType)) {
        key = this.$.copy(vType.vKeyType);
        vType = vType.vValueType;
      } else if (TypeCheck.isArrayTypeName(vType)) {
        key = this.$.makeTypeNameUint256();
        vType = vType.vBaseType;
      } else {
        console.log(`vType: ${vType.type}`);
      }
      hasKey = TypeCheck.isArrayTypeName(vType) || TypeCheck.isMapping(vType);
      const param = this.$.addParameter(parameters, `key${i++}`, key);
      accessor = this.$.makeIndexAccess(
        vType.typeString,
        accessor,
        this.$.makeIdentifierFor(param)
      );
    }
    body.appendChild(this.$.makeReturn(1, accessor));
    this.$.addParameter(returnParameters, "value", vType);
    // this.$.makeretu
    // this.$.makeMemberAccess()
    return fn;
  }
}
