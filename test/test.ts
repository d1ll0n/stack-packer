import fs from 'fs';
import path from 'path';
import { parseCode } from '../src/parser/index';
import { UnpackerGen } from '../src/code-gen/sol-gen';
import { AbiStruct, AbiEnum } from '../src/lib/types';

const example = fs.readFileSync(path.join(__dirname, 'Example.sol'), 'utf8');
const structs = parseCode(example);
fs.writeFileSync('example-output-0.json', JSON.stringify(structs, null, 2))
const gen = UnpackerGen.createLibrary(`Example`, <Array<AbiStruct | AbiEnum>> structs);
fs.writeFileSync('example-gen-0.sol', gen);

const example1 = `
struct ExampleWrapper {
  uint32[2] x;
  bytes32[3] y;
  uint56 a;
}
`;
const structs1 = parseCode(example1);
fs.writeFileSync('example-output-1.json', JSON.stringify(structs1, null, 2))
const gen1 = UnpackerGen.createLibrary(`Example1`, <Array<AbiStruct | AbiEnum>> structs1, { verbose: false });
fs.writeFileSync('example-gen-1.sol', gen1);