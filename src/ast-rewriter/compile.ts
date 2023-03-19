import "../lib/String";
// import { ABIEncoderVersion } from "solc-typed-ast/dist/types/abi";
import { NodeQ, YulQ } from "./NodeQ";

import path from "path";

import {
  // ArrayTypeName,
  ASTReader,
  CompilationOutput,
  CompileResult,
  CompilerKind,
  compileSol,
  compileSourceString,
  LatestCompilerVersion,
  SourceUnit,
} from "solc-typed-ast";
// import { inspect } from "util";
import { AbiEnum, AbiStruct /* AbiType */ } from "../types";
import { abiStructToSol } from "../code-gen/codegen-helpers";
import { arrJoiner } from "../lib/text";

const CompilerOpts = [
  "auto",
  undefined,
  [CompilationOutput.AST],
  { viaIR: true },
  CompilerKind.Native,
] as [string, undefined, CompilationOutput[], any, CompilerKind];

type CompiledOutput = {
  compileResult: CompileResult;
  reader: ASTReader;
  sourceUnits: SourceUnit[];
  entryPath: string;
  projectRoot: string;
};

function processCompileResult(
  compileResult: CompileResult,
  entryPath: string
): CompiledOutput {
  const reader = new ASTReader();
  const sourceUnits = reader.read(compileResult.data);
  return {
    reader,
    sourceUnits,
    compileResult,
    entryPath,
    projectRoot: path.parse(entryPath)?.dir || entryPath,
  };
}

export async function compileSourceCode(
  code: string,
  fileName: string = "File.sol"
): Promise<CompiledOutput> {
  const [version, pathOptions, output, settings, kind] = CompilerOpts;
  const compileResult = await compileSourceString(
    fileName,
    code,
    version,
    pathOptions,
    output,
    settings,
    kind
  );
  return processCompileResult(compileResult, fileName);
}

export async function compileSources(
  entryPath: string
): Promise<CompiledOutput> {
  const [version, pathOptions, output, settings, kind] = CompilerOpts;
  const compileResult = await compileSol(
    entryPath,
    version,
    pathOptions,
    output,
    settings,
    kind
  );
  return processCompileResult(compileResult, entryPath);
}

export async function compileSolBlock(code: string) {
  const template = `pragma solidity >=${LatestCompilerVersion};
contract Template {
  mapping(uint256 => address) internal data;
  function templateFunction() external returns (address) {
    return data[1];
  }
}`;

  const { sourceUnits } = await compileSourceCode(template);
  const [fn] = NodeQ.from(sourceUnits).findFunctionsByName("templateFunction");
  // NodeQ.from(sourceUnits)
  // .find("MemberAccess")
  fn.vBody.children.forEach((stmt) => {
    console.log(stmt);
  });
  return fn.vBody;
}

export async function compileYul(code: string, fileCode?: string) {
  const template = `pragma solidity >=${LatestCompilerVersion};
${fileCode || ""}
function templateFunction() {
  assembly {
    ${code}
  }
}`;

  const { sourceUnits } = await compileSourceCode(template);
  const [asm] = NodeQ.from(sourceUnits).find("InlineAssembly");
  return YulQ.fromInlineAssembly(asm);
}

export async function compileSolFunction(
  fnCode: string,
  typeDependencies: (AbiStruct | AbiEnum)[] = []
) {
  const dependencyDefinitions = typeDependencies.map((type) =>
    abiStructToSol(type)
  );
  const code = arrJoiner([
    `pragma solidity >=${LatestCompilerVersion};`,
    "",
    ...dependencyDefinitions,
    "",
    fnCode,
  ]);
  const { sourceUnits } = await compileSourceCode(code);
  const [fn] = NodeQ.from(sourceUnits).find("FunctionDefinition");
  return fn;
}

export async function compileSolCode(code: string) {
  const template = `pragma solidity >=${LatestCompilerVersion};

contract Template {
  // error XRS();
  function templateFunction() external {
    // bytes4 y = Template.XRS.selector;
  }
}`;

  const { sourceUnits } = await compileSourceCode(template);
  const [typename] = NodeQ.from(sourceUnits).find("UserDefinedTypeName");
  return typename.vReferencedDeclaration;
}

// const code = arrJoiner([
//   `function myFunction(cdPtrParent, mPtrParent, headOffset) {`,
//   [
//     `let cdPtrLength := add(`,
//     `  cdPtrParent,`,
//     `  calldataload(add(cdPtrParent, headOffset))`,
//     `)`,
//     `let arrLength := calldataload(cdPtrLength)`,
//     `let mPtrLength := mload(0x40)`,
//     ` `,
//     `mstore(mPtrLength, arrLength)`,
//     `mstore(add(mPtrParent, headOffset), mPtrLength)`,
//     `let mPtrHead := add(mPtrLength, 32)`,
//     `let mPtrTail := add(mPtrHead, mul(arrLength, 0x20))`,
//     `let mPtrTailNext := mPtrTail`,
//     ` `,
//     `// Copy elements to memory`,
//     `// Calldata does not have individual offsets for array elements with a fixed size.`,
//     `calldatacopy(`,
//     `  mPtrTail,`,
//     `  add(cdPtrLength, 0x20),`,
//     `  mul(arrLength, 0xa0)`,
//     `)`,
//     ` `,
//     `for {} lt(mPtrHead, mPtrTail) {} {`,
//     `  mstore(mPtrHead, mPtrTailNext)`,
//     `  mPtrHead := add(mPtrHead, 0x20)`,
//     `  mPtrTailNext := add(mPtrTailNext, 0xa0)`,
//     `}`,
//     `mstore(0x40, mPtrTailNext)`,
//   ],
//   `}`,
// ]);

// console.log(code);
// async function testY() {
//   const q = await compileYul(code);
//   const fn = q.findFunctionsByName("myFunction");
//   console.log(fn);
// }

// testY();
