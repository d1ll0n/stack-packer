import fs from "fs";
import path from "path";

import {
  AbiEnum,
  AbiError,
  AbiEvent,
  AbiFunction,
  AbiStruct,
  StateVariable,
} from "../types";
import { fromInterface } from "../parser/from-interface";
import { parseCode } from "../parser";
import { withSpaceOrNull } from "../lib/text";

import { getAllSolidityFilesInDirectory, getExtension, isDir } from "./paths";

export type FileWithStructs = {
  filePath: string;
  ext: string;
  content?: string;
  fileName: string;
  contractName?: string;
  structs: Array<AbiStruct | AbiEnum>;
  functions: AbiFunction[];
  stateVariables: StateVariable[];
  errors: AbiError[];
  events: AbiEvent[];
};

type Options = {
  allowJson?: boolean;
  allowSol?: boolean;
  allowDirectory?: boolean;
};

export const getInputFiles = (
  argv: { input: string },
  { allowJson = true, allowSol = true, allowDirectory = true }: Options = {}
): FileWithStructs[] => {
  if (!fs.existsSync(argv.input)) {
    throw new Error(
      `File${withSpaceOrNull(allowDirectory && " or directory")} not found: ${
        argv.input
      }`
    );
  }
  const files: FileWithStructs[] = [];
  const filePaths: string[] = [];
  if (isDir(argv.input)) {
    if (!allowDirectory) {
      throw Error(
        `Input must be a file. Provided path was a directory: ${argv.input}`
      );
    }
    filePaths.push(...getAllSolidityFilesInDirectory(argv.input));
  } else {
    const allowedExtensions = [allowJson && ".json", allowSol && ".sol"].filter(
      Boolean
    );
    const ext = getExtension(argv.input);
    if (!allowedExtensions.includes(ext)) {
      throw Error(
        `Unsupported file type: ${
          argv.input
        }\nSupported file types: ${allowedExtensions.join(",")}`
      );
    }
    filePaths.push(argv.input);
  }
  for (const filePath of filePaths) {
    try {
      const { name: fileName, ext } = path.parse(filePath);
      if (ext === ".json") {
        const jsonFile = require(filePath);
        const fragments = Array.isArray(jsonFile) ? jsonFile : jsonFile.abi;
        if (!fragments) {
          throw Error(`ABI not found in ${filePath}`);
        }
        files.push({
          filePath,
          ext,
          fileName,
          stateVariables: [],
          ...fromInterface(fragments),
        });
      } else {
        const code = fs.readFileSync(filePath, "utf8");
        const { functions, structs, stateVariables, errors, events, name } =
          parseCode(code);
        files.push({
          filePath,
          ext,
          content: code,
          fileName,
          contractName: name,
          structs: structs as Array<AbiStruct | AbiEnum>,
          functions,
          errors,
          events,
          stateVariables,
        });
      }
    } catch (err) {
      throw Error(`Error parsing file: ${filePath}\n` + err.message);
    }
  }
  return files;
};
