import fs from "fs";
import path from "path";

export const getExtension = (_path: string) => path.parse(_path).ext;

export const isFile = (_path) => fs.statSync(_path).isFile();

export const isSolFile = (_path: string) =>
  isFile(_path) && getExtension(_path) === ".sol";

export const isDir = (_path: string) => fs.statSync(_path).isDirectory();

export const getDir = (_path: string) =>
  !path.parse(_path).ext ? _path : path.parse(_path).dir;

export const parentOf = (_path: string) => path.parse(_path).dir;

export const containsChild = (_path: string, child: string) =>
  fs.existsSync(path.join(_path, child));

export const findDirectoryInTree = (_path: string, parentName: string) => {
  const parents = getDir(_path).split(path.sep);
  const indexOfParent = parents.lastIndexOf(parentName);
  if (indexOfParent < 0) return undefined;
  return path.join(
    path.parse(_path).root,
    ...parents.slice(0, indexOfParent + 1)
  );
};

export const findChild = (
  _path: string,
  childOrPossibleChildren: string | string[]
): string | undefined => {
  if (Array.isArray(childOrPossibleChildren)) {
    return childOrPossibleChildren.find((child) => findChild(_path, child));
  }
  if (fs.existsSync(path.join(_path, childOrPossibleChildren))) {
    return childOrPossibleChildren;
  }
};

const recursiveMkDirIfNotExists = (target: string, original: string) => {
  if (!fs.existsSync(target)) {
    const parent = path.parse(target).dir;
    if (!parent) {
      throw Error(`Failed to resolve existing parent for ${original}`);
    }
    recursiveMkDirIfNotExists(parent, original);
    fs.mkdirSync(target);
  }
};

export const mkdirIfNotExists = (target: string) => {
  const targetDir = getDir(toAbsolutePath(target));
  recursiveMkDirIfNotExists(targetDir, targetDir);
  return targetDir;
};

export const toAbsolutePath = (target: string) =>
  path.isAbsolute(target) ? target : path.join(process.cwd(), target);

export const getAllSolidityFilesInDirectory = (target: string): string[] => {
  const children = fs.readdirSync(target).map((p) => path.join(target, p));
  if (!children) return [];
  const grandChildren = children
    .filter(isDir)
    .reduce(
      (arr, child) => [...arr, ...getAllSolidityFilesInDirectory(child)],
      []
    );
  const solChildren = children.filter(isSolFile);
  return [...solChildren, ...grandChildren];
};

export const getRelativePath = (from: string, to: string): string => {
  let relative = path.relative(from, to);
  if (!relative.startsWith("../")) relative = `./${relative}`;
  return relative;
};
