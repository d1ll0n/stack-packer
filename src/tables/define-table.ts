import { getSelector } from "../type-utils/functions";
import { FileContext, GeneratorOptions } from "../code-gen/context";

import { AbiFunction, StateVariable, Visibility } from "../types";

import { ExternalJumpTableFunction, ExternalJumpTableHelpers } from "./types";
import {
  getLookupTableSegments,
  getSelectorLookupTableMembers,
  getSelectorType,
} from "./selectors";
import {
  replaceFunction,
  replaceStateVariables,
  SourceCodeUpdates,
  updateContractOrFunction,
} from "./replacer";

type TableMember = {
  joinWith: 
}

function getExternalJumpTableHelpers(
  fns: AbiFunction[],
  type: "magic" | "index",
  sourceCode?: string,
  withLibrary?: boolean,
  options: GeneratorOptions = {}
): ExternalJumpTableHelpers {
  const externalFunctions: ExternalJumpTableFunction[] = fns
    .filter((fn) => ["external", "public"].includes(fn.visibility))
    .map((fn) => {
      const externalName = fn.stateVariable?.name || fn.name;
      const wrapper =
        sourceCode &&
        fn.visibility === "public" &&
        !fn.stateVariable &&
        `fn_${fn.name}`;
      const selector = getSelector({ ...fn, name: externalName });
      // console.log(`${fn.name} | ${selector}`)
      return {
        ...fn,
        externalName,
        selector,
        wrapper,
      };
    });

  const selectors = externalFunctions.map((fn) => fn.selector);
  const selectorType = getSelectorType(selectors, { type });
  const members = getSelectorLookupTableMembers(
    externalFunctions.map((fn) => ({ ...fn, name: fn.wrapper || fn.name })),
    selectors,
    selectorType,
    "none"
  );
  const context = new FileContext(options);
  const existingLoaders: Record<string, boolean> = {};

  const getPositionMemberExpression = (
    positionInWord: number,
    value: string,
    numSegments: number
  ) => {
    if (withLibrary) return `positionJD(${positionInWord}, ${value})`;
    const offsetBits = positionInWord * 16;
    const shiftBits =
      numSegments === 1 ? offsetBits : 256 - (offsetBits + selectorType.bits);
    return shiftBits ? `(${value} << ${shiftBits})` : value;
  };
  const segments = getLookupTableSegments(
    { members, withLibrary },
    getPositionMemberExpression
  );

  const helpers = {
    context,
    selectorType,
    withLibrary,
    externalFunctions,
    selectors,
    members,
    memberBytes: 2,
    numSegments: segments.length,
    segments,
    existingLoaders,
    sourceCode,
    bitsPerMember: 16,
    updateContractOrFunction: (fnName: string, updates: SourceCodeUpdates) => {
      const updated = updateContractOrFunction(
        fnName,
        helpers.sourceCode,
        updates
      );
      if (updated) helpers.sourceCode = updated;
      return !!updated;
    },
    replaceStateVariables: (stateVariable: StateVariable) => {
      const updated = replaceStateVariables(helpers.sourceCode, stateVariable);
      if (updated) helpers.sourceCode = updated;
      return !!updated;
    },
    replaceFunction: (
      fn: AbiFunction,
      newName: string,
      visibility: Visibility
    ) => {
      // const originalFunctionCode
      const updated = replaceFunction(
        helpers.sourceCode,
        fn,
        newName,
        visibility
      );
      if (updated) helpers.sourceCode = updated;
      return !!updated;
    },
  };

  return helpers;
}
