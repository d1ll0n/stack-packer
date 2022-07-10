#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { parseCode } from './parser/index';
import { UnpackerGen } from './code-gen/word-packer';
import { AbiStruct, AbiEnum } from './types';
import yargs from 'yargs'
import { FileContext, generateFileHeader, GeneratorOptions } from './code-gen/context';
import { arrJoiner } from './lib/text';
import { getDir, getExtension, isDir, isSolFile, mkdirIfNotExists } from './project/paths';
import {
  FileWithStructs,
  getInputFiles,
  getHardhatProjectInfo,
} from './project'

const getPaths = (argv: { output: string; input: string; constantsFile: any; testContracts?: string; hardhatOutput?: string; }) => {
  const inputFiles = getInputFiles(argv);
  
  const hardhatProjectInfo = getHardhatProjectInfo(argv);

  if (argv.output) {
    if (isSolFile(argv.output)) {
      if (inputFiles.length > 1) {
        throw new Error('Can not specify file output with directory input')
      }
    } else if (!fs.existsSync(argv.output)) {
      fs.mkdirSync(argv.output);
    }
  } else {
    if (hardhatProjectInfo?.contractsDirectory) {
      argv.output = mkdirIfNotExists(path.join(hardhatProjectInfo.contractsDirectory, 'types'))
    } else {
      argv.output = process.cwd();
    }
  }
  const makeConstantsFile = argv.constantsFile === undefined
    ? argv.output && !isSolFile(argv.output)
    : argv.constantsFile;

  const constantsFilePath = makeConstantsFile && path.join(getDir(argv.output), './CoderConstants.sol');

  const testContractsDirectory = argv.testContracts || hardhatProjectInfo?.testContractsDirectory
  const hardhatTestsDirectory = argv.hardhatOutput || hardhatProjectInfo?.hardhatTestsDirectory

  return {
    inputFiles,
    output: argv.output,
    constantsFilePath,
    testContractsDirectory,
    hardhatTestsDirectory,
    projectType: hardhatProjectInfo.projectType,
  }
}

yargs
  .command(
    '$0 <input> [output] [testContracts] [hardhatOutput]',
    'Generate Solidity libraries for packed encoding of types on the stack.',
    {
      input: {
        alias: ['i'],
        describe: 'Input file or directory to read solidity structs from.',
        demandOption: true,
        coerce: path.resolve
      },
      output: {
        alias: ['o'],
        describe: 'File or directory to write generated code to. Defaults to current working directory.',
        // default: () => process.cwd(),
        demandOption: false,
        coerce: path.resolve
      },
      exact: {
        alias: 'e',
        describe: 'Use exact type sizes for inputs/outputs and remove overflow checks.',
        default: false,
        type: 'boolean'
      },
      inline: {
        alias: 'l',
        describe: 'Inline all constants instead of explicitly defining them.',
        default: false,
        type: 'boolean'
      },
      unsafe: {
        alias: 'u',
        describe: 'Remove all overflow checks while still using inexact sizes for parameters. Do not do this unless you are sure you have already checked for overflows.',
        default: false,
        type: 'boolean'
      },
      noComments: {
        alias: 'n',
        describe: 'Remove all comments, including the generator notice, section separators and code summaries',
        default: false,
        type: 'boolean'
      },
      constantsFile: {
        alias: 'c',
        describe: 'Create a separate file for constants.',
        default: undefined,
        type: 'boolean'
      },
      testContracts: {
        alias: 't',
        describe: 'Directory to write solidity test files to. Defaults to closest contracts/test directory of a hardhat test project in working tree.',
        default: '',
        type: 'string'
      },
      hardhatOutput: {
        alias: 'h',
        describe: 'Directory to write Hardhat test files to. Defaults to closest test directory of a hardhat test project in working tree.',
        default: '',
        type: 'string'
      }
    },
    ({inline, exact, unsafe, noComments,  ...argv}) => {
      if (unsafe) {
        if (exact) {
          throw Error('Can not use --unsafe command when --exact flag is set')
        }
        console.log(`Generating library with unsafe casting.\nHope you know what you're doing...`)
      }
      const { inputFiles, constantsFilePath, testContractsDirectory, hardhatTestsDirectory, ...otherPaths } = getPaths(argv);
      
      const options: GeneratorOptions = {
        inline,
        oversizedInputs: !exact,
        unsafe,
        noComments,
        constantsFile: Boolean(constantsFilePath),
        testContractsDirectory,
        hardhatTestsDirectory,
        ...otherPaths
      };
      const context = new FileContext(options);
      for (const inputFile of inputFiles) {
        let outputFile = argv.output;
        
        const { code, libraryName, externalCode, hardhatTest } = UnpackerGen.createLibrary(inputFile.structs, context);
        if (testContractsDirectory && hardhatTestsDirectory) {
          mkdirIfNotExists(hardhatTestsDirectory)
          mkdirIfNotExists(testContractsDirectory)
          const externalOutputFile = path.join(testContractsDirectory, `External${libraryName}.sol`)
          const hardhatTestFile = path.join(hardhatTestsDirectory, `${libraryName}.spec.ts`);
          fs.writeFileSync(externalOutputFile, externalCode);
          fs.writeFileSync(hardhatTestFile, hardhatTest);
        }
        if (!isSolFile(outputFile)) {
          const outputName = libraryName || `${inputFile.fileName}Coder`;
          outputFile = path.join(outputFile, `${outputName}.sol`) ;
          mkdirIfNotExists(outputFile)
        }
        fs.writeFileSync(outputFile, code);
      }
      if (constantsFilePath) {
        // const outputFilePath = path.join(argv.output, 'CoderConstants.sol');
        const constantsFile = arrJoiner([
          ...generateFileHeader(true, false),
          ...context.constants
        ]);
        fs.writeFileSync(constantsFilePath, constantsFile)
      }
    }
  )
  .help('h')
  .fail(function(msg, err) {
    console.error(msg);
    process.exit(1);
  })
  .argv;