import {
  EnumDefinition,
  StructDefinition,
  GroupDefinition,
  ContractDefinition,
  VariableDeclaration,
  TypeName as AntlrTypeName,
  NumberLiteral,
  SourceUnit,
  FunctionDefinition,
  CustomErrorDefinition,
  EventDefinition,
  ASTNode,
  parse
} from '@d1ll0n/solidity-parser';
import { EnumType, StructType, StructField, TypeName, DefinedType, FunctionType, ErrorType, EventType, CoderType, GroupType } from './types';
import path from 'path';
import fs from 'fs';
import { string } from 'yargs';

export function parseTypeName(scopeName: string, typeName: AntlrTypeName): TypeName {
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
export function parseMember(scopeName: string, member: VariableDeclaration, defaultCoderType: CoderType): StructField {
  const { typeName, name, coderType } = member;
  const accessors = member.accessors && {
    getterCoderType: member.accessors.getterCoderType,
    setterCoderType: member.accessors.setterCoderType,
  }
  return { typeName: parseTypeName(scopeName, typeName), name, coderType: coderType || defaultCoderType, accessors };
}

export function parseStruct(scopeName: string, subNode: StructDefinition): StructType {
  const {type, name, members, coderType} = subNode;
  const namePath = `${scopeName}.${name}`;
  const fields = members.map(member => parseMember(scopeName, member, coderType));
  const accessors = subNode.accessors && {
    getterCoderType: subNode.accessors.getterCoderType,
    setterCoderType: subNode.accessors.setterCoderType,
  };
  const groups = (subNode.groups ?? []).map(parseGroup)
  return { name, type, namePath, fields, coderType: coderType || 'checked', accessors, groups };
}

export function parseGroup(subnode: GroupDefinition): GroupType {
  const { name, accessors, coderType } = subnode;
  const members = subnode.members.map((member) => ({ name: member.name, coderType: member.coderType }));
  return {
    name,
    accessors,
    coderType,
    members
  }
}

export function parseError(scopeName: string, subNode: CustomErrorDefinition): ErrorType {
  const { type, name, parameters } = subNode;
  const namePath = [scopeName, '.', name].join('');
  const fields = parameters.map(member => parseMember(scopeName, member, 'unchecked'));
  return { name, type, namePath, fields }
}

export function parseEvent(scopeName: string, subNode: EventDefinition): EventType {
  const { type, name, parameters } = subNode;
  const namePath = [scopeName, '.', name].join('');
  const fields = parameters.map(member => ({
    ...parseMember(scopeName, member, 'unchecked'),
    isIndexed: member.isIndexed
  }));
  return { name, type, namePath, fields }
}

export function parseFunction(scopeName: string, subNode: FunctionDefinition): FunctionType {
  const {type, name, parameters, returnParameters, stateMutability, visibility} = subNode;
  const namePath = `${scopeName}.${name}`;
  const input = parameters.map(member => parseMember(scopeName, member, 'unchecked'));
  const output = returnParameters.map(member => parseMember(scopeName, member, 'unchecked'));
  return { name, type, namePath, input, output, stateMutability, visibility };
}

// export function parseFunction()

export function parseEnum(scopeName: string, subNode: EnumDefinition): EnumType {
  const {type, name, members} = subNode;
  const namePath = `${scopeName}.${name}`;
  const fields = members.map(({ name }) => name);
  return { name, type, namePath, fields };
}

type SubNodeType = StructDefinition | EnumDefinition | FunctionDefinition | CustomErrorDefinition | EventDefinition
const SubNodeTypeStrings = [
  'StructDefinition',
  'EnumDefinition',
  'FunctionDefinition',
  'CustomErrorDefinition',
  'EventDefinition'
]
type SubNodeTypeString = typeof SubNodeTypeStrings[number]

type SubNodeTypeMap<U> = { [K in SubNodeTypeString]: U extends { type: K } ? U : never }
type OutputMap = SubNodeTypeMap<DefinedType>
type InputMap = SubNodeTypeMap<SubNodeType>
type ParserMap = {
  [K in SubNodeTypeString]: (scopeName: string, input: InputMap[K]) => OutputMap[K]
}
const parsers: ParserMap = {
  'StructDefinition': parseStruct,
  'EnumDefinition': parseEnum,
  'FunctionDefinition': parseFunction,
  'CustomErrorDefinition': parseError,
  'EventDefinition': parseEvent
}

function parseSubNode(scopeName: string, subNode: SubNodeType) {
  return parsers[subNode.type](scopeName, subNode)
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

const isSupportedNode = (x: ASTNode): x is SubNodeType => {
  return SubNodeTypeStrings.includes(x.type);
}

export function parseFile(file: string): DefinedType[] {
  let structs = [];
  const { children } = <SourceUnit> parse(file, { tolerant: true });
  for (const child of children) {
    if (isSupportedNode(child)) {
      structs.push(parseSubNode('', child))
    }
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