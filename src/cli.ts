#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { parseCode } from './parser/index';
import { UnpackerGen } from './code-gen/word-packer';
import { AbiStruct, AbiEnum } from './types';
import yargs from 'yargs'
import { FileContext, generateFileHeader, GeneratorOptions } from './code-gen/context';
import { arrJoiner } from './lib/text';

type FileWithStructs = { fileName: string; structs: Array<AbiStruct | AbiEnum> }

const isSolFile = (_path: string) => path.parse(_path).ext === '.sol';

const isDir = (_path: string) => fs.lstatSync(_path).isDirectory();

const getFiles = (argv: { input: string }): FileWithStructs[] => {
  if (!fs.existsSync(argv.input)) {
    throw new Error(`File or directory not found: ${argv.input}`);
  }
  const files: FileWithStructs[] = [];
  const filePaths: string[] = [];
  if (isDir(argv.input)) {
    const fileNames = fs.readdirSync(argv.input).filter(isSolFile);
    for (const fileName of fileNames) {
      const filePath = path.join(argv.input, fileName);
      filePaths.push(filePath);
    }
  } else {
    if (!isSolFile(argv.input)) {
      throw new Error(`${argv.input} is not a Solidity file`)
    }
    filePaths.push(argv.input);
  }
  for (const filePath of filePaths) {
    const { name } = path.parse(filePath);
    const code = fs.readFileSync(filePath, 'utf8');
    const structs = parseCode(code) as Array<AbiStruct | AbiEnum>;
    files.push({ fileName: name, structs })
  }
  return files;
}

yargs
  .command(
    '$0 <input> [output]',
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
      }
    },
    ({inline, exact, unsafe, noComments,  ...argv}) => {
      if (unsafe) {
        if (exact) {
          throw Error('Can not use --unsafe command when --exact flag is set')
        }
        console.log(`Generating library with unsafe casting.\nHope you know what you're doing...`)
      }
      const inputFiles = getFiles(argv);
      let constantsFile = argv.constantsFile
      if (constantsFile === undefined) {
        constantsFile = argv.output && !isSolFile(argv.output)
      }
      
      if (argv.output) {
        if (isSolFile(argv.output)) {
          if (inputFiles.length > 1) {
            throw new Error('Can not specify file output with directory input')
          }
        } else if (!fs.existsSync(argv.output)) {
          fs.mkdirSync(argv.output);
        }
      } else {
        argv.output = process.cwd();
      }
      
      const options: GeneratorOptions = {
        inline,
        oversizedInputs: !exact,
        unsafe,
        noComments,
        constantsFile
      };
      const context = new FileContext(options);
      for (const inputFile of inputFiles) {
        let outputFile = argv.output;
        const { code, libraryName } = UnpackerGen.createLibrary(inputFile.structs, context);
        if (!isSolFile(outputFile)) {
          const outputName = libraryName || `${inputFile.fileName}Coder`;
          outputFile = path.join(outputFile, `${outputName}.sol`) ;
        }
        fs.writeFileSync(outputFile, code);
      }
      if (constantsFile) {
        const outputFilePath = path.join(argv.output, 'CoderConstants.sol');
        const constantsFile = arrJoiner([
          ...generateFileHeader(true, false),
          ...context.constants
        ]);
        fs.writeFileSync(outputFilePath, constantsFile)
      }
    }
  )
  .help('h')
  .fail(function(msg, err) {
    console.error(msg);
    process.exit(1);
  })
  .argv;