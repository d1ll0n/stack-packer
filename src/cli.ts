#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yargs, { Options } from "yargs";

import { arrJoiner } from "./lib/text";
import { createLookupTableLibrary } from "./tables/library";
import {
  FileContext,
  generateFileHeader,
  GeneratorOptions,
} from "./code-gen/context";
import { generateJumpTableForFunctions } from "./tables/external-jump-table";
import { getDir, isSolFile, mkdirIfNotExists } from "./project/paths";
import { getForgeTableTest } from "./tables/templates";
import { getHardhatProjectInfo, getInputFiles } from "./project";
import { prettierFormat } from "./code-gen/prettier";
import { UnpackerGen } from "./code-gen/word-packer";

const getPaths = (argv: {
  output: string;
  input: string;
  constantsFile: any;
  testContracts?: string;
  hardhatOutput?: string;
}) => {
  const inputFiles = getInputFiles(argv);

  const hardhatProjectInfo = getHardhatProjectInfo(argv);

  if (argv.output) {
    if (isSolFile(argv.output)) {
      if (inputFiles.length > 1) {
        throw new Error("Can not specify file output with directory input");
      }
    } else if (!fs.existsSync(argv.output)) {
      fs.mkdirSync(argv.output);
    }
  } else {
    if (hardhatProjectInfo?.contractsDirectory) {
      argv.output = mkdirIfNotExists(
        path.join(hardhatProjectInfo.contractsDirectory, "types")
      );
    } else {
      argv.output = process.cwd();
    }
  }
  const makeConstantsFile =
    argv.constantsFile === undefined
      ? argv.output && !isSolFile(argv.output)
      : argv.constantsFile;

  const constantsFilePath =
    makeConstantsFile && path.join(getDir(argv.output), "./CoderConstants.sol");

  const testContractsDirectory =
    argv.testContracts || hardhatProjectInfo?.testContractsDirectory;
  const hardhatTestsDirectory =
    argv.hardhatOutput || hardhatProjectInfo?.hardhatTestsDirectory;

  return {
    inputFiles,
    output: argv.output,
    constantsFilePath,
    testContractsDirectory,
    hardhatTestsDirectory,
    projectType: hardhatProjectInfo?.projectType,
  };
};

