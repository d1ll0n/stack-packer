import parser, {
  EnumDefinition,
  StructDefinition,
  ContractDefinition,
  VariableDeclaration,
  TypeName as AntlrTypeName,
  NumberLiteral,
  SourceUnit,
  FunctionDefinition
} from 'solidity-parser-antlr';
import { EnumType, StructType, StructField, TypeName, DefinedType, FunctionType } from './types';
import path from 'path';
import fs from 'fs';

function parseTypeName(scopeName: string, typeName: AntlrTypeName): TypeName {
  if (typeName.type == 'ElementaryTypeName') return typeName;
  if (typeName.type == 'UserDefinedTypeName') {
    let namePath = (typeName.namePath.includes('.'))
      ? typeName.namePath : `${scopeName}.${typeName.namePath}`
    return {...typeName, namePath}
  }
  if (typeName.type == 'ArrayTypeName') {
    const { type, baseTypeName, length } = typeName;
    return {
      type,
      baseTypeName: parseTypeName(scopeName, baseTypeName),
      length: length ? {
        number: +(length as NumberLiteral).number,
        type: 'NumberLiteral'
      } : null
    }
  }
  if (typeName.type == 'Mapping') {
    throw new Error(`Caught unencodable type Mapping in ${scopeName}`)
  }
  throw new Error(`Did not recognize type ${typeName.type} in ${scopeName}`)
}

/**
 * @param scopeName Name of the scope which contains the member (contract.struct)
 * @param member 
 *    @member type VariableDeclaration
 *    @member typeName Object with data about the type
 *    @member name Name of the field in the struct
 */
export function parseMember(scopeName: string, member: VariableDeclaration): StructField {
  const { typeName, name } = member;
  return { typeName: parseTypeName(scopeName, typeName), name };
}

export function parseStruct(scopeName: string, subNode: StructDefinition): StructType {
  const {type, name, members} = subNode;
  const namePath = `${scopeName}.${name}`;
  const fields = members.map(member => parseMember(scopeName, member));
  return { name, type, namePath, fields };
}

export function parseFunction(scopeName: string, subNode: FunctionDefinition): FunctionType {
  const {type, name, parameters} = subNode;
  const namePath = `${scopeName}.${name}`;
  const fields = parameters.map(member => parseMember(scopeName, member));
  return { name, type, namePath, fields };
}

// export function parseFunction()

export function parseEnum(scopeName: string, subNode: EnumDefinition): EnumType {
  const {type, name, members} = subNode;
  const namePath = `${scopeName}.${name}`;
  const fields = members.map(({ name }) => name);
  return { name, type, namePath, fields };
}

type SubNodeType<FunctionsAllowed extends true | false> = FunctionsAllowed extends true
  ? StructDefinition | EnumDefinition | FunctionDefinition
  :StructDefinition | EnumDefinition

function parseSubNode(scopeName: string, subNode: SubNodeType<false>): DefinedType<false> {
  const {type, name} = subNode;
  if (type == 'StructDefinition') return parseStruct(scopeName, subNode as StructDefinition);
  if (type ==  'EnumDefinition') return parseEnum(scopeName, subNode as EnumDefinition);
}

export { parseSubNode }

export function parseContract(contractNode: ContractDefinition): DefinedType[] {
  let structs = [];
  const { subNodes, name } = contractNode;
  for (let subNode of subNodes) {
    const node = subNode as StructDefinition | EnumDefinition;
    try {
      const parsed = parseSubNode(name, node, /* false */);
      if (parsed) structs.push(parsed);
    } catch(err) {
      console.log(`Failed to parse subNode ${node.name} in ${name}: \n\t${err.message}`)
    }
  }
  return structs;
}

export function parseFile(file: string): DefinedType[] {
  let structs = [];
  const { children } = <SourceUnit> parser.parse(file, { tolerant: true });
  for (let child of children) if (child.type == 'ContractDefinition') {
    let _structs = parseContract(child)
    if (_structs.length) structs = structs.concat(_structs)
  }
  return structs;
}

export function recursiveDirectorySearch(_dirPath) {
  const files = fs.readdirSync(_dirPath).map(name => path.join(_dirPath, name));
  let filePaths = [];
  for (let fileName of files) {
    if (!fileName.includes('.')) {
      const subFiles = recursiveDirectorySearch(fileName);
      filePaths = filePaths.concat(subFiles);
    } else if (fileName.includes('.sol')) {
      filePaths.push(fileName);
    }
  }
  return filePaths;
}

export function parseDirectory(_dirPath) {
  const filePaths = recursiveDirectorySearch(_dirPath);
  let structs = [];
  for (let filePath of filePaths) {
    const data = fs.readFileSync(filePath, 'utf8');
    try {
      const _structs = parseFile(data);
      if (_structs.length) {
        const relativePath = filePath.replace(_dirPath, '');
        structs = structs.concat(_structs.map(x => ({...x, fromFile: relativePath})))
      }
    } catch(err) {
      console.log(`Caught error parsing ${filePath}`)
      throw err;
    }
  }
  return structs;
}