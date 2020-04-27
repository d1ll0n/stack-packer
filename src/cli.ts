#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { parseCode } from './parser/index';
import { UnpackerGen } from './code-gen/sol-gen';
import { buildLibrary } from './code-gen/ts-gen';
import { AbiStruct, AbiEnum } from './lib/types';

const argv = require('yargs')
  .usage('Usage: <lang> [options]')
  .command({
    command: 'sol',
    describe: 'generate solidity library',
    builder: {
      input: {
        alias: ['i'],
        describe: 'input file or directory to read solidity structs from',
        demandOption: true,
        coerce: path.resolve
      },
      output: {
        alias: ['o', 'outDir'],
        describe: 'file or directory to write generated code to',
        demandOption: true,
        coerce: path.resolve
      },
      verbose: {
        alias: 'v',
        describe: 'code verbosity',
        default: false,
        type: 'boolean'
      }
    }
  })
  .command({
    command: 'ts',
    describe: 'generate typescript library',
    builder: {
      input: {
        alias: ['i'],
        describe: 'input file to read structs from',
        demandOption: true,
        coerce: path.resolve
      },
      output: {
        alias: 'o',
        describe: 'directory to write generated code to',
        demandOption: true,
        coerce: path.resolve
      },
      verbose: {
        alias: 'v',
        describe: 'code verbosity',
        default: false,
        type: 'boolean'
      }
    }
  })
  .help('h')
  .fail(function(msg, err) {
    console.error(msg);
    process.exit(1);
  })
  .argv;

if (!fs.existsSync(argv.input)) throw new Error(`File not found: ${argv.input}`);
const code = fs.readFileSync(argv.input, 'utf8');
const structs = <Array<AbiStruct | AbiEnum>> parseCode(code);

if (argv._.includes('sol')) {
  const lib = UnpackerGen.createLibrary('OutputCode', structs, { verbose: argv.verbose });
  fs.writeFileSync(argv.output, lib);
}

if (argv._.includes('ts')) {
  const dir = argv.output;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const files = buildLibrary(<Array<AbiStruct | AbiEnum>> structs);
  const index = [];
  files.forEach(({ code, fileName, jsonFile, jsonFileName }) => {
    fs.writeFileSync(path.join(dir, fileName), code);
    fs.writeFileSync(path.join(dir, jsonFileName), jsonFile);
    index.push(`export * from './${fileName}';`);
  });
  fs.writeFileSync(path.join(dir, 'index.ts'), index.join('\n').replace(/\.ts/g, ''));
}