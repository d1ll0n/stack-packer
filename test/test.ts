import fs from 'fs';
import path from 'path';
import { parseCode } from '../src/parser/index';
import { UnpackerGen } from '../src/code-gen/sol-gen';
import { AbiStruct, AbiEnum } from '../src/lib/types';

import { expect } from 'chai';

describe('Test ABI Solidity Codegen', () => {
  let testInput, testOutput, testOutputVerbose, testOutputJson;
  before(() => {
    testInput = fs.readFileSync(path.join(__dirname, 'test-files', 'TestInput.sol'), 'utf8');
    testOutput = fs.readFileSync(path.join(__dirname, 'test-files', 'TestOutput.sol'), 'utf8');
    testOutputVerbose = fs.readFileSync(path.join(__dirname, 'test-files', 'TestOutputVerbose.sol'), 'utf8');
    testOutputJson = fs.readFileSync(path.join(__dirname, 'test-files', 'test-output.json'), 'utf8');
  })

  it('Should generate the correct outputs', () => {
    const structs = parseCode(testInput);
    const json = JSON.stringify(structs, null, 2);
    expect(json).to.eql(testOutputJson);
    const sol = UnpackerGen.createLibrary(`TestOutput`, <Array<AbiStruct | AbiEnum>> structs, { verbose: false });
    expect(sol).to.eql(testOutput);
    const solVerbose = UnpackerGen.createLibrary(`TestOutputVerbose`, <Array<AbiStruct | AbiEnum>> structs);
    expect(solVerbose).to.eql(testOutputVerbose);
  })
})

// const testInput = fs.readFileSync(path.join(__dirname, 'test-files', 'TestInput.sol'), 'utf8');
// const structs = parseCode(testInput);
// const sol = UnpackerGen.createLibrary(`TestOutput`, <Array<AbiStruct | AbiEnum>> structs, { verbose: false });
// const solVerbose = UnpackerGen.createLibrary(`TestOutputVerbose`, <Array<AbiStruct | AbiEnum>> structs);
// const json = JSON.stringify(structs, null, 2);
// fs.writeFileSync(path.join(__dirname, 'test-files', 'TestOutput.sol'), sol);
// fs.writeFileSync(path.join(__dirname, 'test-files', 'TestOutputVerbose.sol'), solVerbose);
// fs.writeFileSync(path.join(__dirname, 'test-files', 'test-output.json'), json)
