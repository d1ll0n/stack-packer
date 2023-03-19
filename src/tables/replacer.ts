import { AbiFunction, StateVariable } from "../types";
import { arrJoiner } from "../lib/text";
import { getParamDefinition, toTypeName } from "../type-utils";

import {
  ContractDefinition,
  FunctionDefinition,
  parse,
  SourceUnit,
} from "@d1ll0n/solidity-parser";
import {
  getCallInputGetterFunction,
  getOutputGetterFunctionName,
} from "./function-io";
import { parseFile } from "../parser/parser";

const RequiredWhiteSpace = "\\s+";
const OptionalWhiteSpace = "\\s*";
const LParam = "\\(";
const RParam = "\\)";

const negativeLookBehind = (arr: string | string[]) => {
  if (!Array.isArray(arr)) arr = [arr];
  return ["(?<!", ...arr, ")"].join("");
};
const nonCaptureGroup = (arr: string | string[]) => {
  if (!Array.isArray(arr)) arr = [arr];
  return ["(?:", ...arr, ")"].join("");
};
const NegativeCommentPrefix = negativeLookBehind(`[/]{2}\\s*`);

const FunctionStartCaptureGroup = ["(", "function", RequiredWhiteSpace, ")"];

const FunctionParamStartCaptureGroup = [
  "(",
  OptionalWhiteSpace,
  LParam,
  OptionalWhiteSpace,
  ")",
];

const BalancedParenthesesInner =
  "(?:[^)()]+|\\((?:[^)()]+|\\([^)()]*\\))*\\))*?";
// const BalancedParentheses = ["\\(", BalancedParenthesesInner, "\\)"].join("");
const BalancedBracketsInner = "(?:[^}{]+|\\{(?:[^}{]+|\\{[^}{]*\\})*\\})*?";
// const BalancedBrackets = ["\\{", BalancedBracketsInner, "\\}"].join("");

const Identifier = "[\\w|\\d]+";
const OptionalIdentifier = nonCaptureGroup(Identifier) + "?";
const OptionalArguments = "[\\w|\\d|\\s|,|_-]*"; // "[\\w|\\d|\\s|,|_-]*";
// const OptionalArgumentsWithParentheses = "[\\w|\\d|\\s|,|_-|(|)]*";
const CallWithOrWithoutParameters = nonCaptureGroup([
  Identifier,
  OptionalWhiteSpace,
  LParam,
  OptionalArguments,
  RParam,
]);

const Pragma = [
  "(",
  "pragma",
  RequiredWhiteSpace,
  "solidity",
  OptionalWhiteSpace,
  "[\\^<>=+.\\d]+",
  OptionalWhiteSpace,
  ";",
  ")",
];

const ModifiersAndBlockStartCaptureGroup = [
  "(",
  OptionalWhiteSpace,
  nonCaptureGroup([
    nonCaptureGroup([OptionalWhiteSpace, Identifier]),
    OptionalWhiteSpace,
    nonCaptureGroup([CallWithOrWithoutParameters]),
    "?",
    OptionalWhiteSpace,
    "?",
  ]),
  "*",
  "\\{",
  ")",
];

const getReturnStatementRegex = (wrapped: boolean) =>
  new RegExp(
    [
      NegativeCommentPrefix,
      "(?:return)",
      OptionalWhiteSpace,
      // wrapped
      //   ? OptionalWhiteSpace + nonCaptureGroup(LParam)
      //   : RequiredWhiteSpace,
      "(",
      // OptionalArgumentsWithParentheses,
      BalancedParenthesesInner,
      ")",
      // wrapped && nonCaptureGroup(RParam),
      OptionalWhiteSpace,
      ";",
      // ")",
      // "*",
      // , OptionalArguments, RParam
    ]
      .filter(Boolean)
      .join(""),
    "g"
  );

const FunctionParamEndCaptureGroup = [
  "(",
  OptionalWhiteSpace,
  RParam,
  OptionalWhiteSpace,
  ")",
];

