import fs from 'fs';
import path from 'path';
import { parseCode } from '../src/parser/index';
import { UnpackerGen } from '../src/code-gen/sol-gen';
import { AbiStruct, AbiEnum } from '../src/lib/types';

const example = fs.readFileSync(path.join(__dirname, 'Example.sol'), 'utf8');
const structs = parseCode(example);
fs.writeFileSync('example-output.json', JSON.stringify(structs, null, 2))
const gen = UnpackerGen.createLibrary(`Example`, <Array<AbiStruct | AbiEnum>> structs);
fs.writeFileSync('example-gen.sol', gen);