function createLookupTableFiles(
  size: number,
  type: "Lookup" | "Jump",
  lib: string,
  test: string,
  memorySafe: boolean
) {
  const { code, name, helpers } = createLookupTableLibrary(size, type, {
    output: lib,
    testContractsDirectory: test,
    disableMemorySafe: !memorySafe,
  });
  fs.writeFileSync(
    path.join(lib, `${name}.sol`),
    prettierFormat(
      arrJoiner(code).replace(/assembly {/g, `assembly ("memory-safe") {`)
    )
  );
  if (test) {
    const testFile = getForgeTableTest(helpers).replace(
      /assembly {/g,
      `assembly ("memory-safe") {`
    );
    fs.writeFileSync(
      path.join(test, `Test${name}.sol`),
      prettierFormat(testFile),
      "utf8"
    );
  }
}

yargs
  .command(
    "pack <input> [output] [testContracts] [hardhatOutput]",
    "Generate Solidity libraries for packed encoding of types on the stack.",
    {
      input: {
        alias: ["i"],
        describe: "Input file or directory to read solidity structs from.",
        demandOption: true,
        coerce: path.resolve,
      },
      output: {
        alias: ["o"],
        describe:
          "File or directory to write generated code to. Defaults to current working directory.",
        // default: () => process.cwd(),
        demandOption: false,
        coerce: path.resolve,
      },
      exact: {
        alias: "e",
        describe:
          "Use exact type sizes for inputs/outputs and remove overflow checks.",
        default: false,
        type: "boolean",
      },
      inline: {
        alias: "l",
        describe: "Inline all constants instead of explicitly defining them.",
        default: false,
        type: "boolean",
      },
      unsafe: {
        alias: "u",
        describe:
          "Remove all overflow checks while still using inexact sizes for parameters. Do not do this unless you are sure you have already checked for overflows.",
        default: false,
        type: "boolean",
      },
      noComments: {
        alias: "n",
        describe:
          "Remove all comments, including the generator notice, section separators and code summaries",
        default: false,
        type: "boolean",
      },
      constantsFile: {
        alias: "c",
        describe: "Create a separate file for constants.",
        default: undefined,
        type: "boolean",
      },
      testContracts: {
        alias: "t",
        describe:
          "Directory to write solidity test files to. Defaults to closest contracts/test directory of a hardhat test project in working tree.",
        default: "",
        type: "string",
      },
      hardhatOutput: {
        alias: "h",
        describe:
          "Directory to write Hardhat test files to. Defaults to closest test directory of a hardhat test project in working tree.",
        default: "",
        type: "string",
      },
    },
    ({ inline, exact, unsafe, noComments, ...argv }) => {
      if (unsafe) {
        if (exact) {
          throw Error("Can not use --unsafe command when --exact flag is set");
        }
        console.log(
          `Generating library with unsafe casting.\nHope you know what you're doing...`
        );
      }
      const {
        inputFiles,
        constantsFilePath,
        testContractsDirectory,
        hardhatTestsDirectory,
        ...otherPaths
      } = getPaths(argv);

      const options: GeneratorOptions = {
        inline,
        oversizedInputs: !exact,
        unsafe,
        noComments,
        constantsFile: Boolean(constantsFilePath),
        testContractsDirectory,
        hardhatTestsDirectory,
        ...otherPaths,
      };
      const context = new FileContext(options);
      for (const inputFile of inputFiles) {
        let outputFile = argv.output;

        const { code, libraryName, externalCode, hardhatTest } =
          UnpackerGen.createLibrary(inputFile.structs, context);
        if (testContractsDirectory && hardhatTestsDirectory) {
          mkdirIfNotExists(hardhatTestsDirectory);
          mkdirIfNotExists(testContractsDirectory);
          const externalOutputFile = path.join(
            testContractsDirectory,
            `External${libraryName}.sol`
          );
          const hardhatTestFile = path.join(
            hardhatTestsDirectory,
            `${libraryName}.spec.ts`
          );
          fs.writeFileSync(externalOutputFile, externalCode);
          fs.writeFileSync(hardhatTestFile, hardhatTest);
        }
        if (!isSolFile(outputFile)) {
          const outputName = libraryName || `${inputFile.fileName}Coder`;
          outputFile = path.join(outputFile, `${outputName}.sol`);
          mkdirIfNotExists(outputFile);
        }
        fs.writeFileSync(outputFile, code);
      }
      if (constantsFilePath) {
        // const outputFilePath = path.join(argv.output, 'CoderConstants.sol');
        const constantsFile = arrJoiner([
          ...generateFileHeader(true, false),
          ...context.constants,
        ]);
        fs.writeFileSync(constantsFilePath, constantsFile);
      }
    }
  )
  .command(
    "table-libs <output> [forge]",
    "Generate generic Solidity libraries for lookup and jump tables.",
    {
      output: {
        alias: ["o"],
        describe: "Directory to write Solidity libraries to.",
        demandOption: true,
        coerce: path.resolve,
      },
      forge: {
        alias: ["f"],
        describe: "Directory to write Forge tests for lookup and jump tables",
        demandOption: false,
        coerce: path.resolve,
      },
      memorySafe: {
        alias: ["m"],
        describe:
          "Whether to use memory-safe flag for assembly blocks. Default true to avoid stack-too-deep on functions with large number of inputs",
        demandOption: false,
        type: "boolean",
      },
      jump: {
        alias: ["j"],
        describe: "Only generate jump table library.",
        default: false,
        type: "boolean",
      },
      lookup: {
        alias: ["l"],
        describe: "Only generate lookup table libraries.",
        default: false,
        type: "boolean",
      } as Options,
      // size: {
      //   alias: ["s"],
      //   describe: "Lookup table sizes to generate - number of bytes per member."
      // }
    },
    ({ output, forge, memorySafe, jump, lookup }) => {
      if (output) {
        mkdirIfNotExists(output);
      }
      if (forge) {
        mkdirIfNotExists(forge);
      }
      if (!jump) {
        for (const i of [1, 2, 4]) {
          createLookupTableFiles(i, "Lookup", output, forge, memorySafe);
        }
      }
      if (!lookup) {
        createLookupTableFiles(2, "Jump", output, forge, memorySafe);
      }
    }
  )
  .command(
    "jump <input> [output] [forge]",
    [
      "Generate a Solidity contract which uses a jump table to locate jumpdests for external functions.",
      "Solidity input files will be rewritten as functional contracts which use jump tables for all external functions.",
      // "ABI input files will be used to generate an abstract contract that can be used as a template.",
    ].join("\n"),
    {
      input: {
        alias: ["i"],
        describe:
          "Input Solidity file. Does not support directories and file must include all external functions for the table.",
        demandOption: true,
        coerce: path.resolve,
      },
      output: {
        alias: ["o"],
        describe: "Directory to write Solidity files to.",
        demandOption: true,
        coerce: path.resolve,
      },
      memorySafe: {
        alias: ["m"],
        describe:
          "Whether to use memory-safe flag for assembly blocks. Default true to avoid stack-too-deep on functions with large number of inputs",
        demandOption: false,
        type: "boolean",
      },
      forge: {
        alias: ["f"],
        describe: "Directory to write Forge tests for lookup and jump tables",
        demandOption: false,
        coerce: path.resolve,
      },
      withLibrary: {
        alias: ["l"],
        describe:
          "Use a generic and reusable jump table library. If false, generates custom table for the contract which may behave differently for different contracts.",
        demandOption: false,
        default: true,
        type: "boolean",
      },
      selector: {
        alias: ["s"],
        describe: [
          'Type of function selector - either sequential function ids or "magic" modulus (lowest modulus with unique remainder for every selector).',
          "Magic modulus allows contract to be called normally, but guarantees selector collision.",
          "Sequential IDs are marginally cheaper but require caller to have additional knowledge of the contract.",
        ].join("\n"),
        choices: ["index", "magic"],
        default: "magic",
      },
    },
    ({ output, forge, withLibrary, selector, memorySafe, ...argv }) => {
      if (output) mkdirIfNotExists(output);
      if (forge) mkdirIfNotExists(forge);
      const [file] = getInputFiles(argv, {
        allowDirectory: false,
        allowJson: false,
        allowSol: true,
      });
      const result = generateJumpTableForFunctions(
        file.functions,
        selector as "index" | "magic",
        file.content,
        withLibrary,
        {
          output,
          name: file.contractName,
        }
      );
      const outputFile = prettierFormat(
        result.sourceCode ||
          arrJoiner([...result.fileHeader, ...result.contractBody])
      );
      fs.writeFileSync(
        path.join(output, `${file.contractName}JumpTable.sol`),
        outputFile
      );
      if (withLibrary) {
        createLookupTableFiles(2, "Jump", output, forge ?? "", memorySafe);
      }
    }
  )
  .help("h")
  .fail(function (msg, err) {
    console.error(msg);
    process.exit(1);
  }).argv;
