import { ArrayJoinInput, CodeGenFunction } from "../types";
import { generateFunctionCode } from "./codegen-helpers";
import { generateNotice, toCommentSeparator } from "./comments";

export type ProjectType = 'hardhat.ts' | 'hardhat.js' | 'foundry'

export const getDeclareConstant = (name: string, value: string) =>
  `uint256 constant ${name} = ${value};`;

export type GeneratorOptions = {
  oversizedInputs?: boolean;
  inline?: boolean;
  unsafe?: boolean;
  noComments?: boolean;
  constantsFile?: boolean;
  output: string;
  testContractsDirectory?: string;
  hardhatTestsDirectory?: string;
  projectType?: ProjectType
}

const DefaultFileHeader = [
  '// SPDX-License-Identifier: MIT',
  `pragma solidity >=0.8.0;`,
];

export const generateFileHeader = (withNotice?: boolean, unsafeWarning?: boolean, imports?: string[]) => [
  ...DefaultFileHeader,
  '',
  ...(imports ? [...imports, ''] : []),
  '',
  ...(withNotice ? [...generateNotice(unsafeWarning), ''] : []),
]

export class FileContext {
  constants: string[] = [];
  code: ArrayJoinInput<string>[] = [];
  functions: CodeGenFunction[] = [];

  constructor(public opts: GeneratorOptions) {}

  get checkOverflows() {
    return this.opts.oversizedInputs && !this.opts.unsafe;
  }

  addFunctions(fns: CodeGenFunction[], sectionTitle?: string) {
    if (!fns.length) return;
    this.functions.push(...fns);
    const code: ArrayJoinInput<string>[] = [];
    for (const fn of fns) {
      code.push('', ...generateFunctionCode(fn))
    }
    if (sectionTitle) {
      this.addSection(sectionTitle, code);
    } else {
      this.code.push(...code)
    }
  }

  clearCode() {
    this.code = [];
    if (!this.opts.constantsFile) {
      this.constants = [];
    }
    this.functions = [];
  }

  addSection(title: string, code: ArrayJoinInput<string>[]) {
    this.code.push('', ...toCommentSeparator(title))
    this.code.push(...code)
  }

  /**
   * Add a constant and get the reference to it
   * @param name Name of constant to use
   * @param value Value for the constant
   * @returns Reference to the constant - `name` if `inline`
   * option is false, otherwise `value`.
   */
  addConstant(name: string, value: string): string {
    if (this.opts.inline) {
      return value;
    }
    const _declaration = getDeclareConstant(name, value);
    if (!this.constants.includes(_declaration)) {
      this.constants.push(_declaration);
    }
    return name;
  }
}