const BlockEndCaptureGroup = ["(", "\\}", ")"];

const FunctionBlockCaptureGroup = "((?:.|\\s)*)";

// const builtInFns = ["fallback", "receive", "constructor", "contract"];

export const getFnLikeRegex = (name: string, captureId?: boolean) =>
  [
    ...(captureId
      ? [nonCaptureGroup([name, OptionalWhiteSpace]), `(${Identifier})`]
      : [`(${name})`]),
    // `(${name})`, // $1
    ["(", "[^)]*", ")"].join(OptionalWhiteSpace), // $2
    // capture opening bracket and modifiers
    ...ModifiersAndBlockStartCaptureGroup, // $3
    // block
    "(" + BalancedBracketsInner + ")", // $4
    // capture closing bracket
    ...BlockEndCaptureGroup, // $5
  ].join("");

// const re = getFnLikeRegex("function", true);

export type SourceCodeUpdates = {
  definitionPrefix?: string;
  definitionSuffix?: string;
  bodyPrefix?: string;
  bodySuffix?: string;
  rename?: string;
};
export function addToHeader(sourceCode: string, suffix: string) {
  const re = new RegExp(Pragma.join(""), "g");
  const result = !!re.exec(sourceCode);
  if (!result) {
    return undefined;
  }
  return sourceCode.replace(re, `$1\n${suffix}`);
}

// console.log(new RegExp(Pragma.join(""), "g"));

function updateContract(
  sourceCode: string,
  {
    definitionPrefix,
    definitionSuffix,
    bodyPrefix,
    bodySuffix,
    rename,
  }: SourceCodeUpdates
) {
  const { children } = <SourceUnit>(
    parse(sourceCode, { tolerant: true, loc: true, range: true })
  );
  const contractDefinition = children.find(
    (n) => n.type === "ContractDefinition"
  ) as ContractDefinition;
  if (!contractDefinition) return undefined;
  const contractCode = sourceCode.slice(
    contractDefinition.range[0],
    contractDefinition.range[1] + 1
  );
  const startBody = contractCode.indexOf("{") + 1;
  let def = contractCode.slice(0, startBody);
  if (rename) {
    def = def.replace(
      new RegExp(`contract\\s*${contractDefinition.name}`, "g"),
      rename
    );
  }
  const body = contractCode.slice(startBody, contractCode.length - 1);
  const endBody = contractCode.slice(-1);
  const newContract = [
    definitionPrefix,
    def,
    bodyPrefix,
    body,
    bodySuffix,
    endBody,
    definitionSuffix,
  ]
    .filter(Boolean)
    .join("\n");
  return sourceCode.replace(contractCode, newContract);
}

export function updateContractOrFunction(
  name: string,
  sourceCode: string,
  {
    definitionPrefix,
    definitionSuffix,
    bodyPrefix,
    bodySuffix,
    rename,
  }: SourceCodeUpdates,
  fn?: AbiFunction
) {
  definitionPrefix = definitionPrefix ? `\n${definitionPrefix}\n` : "";
  definitionSuffix = definitionSuffix ? `\n${definitionSuffix}\n` : "";
  bodyPrefix = bodyPrefix ? `\n${bodyPrefix}\n` : "";
  bodySuffix = bodySuffix ? `\n${bodySuffix}\n` : "";
  if (name === "contract")
    return updateContract(sourceCode, {
      definitionPrefix,
      definitionSuffix,
      bodyPrefix,
      bodySuffix,
      rename,
    });
  // const re = new RegExp(getFnLikeRegex(name, Boolean(rename)), "g");

  // const result = !!re.exec(sourceCode);
  // if (!result) {
  // return undefined;
  // }

  const fnCodeFound = getFunctionCode(sourceCode, fn);
  if (!fnCodeFound) return undefined;
  const { fnBlockStart, fnBlock, fnCode } = fnCodeFound;
  const newCode = arrJoiner(
    [
      definitionPrefix,
      fnBlockStart,
      "{",
      [bodyPrefix, fnBlock, bodySuffix],
      "}",
      definitionSuffix,
    ].filter(Boolean)
  );

  return sourceCode.replace(fnCode, newCode);
}

