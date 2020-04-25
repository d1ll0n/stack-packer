import {
  AbiStruct, AbiStructField, AbiElementaryType, AbiEnum, AbiType, AbiArray, ArrayJoinInput
} from '../lib/types';

import { isStructAllowed, getFieldConstructor, toTypeName, abiStructToSol, arrJoiner } from '../lib/helpers';

export type SolGenOptions = {
  /* Used to determine whether vars are explicitly defined or simply assigned directly to memory. */
  verbose?: boolean
}

export class UnpackerGen {
  _inputOffset: number = 0;
  outputOffset: number = 0;
  varDefs: string[] = [];
  codeChunks: ArrayJoinInput[] = [];
  asmLines: string[] = [
    `let ptr := add(input, 32)`,
  ];
  outputDef: string;
  struct: AbiStruct;
  options?: SolGenOptions;

  get inputOffset(): number { return this._inputOffset / 8; }
  get ptr(): string { return this.inputOffset > 0 ? `add(ptr, ${this.inputOffset})` : `ptr`; }
  get outPtr(): string { return this.outputOffset > 0 ? `add(ret, ${this.outputOffset})` : `ret`; }
  get mload(): string { return `mload(${this.ptr})`; }

  static createLibrary(libraryName: string, structs: Array<AbiStruct | AbiEnum>, opts?: SolGenOptions): string {
    const arr = [];
    for (let struct of structs) arr.push(
      struct.meta == 'enum'
        ? abiStructToSol(struct)
        : new UnpackerGen(struct, opts).toUnpack(true)
    )
    return arrJoiner([
      `pragma solidity ^0.6.0;`,
      '',
      `library ${libraryName} {`,
      ...(arr.map(x => ([...x, '']))),
      `}`
    ])
  }

  constructor(struct: AbiStruct, opts: SolGenOptions = { verbose: true }) {
    this.options = opts;
    if (!isStructAllowed(struct)) {
      console.log(struct.name)
      throw new Error(`Dynamic structs must only contain dynamic fields as the last value.`)
    }
    this.struct = struct;
    for (let field of struct.fields) this.addUnpackField(field);
  }

  putAsm = (line: string) => this.asmLines.push(line);
  putCode = (line: string) => this.codeChunks.push(line);
  putIndentedCode = (line: string) => this.codeChunks.push([ line ]);
  nextCodeChunk = () => {
    let arr = [...this.asmLines];
    this.codeChunks.push(...[`assembly {`, arr, `}`]);
    this.asmLines = [`let ptr := add(input, 32)`];
  };

  toUnpack(returnArray?: boolean): ArrayJoinInput {
    const { name } = this.struct;
    this.nextCodeChunk();
    let retVar: string, retLine: string | null;
    if (!this.options.verbose && !this.struct.dynamic) {
      retVar = `${name} memory ret`;
      retLine = null;
    } else {
      retVar = `${name} memory`;
      retLine = `return ${getFieldConstructor(this.struct)};`;
    }
    const arr = [
      ...abiStructToSol(this.struct),
      '',
      `function unpack${name}(bytes memory input)`,
      `internal pure returns (${retVar}) {`,
      this.varDefs,
      this.codeChunks,
      [retLine],
      '}'
    ]
    return returnArray ? arr : arrJoiner(arr);
  }

  getShiftedSizeReader(size: number): string {
    if (size == 256) return `mload(${this.ptr})`;
    if (size > 256) throw new Error('Size over 256 bits not supported.');
    if (size % 8 != 0) throw new Error('Sizes not divisible into bytes not supported.')
    let shift = 256 - size;
    return `shr(${shift}, ${this.mload})`
  }

  putAsmReadCode(def: AbiElementaryType | AbiEnum, name: string) {
    let _reader = this.getShiftedSizeReader(def.size);
    if (!this.options.verbose && !this.struct.dynamic) {
      this.putAsm(`mstore(${this.outPtr}, ${_reader})`)
      this.outputOffset += 32;
    } else {
      this.putAsm(`${name} := ${_reader}`);
      this.varDefs.push(`${toTypeName(def)} ${name};`);
    }
    this._inputOffset += def.size;
  }

  putArrayReadCode(def: AbiArray, name: string) {
    const size = def.baseType.size;
    if (this.options.verbose || this.struct.dynamic) {
      this.varDefs.push(`${toTypeName(def)} memory ${name};`);
    }
    if (def.length && size) {
      for (let i = 0; i < def.length; i++) {
        let ptr: string;
        if (!this.options.verbose && !this.struct.dynamic) {
          ptr = this.outPtr;
          this.outputOffset += 32;
        } else {
          ptr = i == 0 ? name : `add(${name}, ${32 * i})`;
        }
        this.putAsm(`mstore(${ptr}, ${this.getShiftedSizeReader(size)})`)
        this._inputOffset += size;
      }
    }
    else throw new Error(`Arrays without a fixed type size and length are not supported yet.`);
  }

  addUnpackField(field: AbiStructField, scopeName?: string) {
    const name = `${scopeName ? scopeName + '_' : ''}${field.name}`;
    switch(field.type.meta) {
      case 'array':
        this.putArrayReadCode(field.type, name);
        break;
      case 'struct':
        for (let f of field.type.fields) this.addUnpackField(f, name);
        break;
      case 'enum':
      case 'elementary':
        this.putAsmReadCode(field.type, name);
    }
  }
}