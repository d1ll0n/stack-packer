import path from "path";
import { generateFunctionCode } from "../code-gen/codegen-helpers";

import { getFallbackForJumpTable } from "./templates/external-jump-table";
import { getMagicModulusFunction } from "./templates/modulus";
import { getMappingAccessExpression } from "../code-gen/call-builders";
import { getParamDefinition } from "../type-utils";
import { getSelector } from "../type-utils/functions";
import { prettierFormat } from "../code-gen/prettier";
import { toHex } from "../lib/bytes";
import { writeFileSync } from "fs";

import {
  AbiFunction,
  ArrayJoinInput,
  CodeGenFunction,
  StateVariable,
  Visibility,
} from "../types";
import { addSeparators, arrJoiner, wrap } from "../lib/text";
import { ExternalJumpTableFunction, ExternalJumpTableHelpers } from "./types";
import { FileContext, GeneratorOptions } from "../code-gen/context";
import { toCommentTable, toNatspec } from "../code-gen/comments";

import {
  addToHeader,
  makeInternal,
  replaceFunction,
  replaceStateVariables,
  SourceCodeUpdates,
  updateContractOrFunction,
} from "./replacer";
import {
  getCallInputGetterFunction,
  getCallOutputGetterFunction,
  getInputGetterFunction,
  getInputGetterFunctionName,
  getOutputGetterFunction,
  getOutputGetterFunctionName,
} from "./function-io";
import {
  getLookupTableSegments,
  getSelectorLookupTableMembers,
  getSelectorPositions,
  getSelectorSlices,
  getSelectorType,
} from "./selectors";

export function describeJumpTable({
  selectors,
  selectorType,
  externalFunctions,
}: ExternalJumpTableHelpers) {
  const { startIndex, bits } = selectorType;
  const startBit = startIndex * 8;
  const endBit = startBit + bits;
  const positions = getSelectorPositions(selectors, selectorType);

  const selectorSlices = getSelectorSlices(selectors, selectorType);

  const entries = externalFunctions.map(
    ({ selector, externalName: name }, i) => {
      if (selectorType.type === "index") {
        return { row: [name, i.toString()], position: i };
      }
      const position = positions[selector];
      const positionString = `${toHex(selectorSlices[i])} % ${
        selectorType.modulus
      } = ${position}`;
      const row = [name, positionString];
      return { row, position };
    }
  );
  entries.sort((a, b) => a.position - b.position);
  const fnRows = entries.map(({ row }) => row);

  const header = ["Function Name", "Position"];
  if (selectorType.type === "magic") {
    const selectorStr =
      startBit === 0 && bits === 32
        ? "selector"
        : `selector bits ${startBit}-${endBit}`;
    header[1] = `Position (${selectorStr} % ${selectorType.modulus})`;
  }
  return toCommentTable([header, ...fnRows]);
}

