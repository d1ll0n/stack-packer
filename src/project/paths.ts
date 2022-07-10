import fs from 'fs';
import path from 'path';

export const getExtension = (_path: string) => path.parse(_path).ext;

export const isSolFile = (_path: string) => getExtension(_path) === '.sol';

export const isDir = (_path: string) => !Boolean(getExtension(_path));

export const getDir = (_path: string) => isDir(_path) ? _path : path.parse(_path).dir;

export const parentOf = (_path: string) => path.parse(_path).dir;

export const containsChild = (_path: string, child: string) => fs.existsSync(path.join(_path, child))

export const findDirectoryInTree = (_path: string, parentName: string) => {
  const parents = getDir(_path).split(path.sep);
  const indexOfParent = parents.lastIndexOf(parentName);
  if (indexOfParent < 0) return undefined;
  return path.join(path.parse(_path).root, ...parents.slice(0, indexOfParent + 1));
}

export const findChild = (_path: string, childOrPossibleChildren: string | string[]): string | undefined => {
  if (Array.isArray(childOrPossibleChildren)) {
    return childOrPossibleChildren.find(child => findChild(_path, child))
  }
  if (fs.existsSync(path.join(_path, childOrPossibleChildren))) {
    return childOrPossibleChildren
  }
}

const recursiveMkDirIfNotExists = (target: string, original: string) => {
  if (!fs.existsSync(target)) {
    const parent = path.parse(target).dir;
    if (!parent) {
      throw Error(`Failed to resolve existing parent for ${original}`)
    }
    recursiveMkDirIfNotExists(parent, original);
    fs.mkdirSync(target);
  }
}

export const mkdirIfNotExists = (target: string) => {
  const targetDir = getDir(toAbsolutePath(target))
  recursiveMkDirIfNotExists(targetDir, targetDir)
  return targetDir
}

export const toAbsolutePath = (target: string) => path.isAbsolute(target) ? target : path.join(process.cwd(), target);