import fs from 'fs';
import path from 'path';
import { parseCode } from '../parser';
import { AbiEnum, AbiStruct } from '../types';
import { isDir, isSolFile } from './paths';

export type FileWithStructs = { fileName: string; structs: Array<AbiStruct | AbiEnum> }

export const getInputFiles = (argv: { input: string }): FileWithStructs[] => {
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