// export function getName()

// const code = `  function fn_decimals() internal view virtual nonpayable {
//   return_uint8(decimals);
// }`;

// console.log(updateContractOrFunction("function", code, { rename: "function wono" }));

export function addToConstructor(
  sourceCode: string,
  definitionPrefix: string,
  bodySuffix: string
) {
  const re = new RegExp(getFnLikeRegex("constructor"), "g");
  const constructorFound = !!re.exec(sourceCode);
  if (!constructorFound) {
    return undefined;
  }

  return sourceCode.replace(
    re,
    `${definitionPrefix}\n$1$2$3$4\n${bodySuffix}\n$5`
  );
}
/* 
    getParamDefinition(field, "(?:memory|calldata)")
      .replace(/ /g, RequiredWhiteSpace)
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]") */

export const fnVisibilityRegex = (fn: AbiFunction) =>
  new RegExp(
    [
      "(",
      // capture prefix
      "function",
      RequiredWhiteSpace,
      // name
      fn.name,
      // capture params prefix
      OptionalWhiteSpace,
      LParam,
      OptionalWhiteSpace,
      fn.input.fields
        .map((field) =>
          getParamDefinition(field, "(?:memory|calldata)")
            .replace(/ /g, RequiredWhiteSpace)
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
        )
        .join(OptionalWhiteSpace + "," + OptionalWhiteSpace),
      // capture params suffix
      OptionalWhiteSpace,
      RParam,
      OptionalWhiteSpace,
      ")",
      `(${fn.visibility})`,
    ].join(""),
    "g"
  );

export const makeInternal = (fn: AbiFunction, sourceCode: string) => {
  const re = fnVisibilityRegex(fn);
  if (!re.exec(sourceCode)) return undefined;
  return sourceCode.replace(re, "$1internal");
};

export const toFnRegex = (fn: AbiFunction) =>
  new RegExp(
    [
      // capture prefix
      ...FunctionStartCaptureGroup,
      // name
      fn.name,
      // capture params prefix
      ...FunctionParamStartCaptureGroup,
      fn.input.fields
        .map((field) =>
          getParamDefinition(field, "(?:memory|calldata)")
            .replace(/ /g, RequiredWhiteSpace)
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
        )
        .join(OptionalWhiteSpace + "," + OptionalWhiteSpace),
      // capture params suffix
      ...FunctionParamEndCaptureGroup,
      "(?:external|public)",
      // capture opening bracket and modifiers
      ...ModifiersAndBlockStartCaptureGroup,
      // block
      // "(",
      FunctionBlockCaptureGroup,
      // BalancedBracketsInner,
      // ")",
      // capture closing bracket
      ...BlockEndCaptureGroup,
    ].join(""),
    "g"
  );

function removeParameters(
  fn: AbiFunction,
  fnBlockStart: string,
  returns?: boolean
) {
  // In the parser, return parameters without names are given default names
  // this function determines whether there were named outputs originally,
  // so that the modified code can define variables in the function body
  // if necessary.
  const re = new RegExp(
    [
      ...(returns ? ["returns"] : []),
      OptionalWhiteSpace,
      // capture params prefix
      ...FunctionParamStartCaptureGroup,
      // "(",
      fn.output.fields
        .map((field) =>
          [
            getParamDefinition(field, "(?:memory|calldata)", true)
              .replace(/ /g, RequiredWhiteSpace)
              .replace(/\[/g, "\\[")
              .replace(/\]/g, "\\]"),
            `(?<${field.name}>`,
            OptionalWhiteSpace,
            OptionalIdentifier,
            ")?",
          ].join("")
        )
        .join(OptionalWhiteSpace + "," + OptionalWhiteSpace),
      ...FunctionParamEndCaptureGroup,
    ].join(""),
    "g"
  );

  const result = re.exec(fnBlockStart);
  const namedOutputs: AbiFunction["output"]["fields"] = [];
  for (const field of fn.output.fields) {
    const isNamed = result?.groups?.[field.name];
    if (isNamed) {
      namedOutputs.push(field);
    }
  }
  return {
    updated: fnBlockStart.replace(re, returns ? "" : "() "),
    namedOutputs,
  };
}

