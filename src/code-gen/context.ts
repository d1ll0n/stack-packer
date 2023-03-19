import path from "path";
import { arrJoiner, coerceArray } from "../lib/text";
import { ArrayJoinInput, CodeGenFunction } from "../types";

import { generateFunctionCode } from "./codegen-helpers";
import { generateNotice, toCommentSeparator } from "./comments";

export type ProjectType = "hardhat.ts" | "hardhat.js" | "foundry";

export const getDeclareConstant = (name: string, value: string) =>
  `uint256 constant ${name} = ${value};`;

export type GeneratorOptions = {
  name?: string;
  oversizedInputs?: boolean;
  inline?: boolean;
  unsafe?: boolean;
  noComments?: boolean;
  constantsFile?: boolean;
  output?: string;
  libraryPath?: string;
  testContractsDirectory?: string;
  hardhatTestsDirectory?: string;
  disableMemorySafe?: boolean;
  projectType?: ProjectType;
};

const DefaultFileHeader = [
  "// SPDX-License-Identifier: MIT",
  `pragma solidity >=0.8.0;`,
];

export const generateFileHeader = (
  withNotice?: boolean,
  unsafeWarning?: boolean,
  imports?: string[]
) => [
  ...DefaultFileHeader,
  "",
  ...(imports ? [...imports, ""] : []),
  "",
  ...(withNotice ? [...generateNotice(unsafeWarning), ""] : []),
];

const cleanSectionId = (segment: string) =>
  segment === "constructor" ? "_constructor" : segment;

// type CodeSegment

const isEmpty = <T>(arr: T | T[]) => coerceArray(arr).length === 0;

const isCodeGenFunction = (
  arr: ArrayJoinInput | CodeGenFunction | CodeGenFunction[]
): arr is CodeGenFunction | CodeGenFunction[] => {
  if (!arr) return false;
  if (typeof arr === "string") return false;
  arr = arr as ArrayJoinInput[] | CodeGenFunction | CodeGenFunction[];
  if (Array.isArray(arr)) {
    return isCodeGenFunction(
      (arr as Array<ArrayJoinInput | CodeGenFunction>).filter(Boolean)[0]
    );
  }
  return true;
};

export class FileContext {
  constants: string[] = [];
  code: ArrayJoinInput<string>[] = [];
  functions: CodeGenFunction[] = [];
  sections: Record<string, ArrayJoinInput<string>[]> = {};

  // eslint-disable-next-line no-useless-constructor
  constructor(public opts: GeneratorOptions = {}) {
    this.addSection("constants", "Constants");
    this.opts.libraryPath = this.opts.libraryPath || this.opts.output;
  }

  getImportPathFromTest(to: string) {
    if (!this.opts.testContractsDirectory || !this.opts.output)
      return undefined;
    return path.relative(
      path.join(this.opts.testContractsDirectory),
      path.join(this.opts.output, to)
    );
  }

  getLibraryPath(fileName: string) {
    if (!this.opts.libraryPath) {
      return undefined;
    }
    return path.join(this.opts.libraryPath, fileName)
  }

  get checkOverflows() {
    return this.opts.oversizedInputs && !this.opts.unsafe;
  }

  get sectionIds() {
    return Object.keys(this.sections);
  }

  removeSection(id: string) {
    id = cleanSectionId(id);
    delete this.sections[id];
  }

  getSection(id: string, toString: true): string;
  // eslint-disable-next-line no-dupe-class-members
  getSection(id: string, toString: false): ArrayJoinInput[];
  // eslint-disable-next-line no-dupe-class-members
  getSection(id: string, toString?: boolean) {
    id = cleanSectionId(id);
    const code = this.sections[id];
    if (!code) return undefined;
    return toString ? arrJoiner(code) : code;
  }

  combineSections(segments: string[], separator: string = "") {
    const out: ArrayJoinInput<string>[] = [];
    for (let id of segments) {
      id = cleanSectionId(id);
      const segment = this.sections[id];
      if (segment) {
        out.push(...segment, separator);
      }
    }
    return out;
  }

  addSection(segment: string, title?: string): ArrayJoinInput<string>[] {
    segment = cleanSectionId(segment);
    if (!this.sections[segment]) {
      this.sections[segment] = [
        ...(title ? [...toCommentSeparator(title), ""] : []),
      ];
    }
    return this.sections[segment];
  }

  sectionPush(
    id: string,
    code: ArrayJoinInput | CodeGenFunction | CodeGenFunction[],
    title?: string
  ) {
    id = cleanSectionId(id);
    if (isEmpty<ArrayJoinInput | CodeGenFunction>(code)) return;
    const segment = this.addSection(id, title);
    if (isCodeGenFunction(code)) {
      const fns = coerceArray(code);
      for (const fn of fns) {
        this.functions.push(fn);
        segment.push("", ...generateFunctionCode(fn));
      }
    } else {
      segment.push(...coerceArray(code));
    }
  }

  clearCode() {
    this.code = [];
    if (!this.opts.constantsFile) {
      this.constants = [];
    }
    this.functions = [];
    this.sections = {};
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
      this.sectionPush("constants", _declaration);
    }
    return name;
  }
}
