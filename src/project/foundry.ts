import fs from 'fs'
import path from "path"
import { containsChild, findDirectoryInTree, getDir, mkdirIfNotExists, parentOf } from "./paths"

const getFoundryRootFromSrc = (srcDirectory: string) => {
  const rootDirectory = srcDirectory && parentOf(srcDirectory);
  if (containsChild(rootDirectory, 'foundry.toml')) {
    return rootDirectory;
  }
}

function tryFindFoundryDirectories(output: string) {
  let srcDirectory = findDirectoryInTree(output, 'src');
  let rootDirectory = srcDirectory && getFoundryRootFromSrc(srcDirectory);
  if (!rootDirectory) {
    srcDirectory = path.join(process.cwd(), 'src')
    if (fs.existsSync(srcDirectory)) {
      rootDirectory = getFoundryRootFromSrc(srcDirectory);
    }
  }
  return { srcDirectory, rootDirectory }
}

export const getFoundryProject = (argv: { output: string; input: string; constantsFile: any; testContracts: string; }) => {
  const { srcDirectory, rootDirectory } = tryFindFoundryDirectories(argv.output);
  if (!srcDirectory || !rootDirectory) return;
  // const testContractsDirectory = mkdirIfNotExists(path.join())
}