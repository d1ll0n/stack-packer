#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { parseCode } from './parser/index';
import { UnpackerGen } from './code-gen/sol-gen';
import { AbiStruct, AbiEnum } from './lib/types';

const argv = require('yargs')
  .usage('Usage: <lang> [options]')
  .boolean('sol')
  .default('sol', true)
  .describe('sol', 'generate solidity library')
  .option('input', {
    alias: 'i',
    describe: 'input file to read structs from',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: 'file to write generated code to',
    demandOption: true
  })
  .option('verbose', {
    alias: 'v',
    describe: 'code verbosity',
    default: false,
    type: 'boolean'
  })
  .coerce(['input', 'output'], path.resolve)
  .help('h')
  .fail(function(msg, err) {
    if (err instanceof InputError) console.error('Input file not found.');
    process.exit(1);
  })
  .argv;

class InputError extends Error {}

if (argv.sol) {
  if (!fs.existsSync(argv.input)) throw new InputError();
  const code = fs.readFileSync(argv.input, 'utf8');
  const structs = <Array<AbiStruct | AbiEnum>> parseCode(code);
  const lib = UnpackerGen.createLibrary('OutputCode', structs, { verbose: argv.verbose });
  fs.writeFileSync(argv.output, lib);
}