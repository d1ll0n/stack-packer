import { FileContext } from "../code-gen/context";
import { AbiFunction, StateVariable, Visibility } from "../types";

import { SourceCodeUpdates } from "./replacer";

export type SelectorType = {
  type: "magic" | "index";
  startIndex: number;
  bits: number;
  modulus?: number;
};

export type LookupTableMember = {
  position: number;
  value: string;
  name?: string;
};

export type SelectorOptions = {
  type: "magic" | "index";
  noSlicing?: boolean; // Disable taking a sub-set of a selector
  maxModulus?: number; // Maximum modulus
};

export type LibraryGeneratorHelpers = {
  context: FileContext;
  isLookup: boolean;
  positionRef: string;
  type: "Lookup" | "Jump";
  size: number;
  bits: number;
  elementsPerWord: number;
  typeName: string;
  memberType: string;
  valueName: string;
  numberString: string;
  byteString: string;
  bitsRef: string;
  maskIncludeFirst: string;
  maskIncludeLast: string;
  maskExcludeFirst: string;
  minShiftRef: string;
  segmentsFor256Elements: number;
  bitsFromRightExpression: (key: string) => string;
  byteOffsetExpression: (key: string) => string;
};

export type LookupTableSegmentMember = LookupTableMember & {
  positionInWord: number;
  expression: string;
  // selector?: string;
};

export type LookupTableSegment = {
  name: string;
  definition: string;
  members: LookupTableSegmentMember[];
};

export type ExternalJumpTableFunction = AbiFunction & {
  selector?: string;
  externalName: string;
  wrapper?: string;
};

export type ExternalJumpTableHelpers = {
  context: FileContext;
  selectorType: SelectorType;
  withLibrary?: boolean;

  externalFunctions: ExternalJumpTableFunction[];
  selectors: string[];
  members: LookupTableMember[];

  memberBytes: number;
  bitsPerMember: number;

  numSegments: number;
  segments: LookupTableSegment[];

  // membersPerWord: number;
  // bitsPerMember

  existingLoaders: Record<string, boolean>;

  sourceCode?: string;
  originalSourceCode?: string;

  updateContractOrFunction: (
    fnName: string,
    updates: SourceCodeUpdates
  ) => boolean;
  replaceStateVariables: (stateVariable: StateVariable) => boolean;
  replaceFunction: (
    fn: AbiFunction,
    newName: string,
    visibility: Visibility
  ) => boolean;
};
