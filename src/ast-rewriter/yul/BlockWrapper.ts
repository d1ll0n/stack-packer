import { CastableToYulExpression, smartAdd } from "./utils";
import { Factory } from "../Factory";
import { NodeQ } from "../NodeQ";
import { SourceUnit, VariableDeclaration } from "solc-typed-ast";
import { toHex } from "../../lib/bytes";
import { YulBlock, YulIdentifier } from "./ast";

const toScopedName = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join("_");

export class BlockWrapper {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    public factory: Factory,
    public sourceUnit: SourceUnit,
    public block: YulBlock,
    public useNamedConstants?: boolean
  ) {}

  originalBlock?: YulBlock;

  $ = this.factory.yul;
  push = this.block.appendChild;
  let = this.block.let;
  set = this.block.set;

  get root() {
    return this.block.rootBlock;
  }

  findConstant = (name: string): VariableDeclaration | undefined =>
    NodeQ.from(this.sourceUnit).find("VariableDeclaration", { name })[0];

  getConstant(name: string, value: string | number) {
    if (this.useNamedConstants) {
      return this.factory.getYulConstant(this.sourceUnit, name, value);
    }
    return this.$.literal(value);
  }

  getOffsetExpression(
    ptr: CastableToYulExpression,
    offset: CastableToYulExpression,
    fieldName?: string,
    ptrSuffix?: string
  ) {
    const ptrAsConst = this.$.resolveConstantValue(ptr, true);
    const offsetAsConst = this.$.resolveConstantValue(offset, true);
    if (ptrAsConst !== undefined && offsetAsConst !== undefined) {
      return this.getConstant(
        toScopedName(fieldName, ptrSuffix, "ptr"),
        toHex(ptrAsConst + offsetAsConst)
      );
    }
    if (offsetAsConst && !(offset instanceof YulIdentifier)) {
      const offsetNode = this.getConstant(
        toScopedName(fieldName, "offset"),
        toHex(offsetAsConst)
      );
      return smartAdd(ptr, offsetNode);
    }
    return smartAdd(ptr, offset);
  }

  enterFn(
    name: string,
    parameters: (string | YulIdentifier)[],
    returnParameters: (string | YulIdentifier)[]
  ) {
    this.originalBlock = this.block;
    const fn = this.$.makeYulFunctionDefinition(
      name,
      parameters,
      returnParameters,
      undefined,
      this.root as YulBlock
    );
    this.block.insertAtBeginning(fn);
    this.block = fn.body;

    return fn;
  }

  exitFn() {
    if (!this.originalBlock) {
      throw Error(`Can not exit`);
    }
    this.block = this.originalBlock;
    this.originalBlock = undefined;
  }
}
