import { ArrayJoinInput } from "../types";
import { toCommentSeparator } from "./comments";

export const getDeclareConstant = (name: string, value: string) =>
  `uint256 constant ${name} = ${value};`;

export type GeneratorOptions = {
  oversizedInputs: boolean;
  inline: boolean;
  unsafe: boolean;
  noComments: boolean;
}

export class FileContext {
  constants: string[] = [];
  code: ArrayJoinInput<string>[] = [];

  constructor(public opts: GeneratorOptions) {}

  get checkOverflows() {
    return this.opts.oversizedInputs && !this.opts.unsafe;
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