const paramsString = (fn: FunctionDefinition) =>
  [
    fn.name,
    "(",
    fn.parameters
      .map((i: any) => i.typeName.namePath || i.typeName.name)
      .join(","),
    ")",
  ].join("");

function getFunctionCode(_code: string, fn: AbiFunction) {
  const { nodes } = parseFile(_code);
  if (!fn._ast) return undefined;
  const ast = nodes.find(
    (n) =>
      n.type === "FunctionDefinition" &&
      paramsString(fn._ast) === paramsString(n._ast)
  )._ast as FunctionDefinition;
  if (!ast) return undefined;
  const [fnStartIndex, fnEndIndex] = ast.range;
  const [bodyStartIndex, bodyEndIndex] = ast.body.range;
  const fnBlockStart = _code.slice(fnStartIndex, bodyStartIndex);
  const fnBlock = _code.slice(bodyStartIndex + 1, bodyEndIndex);
  const fnCode = _code.slice(fnStartIndex, fnEndIndex + 1);
  return {
    fnBlockStart,
    fnBlock,
    fnCode,
  };
}

export const replaceFunction = (
  _code: string,
  fn: AbiFunction,
  newName: string,
  visibility: AbiFunction["visibility"]
) => {
  console.log(`Replacing ${fn.name}`);
  const fnCodeFound = getFunctionCode(_code, fn);
  if (!fnCodeFound) return undefined;
  let { fnBlockStart, fnBlock, fnCode } = fnCodeFound;
  // const fnAST = nodes.find(n => n.type === "FunctionDefinition" && n.name === fn.name && n.input.map(i => i.typeName.name ))
  /*   const formatted = prettierFormat(code);
  const fnLine = new RegExp(
    [
      `function\\s*${fn.name}\\s*`,
      fn.input.fields.map((field) =>
        getParamDefinition(field, "(?:memory|calldata)")
          .replace(/ /g, RequiredWhiteSpace)
          .replace(/\[/g, "\\[")
          .replace(/\]/g, "\\]")
      ),
    ].join("")
  ); */
  // console.log(
  //   fn.input.fields.map((field) =>
  //     getParamDefinition(field, "(?:memory|calldata)")
  //   )
  // );
  // const re = toFnRegex(fn);
  // console.log(re);
  // fullText
  // fnStart
  // fnParamStart
  // fnParamEnd
  // fnBlockStart
  // fnBlock
  // fnBlockEnd
  // const result = re.exec(fnCode);
  // if (!result) return undefined;
  // let [, , , , fnBlockStart, fnBlock] = result;
  const fnBlockLines = fnBlock.split("\n");

  let lastLineWithReturn = 0;
  let lastLineWithCode = 0;
  console.log("a");
  const outputFn =
    fn.output.fields.length > 0 ? getOutputGetterFunctionName(fn) : "";
  for (let i = 0; i < fnBlockLines.length; i++) {
    const ln = fnBlockLines[i];

    const codeRE = new RegExp([NegativeCommentPrefix, "[^\\s]+"].join(""), "g");
    if (codeRE.exec(ln)) {
      lastLineWithCode = i;
    }

    let returnRE = getReturnStatementRegex(true);

    // const re = new RegExp(ReturnStatement.join(""));
    let returnParameters = returnRE.exec(ln);
    if (!returnParameters) {
      returnRE = getReturnStatementRegex(false);
      returnParameters = returnRE.exec(ln);
    }
    if (returnParameters) {
      lastLineWithReturn = i;
      const commentIndex = ln.indexOf("//");
      if (commentIndex < 0 || ln.indexOf(returnParameters[0]) < commentIndex) {
        fnBlockLines[i] = ln.replace(
          returnParameters[0],
          `${outputFn}(${returnParameters[1]});`
        );
      }
    }
  }
  console.log("a1");
  ({ updated: fnBlockStart } = removeParameters(
    { ...fn, output: fn.input },
    fnBlockStart
  ));
  if (fnBlockStart.includes("returns")) {
    const { namedOutputs, updated } = removeParameters(fn, fnBlockStart, true);
    fnBlockStart = updated;
    for (const namedOutput of namedOutputs) {
      fnBlockLines.unshift(getParamDefinition(namedOutput, "memory") + ";");
    }
    if (
      outputFn &&
      lastLineWithCode > lastLineWithReturn &&
      namedOutputs.length === fn.output.fields.length
    ) {
      fnBlockLines.push(
        `${outputFn}(${namedOutputs.map((f) => f.name).join(", ")});`
      );
    }
  }
  console.log("a2");
  const longestOffset =
    [...fnBlock.matchAll(/\s+/g)]
      .map((arr) => arr[0])
      .sort((a, b) => b.length - a.length)?.[0] ?? "";

  const getParams = longestOffset.concat(
    arrJoiner(getCallInputGetterFunction(fn))
  );
  fnBlockLines.unshift(getParams);
  const newFnBlock = arrJoiner(["{", fnBlockLines, "}"]);

  fnBlockStart = fnBlockStart
    .replace(new RegExp(`function\\s+${fn.name}`, "g"), `function ${newName}`)
    .replace(new RegExp(`\\s+${fn.visibility}\\s+`, "g"), ` ${visibility} `)
    .replace(/(?<=[^\w\d])payable(?=[^\w\d]|$)/g, " ");
  const newFnCode = fnBlockStart.concat(newFnBlock);

  // fnCode.replace(
  // re,
  // `$1${newName}$2$3${visibility}${fnBlockStart}${newFnBlock} $6`
  // );
  console.log(`Done replacing ${fn.name}`);
  return _code.replace(fnCode, newFnCode);
};