function getExternalJumpTableHelpers(
  fns: AbiFunction[],
  type: "magic" | "index",
  sourceCode?: string,
  withLibrary?: boolean,
  options: GeneratorOptions = {}
): ExternalJumpTableHelpers {
  const externalFunctions: ExternalJumpTableFunction[] = fns
    .filter(
      (fn) =>
        ["external", "public"].includes(fn.visibility) &&
        !["fallback", "receive"].includes(fn.name)
    )
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
      let fn: AbiFunction | undefined;
      if (fnName !== "contract") {
        fn = fns.find((fn) => fn.name === fnName);
        if (!fn) return undefined;
      }

      const updated = updateContractOrFunction(
        fnName,
        helpers.sourceCode,
        updates,
        fn
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

export function generateJumpTableForFunctions(
  fns: AbiFunction[],
  type: "magic" | "index",
  sourceCode?: string,
  withLibrary?: boolean,
  options: GeneratorOptions = {}
) {
  const helpers = getExternalJumpTableHelpers(
    fns,
    type,
    sourceCode,
    withLibrary,
    options
  );
  const {
    context,
    selectorType,
    externalFunctions,
    existingLoaders,
    segments,
  } = helpers;

  context.sectionPush("header", [
    `// SPDX-License-Identifier: MIT`,
    `pragma solidity >=0.8.13;`,
    ...(withLibrary ? ["", `import "./JumpTable.sol";`] : []),
  ]);
  console.log(context.getSection("header", true));

  context.addSection("utils", "Function Helper");
  context.sectionPush("utils", getMagicModulusFunction(context, selectorType));

  context.addSection("immutables", "Constants");
  context.addSection("constructor", "Constructor");

  context.sectionPush(
    "immutables",
    segments.map((s) => s.definition)
  );

  // @todo is there ever a scenario where they are given as params?
  const giveMembersAsParams = false; // withLibrary && selectorType.type === "index";
  const segmentAssignments: ArrayJoinInput[] = segments.map((segment) =>
    wrap(
      addSeparators(
        segment.members.map((m) => m.expression),
        giveMembersAsParams ? "," : "|"
      ),
      `${segment.name} = ${withLibrary ? `toJumpTable` : ""}(`,
      ");",
      true,
      true,
      true
    )
  );

  const constructorFn: CodeGenFunction = {
    name: "constructor",
    inputs: [],
    outputs: [],
    visibility: "default",
    body: segmentAssignments,
    natspecLines: describeJumpTable(helpers),
  };

  context.sectionPush("constructor", constructorFn);

  const fallback = getFallbackForJumpTable(
    selectorType,
    segments.length > 1
      ? `[${segments.map((s) => s.name).join(", ")}]`
      : `table`
  );

  context.addSection("fallback", "Function Switch");
  context.sectionPush("fallback", fallback);

  context.addSection("calldata", "Calldata Helper Functions");
  context.addSection("returndata", "Return Data Helper Functions");
  context.addSection("external", "External Function Logic");

  let anyNonPayable = false;

  for (let i = 0; i < externalFunctions.length; i++) {
    const fn = externalFunctions[i];
    const body: ArrayJoinInput<string>[] = [];
    const modifier = fn.stateMutability !== "payable" && "nonpayable";
    if (modifier) anyNonPayable = true;
    const stateVar = fn.stateVariable;

    let stateVarAccess = "";
    if (stateVar) {
      helpers.replaceStateVariables(stateVar);
      stateVarAccess =
        stateVar.type.meta === "mapping"
          ? getMappingAccessExpression({
              name: stateVar.name,
              type: stateVar.type,
            })
          : stateVar.name;
    }

    if (fn.stateMutability === "payable") {
      fn.stateMutability = null;
    }

    if (fn.input.fields.length) {
      const inputGetterName = getInputGetterFunctionName(fn);
      if (!existingLoaders[inputGetterName]) {
        context.sectionPush("calldata", getInputGetterFunction(fn));
        existingLoaders[inputGetterName] = true;
      }
      body.push(getCallInputGetterFunction(fn));
    }

    if (fn.output.fields.length) {
      const outputName = getOutputGetterFunctionName(fn);
      if (!existingLoaders[outputName]) {
        context.sectionPush("returndata", getOutputGetterFunction(fn));
        existingLoaders[outputName] = true;
      }
      if (stateVarAccess) {
        body.push(`${outputName}(${stateVarAccess});`);
      } else {
        body.push(`// ${getCallOutputGetterFunction(fn)}`);
      }
    }

    const externalFn: CodeGenFunction = {
      name: fn.name,
      visibility: "internal",
      stateMutability: fn.stateMutability,
      modifiers: [modifier].filter(Boolean),
      virtual: true,
      inputs: [],
      body,
      outputs: [],
    };

    context.sectionPush("external", externalFn);

    if (sourceCode) {
      console.log(`Processing ${fn.name} | ${fn.wrapper}`);
      if (fn.wrapper) {
        const wrapBody: ArrayJoinInput[] = [];
        wrapBody.push(getCallInputGetterFunction(fn));
        const inputAsArgs = fn.input.fields.map((f) => f.name).join(",");
        const callInternal = `${fn.name}(${inputAsArgs});`;
        if (!fn.output.fields.length) {
          wrapBody.push(callInternal);
        } else {
          const outputDefs = fn.output.fields
            .map((f) => getParamDefinition(f, "memory"))
            .join(",");
          // const outputArgs = fn.output.fields.map((f) => f.name).join(",");
          wrapBody.push(`(${outputDefs}) = ${callInternal}`);
          wrapBody.push(getCallOutputGetterFunction(fn));
        }
        const _fn: CodeGenFunction = {
          name: fn.wrapper,
          visibility: "internal",
          stateMutability: fn.stateMutability,
          modifiers: [modifier].filter(Boolean),
          virtual: true,
          inputs: [],
          body: wrapBody,
          outputs: [],
        };
        // Make external fn internal
        helpers.sourceCode =
          makeInternal(fn, helpers.sourceCode) || helpers.sourceCode;
        // Add wrapper function jump table can use
        helpers.updateContractOrFunction(`contract`, {
          bodySuffix: arrJoiner(generateFunctionCode(_fn)),
        });
      } else {
        const result = helpers.replaceFunction(fn, fn.name, "internal");
        if (!result) {
          console.log(`Replacement stopped working at ${fn.name}`);
          helpers.updateContractOrFunction("contract", {
            bodySuffix: arrJoiner(generateFunctionCode(externalFn)),
          });
        }
      }
    }
  }

  // if (withLibrary) {}

  const contractBody = [
    `contract JumpTable {`,
    ...(anyNonPayable
      ? [
          `modifier nonpayable {`,
          [`assembly {`, [`if callvalue() { revert(0, 0) }`], `}`, `_;`],
          `}`,
        ]
      : []),
    context.combineSections([
      "immutables",
      "constructor",
      "fallback",
      "external",
    ]),
    "}",
  ];
  console.log(`Final source edits...`);
  if (sourceCode) {
    console.log("fallback");
    const fallbackComments = fallback.natspecLines.length
      ? arrJoiner(toNatspec(fallback.natspecLines))
      : "";
    const fallbackCode = arrJoiner(fallback.body);
    const fallbackUpdated = helpers.updateContractOrFunction("fallback", {
      definitionPrefix: fallbackComments,
      bodyPrefix: fallbackCode,
    });
    console.log("receive");
    const receiveUpdated = helpers.updateContractOrFunction("receive", {
      definitionPrefix: fallbackComments,
      bodyPrefix: fallbackCode,
    });
    console.log("def");
    const definitionSuffix =
      fallbackUpdated || receiveUpdated
        ? ""
        : arrJoiner(["", ...generateFunctionCode(fallback)]);
    console.log("constructor");
    helpers.updateContractOrFunction("constructor", {
      definitionPrefix: arrJoiner(toNatspec(constructorFn.natspecLines)),
      bodySuffix: arrJoiner(constructorFn.body),
      definitionSuffix,
    });
    const imports = [`import "./JumpTable.sol";`];

    const name = helpers.context.opts.name;

    if (name) {
      helpers.updateContractOrFunction("contract", {
        rename: `contract ${name}JumpTable`,
      });
      const filePath = context.getLibraryPath(`${name}InputOutput.sol`);
      writeFileSync(
        filePath,
        prettierFormat(
          arrJoiner(
            context.combineSections([
              "header",
              "constants",
              "utils",
              "calldata",
              "returndata",
            ])
          )
        )
      );
      imports.push(
        `import "./${path.relative(context.opts.output, filePath)}";`
      );
    }
    helpers.updateContractOrFunction("contract", {
      bodyPrefix: arrJoiner([
        ...(withLibrary ? ["using MultiPartJumpTable for *;"] : []),
        ...context.getSection("immutables", false),
        ...(anyNonPayable
          ? [
              "",
              "",
              `modifier nonpayable {`,
              [`assembly {`, [`if callvalue() { revert(0, 0) }`], `}`, `_;`],
              `}`,
            ]
          : []),
      ]),
    });

    helpers.sourceCode =
      addToHeader(helpers.sourceCode, imports.join("\n")) || helpers.sourceCode;
  }
  console.log(`Finished source edits...`);

  const fileHeader = context.combineSections([
    "header",
    "constants",
    "utils",
    "calldata",
    "returndata",
  ]);

  return {
    contractBody,
    fileHeader,
    sourceCode: helpers.sourceCode,
    // templateFile
  };
}

// using MultiPartJumpTable for *;
