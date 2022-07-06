import { ArrayJoinInput } from "../types";
import { generateNotice, toCommentSeparator } from "./comments";

export const getDeclareConstant = (name: string, value: string) =>
  `uint256 constant ${name} = ${value};`;

export type GeneratorOptions = {
  oversizedInputs?: boolean;
  inline?: boolean;
  unsafe?: boolean;
  noComments?: boolean;
  constantsFile?: boolean;
}

const DefaultFileHeader = [
  '// SPDX-License-Identifier: MIT',
  `pragma solidity >=0.8.0;`,
];

export const generateFileHeader = (withNotice?: boolean, unsafeWarning?: boolean, imports?: string[]) => [
  ...DefaultFileHeader,
  '',
  ...[imports ? [...imports, ''] : []],
  ...(withNotice ? [...generateNotice(unsafeWarning), ''] : []),
]

export class FileContext {
  constants: string[] = [];
  code: ArrayJoinInput<string>[] = [];

  constructor(public opts: GeneratorOptions) {}

  get checkOverflows() {
    return this.opts.oversizedInputs && !this.opts.unsafe;
  }

  clearCode() {
    this.code = [];
    if (!this.opts.constantsFile) {
      this.constants = [];
    }
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