export function replaceStateVariables(code: string, stateVar: StateVariable) {
  const typeName = toTypeName(stateVar.type);
  const regexTypeName = typeName
    .replace(/ /g, OptionalWhiteSpace)
    .replace(/\(/g, OptionalWhiteSpace + "\\(" + OptionalWhiteSpace)
    .replace(/\)/g, OptionalWhiteSpace + "\\)" + OptionalWhiteSpace);

  const modifier =
    (stateVar.isImmutable && "immutable") ||
    (stateVar.isDeclaredConst && "constant");

  const re = new RegExp(
    [
      regexTypeName,
      OptionalWhiteSpace,
      ...(modifier
        ? [
            `((public${OptionalWhiteSpace}${modifier})|(${modifier}${OptionalWhiteSpace}public))`,
            OptionalWhiteSpace,
          ]
        : ["public", OptionalWhiteSpace]),
      stateVar.name,
    ].join(""),
    "g"
  );
  if (!re.exec(code)) {
    console.log(
      `Replacement failed for ${typeName} internal${
        modifier ? ` ${modifier}` : ""
      } ${stateVar.name}`
    );
    return undefined;
  }
  return code.replace(
    re,
    `${typeName} internal${modifier ? ` ${modifier}` : ""} ${stateVar.name}`
  );
}

// const code = `
// /**
//  * WOW IE
//  */
// contract ABC {
//   function helloThere() external {}
// }`;

// console.log(
//   updateContract(
//     readFileSync(
//       path.join(
//         __dirname,
//         "TMP.sol"
//         // "/home/dillon/OpenSea/seaport-1.2/contracts",
//         // "lib/Consideration.sol"
//       ),
//       "utf8"
//     ),
//     { rename: "ConsiderationJumpTable" }
//   )
// );
