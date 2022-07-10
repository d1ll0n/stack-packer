import fs from 'fs';
import path from 'path';
import { ProjectType } from '../code-gen/context';
import { findChild, findDirectoryInTree, getDir, getExtension, mkdirIfNotExists, parentOf } from './paths';

const PossibleTestDirectories = ['test', 'tests', 'mock', 'mocks']

const getTestContractsDirectory = (opts: { contractsDirectory?: string; output?: string; testContracts?: string; }) => {
  const { contractsDirectory, output, testContracts } = opts;
  if (testContracts) return mkdirIfNotExists(testContracts);

  let testDirectory: string;

  // If in hardhat package, use test directory if it exists, otherwise make one
  if (contractsDirectory) {
    const childDir = findChild(contractsDirectory, PossibleTestDirectories)
    if (childDir) {
      testDirectory = path.join(contractsDirectory, childDir)
    } else {
      testDirectory = mkdirIfNotExists(path.join(contractsDirectory, 'test'))
    }
  }
  // Otherwise, use output directory
  else {
    testDirectory = getDir(output)
  }

  return testDirectory;
}

const getHardhatRootFromContracts = (srcDirectory: string) => {
  const rootDirectory = srcDirectory && parentOf(srcDirectory);
  const hardhatConfigFile = rootDirectory && findChild(rootDirectory, ['hardhat.config.js', 'hardhat.config.ts'])
  if (hardhatConfigFile) {
    return { rootDirectory, hardhatConfigFile: path.join(rootDirectory, hardhatConfigFile) };
  }
  return {};
}

const getHardhatTestDirectory = (opts: { hardhatOutput?: string; rootDirectory: string; }) => {
  const { hardhatOutput, rootDirectory } = opts;
  const testDirectory = hardhatOutput || path.join(rootDirectory, 'test')
  return mkdirIfNotExists(testDirectory);
}

const tryFindHardhatProjectInPath = (contractsPath?: string) => {
  const contractsDirectory = contractsPath && findDirectoryInTree(contractsPath, 'contracts')
  const {rootDirectory, hardhatConfigFile} = contractsDirectory ? getHardhatRootFromContracts(contractsDirectory) : {} as any;
  if (rootDirectory && hardhatConfigFile && contractsDirectory) {
    return {
      contractsDirectory,
      rootDirectory,
      hardhatConfigFile
    }
  }
  return undefined;
}

function tryFindHardhatDirectories(output?: string, input?: string) {
  let projectDirs = output && tryFindHardhatProjectInPath(output);
  if (!projectDirs) {
    projectDirs = input && tryFindHardhatProjectInPath(input)
  }
  if (!projectDirs) {
    const contractsDirectory = path.join(process.cwd(), 'contracts');
    if (fs.existsSync(contractsDirectory)) {
      projectDirs = tryFindHardhatProjectInPath(contractsDirectory)
    }
  }
  return projectDirs
}

export const getHardhatProjectInfo = (argv: { output: string; input: string; constantsFile: any; testContracts?: string; hardhatOutput?: string }) => {
  const directories = tryFindHardhatDirectories(argv.output, argv.input) || undefined;
  if (!directories) return;
  const { rootDirectory, contractsDirectory, hardhatConfigFile } = directories

  const projectType = (getExtension(hardhatConfigFile) === '.ts' ? 'hardhat.ts' : 'hardhat.js') as ProjectType;
  const testContractsDirectory = argv.testContracts || getTestContractsDirectory({ output: argv.output, contractsDirectory });
  const hardhatTestsDirectory = getHardhatTestDirectory({ hardhatOutput: argv.hardhatOutput, rootDirectory });

  return {
    projectType,
    rootDirectory,
    contractsDirectory,
    hardhatConfigFile,
    testContractsDirectory,
    hardhatTestsDirectory
  }
}