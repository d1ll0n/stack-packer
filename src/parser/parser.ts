import _ from "lodash";
import fs from "fs";
import path from "path";
import {
  TypeName as AntlrTypeName,
  ASTNode,
  ContractDefinition,
  CustomErrorDefinition,
  EnumDefinition,
  EventDefinition,
  FunctionDefinition,
  GroupDefinition,
  NumberLiteral,
  parse,
  SourceUnit,
  StateVariableDeclaration,
  StateVariableDeclarationVariable,
  StructDefinition,
  VariableDeclaration,
} from "@d1ll0n/solidity-parser";

// import { generateJumpTableForFunctions } from "../tables/external-jump-table";
import { getAllSolidityFilesInDirectory } from "../project";

import {
  CoderType,
  DefinedType,
  EnumType,
  ErrorType,
  EventType,
  FunctionType,
  GroupType,
  StateVariableType,
  StateVariableVariableType,
  StructField,
  StructType,
  TypeName,
} from "./types";

export function parseTypeName(
  scopeName: string,
  typeName: AntlrTypeName
): TypeName {
  if (typeName.type === "ElementaryTypeName") return typeName;
  if (typeName.type === "UserDefinedTypeName") return typeName;
  // {
  // /* let namePath = `${scopeName}.${typeName.namePath}`;
  // if (namePath.startsWith(".")) {
  // namePath = typeName.namePath;
  // } */
  // return { ...typeName, namePath };
  // }
  if (typeName.type === "ArrayTypeName") {
    const { type, baseTypeName, length } = typeName;
    return {
      type,
      baseTypeName: parseTypeName(scopeName, baseTypeName),
      length: length
        ? {
            number: +(length as NumberLiteral).number,
            type: "NumberLiteral",
          }
        : null,
    };
  }
  if (typeName.type === "Mapping") {
    const { type, keyType, valueType } = typeName;
    return {
      type,
      keyType: parseTypeName(scopeName, keyType),
      valueType: parseTypeName(scopeName, valueType),
    };
    // throw new Error(`Caught unencodable type Mapping in ${scopeName}`);
  }
  throw new Error(`Did not recognize type ${typeName.type} in ${scopeName}`);
}

/**
 * @param scopeName Name of the scope which contains the member (contract.struct)
 * @param member
 *    @member type VariableDeclaration
 *    @member typeName Object with data about the type
 *    @member name Name of the field in the struct
 */
export function parseMember(
  scopeName: string,
  member: VariableDeclaration,
  defaultCoderType: CoderType
): StructField {
  const { typeName, name, coderType } = member;
  const accessors = member.accessors && {
    getterCoderType: member.accessors.getterCoderType,
    setterCoderType: member.accessors.setterCoderType,
  };
  return {
    typeName: parseTypeName(scopeName, typeName),
    name,
    coderType: coderType || defaultCoderType,
    accessors,
  };
}

export function parseStruct(
  scopeName: string,
  subNode: StructDefinition
): StructType {
  const { type, name, members, coderType } = subNode;
  const namePath = name; // `${scopeName}.${name}`;
  const fields = members.map((member) =>
    parseMember(scopeName, member, coderType)
  );
  const accessors = subNode.accessors && {
    getterCoderType: subNode.accessors.getterCoderType,
    setterCoderType: subNode.accessors.setterCoderType,
  };
  const groups = (subNode.groups ?? []).map(parseGroup);
  return {
    name,
    type,
    namePath,
    fields,
    coderType: coderType || "checked",
    accessors,
    groups,
    _ast: subNode,
  };
}

export function parseGroup(subnode: GroupDefinition): GroupType {
  const { name, accessors, coderType } = subnode;
  const members = subnode.members.map((member) => ({
    name: member.name,
    coderType: member.coderType,
  }));
  return {
    name,
    accessors,
    coderType,
    members,
  };
}

export function parseError(
  scopeName: string,
  subNode: CustomErrorDefinition
): ErrorType {
  const { type, name, parameters } = subNode;
  const namePath = name; // [scopeName, ".", name].join("");
  const fields = parameters.map((member) =>
    parseMember(scopeName, member, "unchecked")
  );
  return { name, type, namePath, fields, _ast: subNode };
}

export function parseEvent(
  scopeName: string,
  subNode: EventDefinition
): EventType {
  const { type, name, parameters } = subNode;
  const namePath = name; // [scopeName, ".", name].join("");
  const fields = parameters.map((member) => ({
    ...parseMember(scopeName, member, "unchecked"),
    isIndexed: member.isIndexed,
  }));
  return { name, type, namePath, fields, _ast: subNode };
}

export function parseStateVariableDeclarationVariable(
  scopeName: string,
  subNode: StateVariableDeclarationVariable
): StateVariableVariableType {
  const {
    name,
    typeName,
    isStateVar,
    isDeclaredConst,
    isImmutable,
    storageLocation,
  } = subNode;
  const namePath = name; // [scopeName, ".", name].join("");
  return {
    type: "StateVariableDeclarationVariable",
    name,
    namePath,
    typeName: parseTypeName(scopeName, typeName),
    visibility: subNode.visibility,
    isStateVar,
    isDeclaredConst,
    isImmutable,
    storageLocation,
    _ast: subNode,
  };
}

export function parseStateVariableDeclaration(
  scopeName: string,
  subNode: StateVariableDeclaration
): StateVariableType {
  const members = subNode.variables.map((_var) =>
    parseStateVariableDeclarationVariable(scopeName, _var)
  );
  return {
    type: "StateVariableDeclaration",
    members,
    namePath: members[0].namePath,
    _ast: subNode,
  };
  // const { type, variables } = subNode;
  // const members = parse()
  // subNode.variables.map(v => v.)
}

export function parseFunction(
  scopeName: string,
  subNode: FunctionDefinition
): FunctionType {
  const {
    type,
    parameters,
    returnParameters,
    stateMutability,
    visibility,
    isConstructor,
    isFallback,
    isReceiveEther,
  } = subNode;
  const name = isConstructor
    ? "constructor"
    : isFallback
    ? "fallback"
    : isReceiveEther
    ? "receive"
    : subNode.name;
  const namePath = `${scopeName}.${name}`;
  /*   if (isConstructor) {
    console.log(namePath)
    console.log(vi)
  } */
  const input = (parameters || []).map((member) =>
    parseMember(scopeName, member, "unchecked")
  );
  const output = (returnParameters || []).map((member) =>
    parseMember(scopeName, member, "unchecked")
  );
  return {
    name,
    type,
    namePath,
    input,
    output,
    stateMutability,
    visibility,
    _ast: subNode,
  };
}

export function parseEnum(
  scopeName: string,
  subNode: EnumDefinition
): EnumType {
  const { type, name, members } = subNode;
  const namePath = name; // `${scopeName}.${name}`;
  const fields = members.map(({ name }) => name);
  return { name, type, namePath, fields, _ast: subNode };
}

type SubNodeType =
  | StructDefinition
  | EnumDefinition
  | FunctionDefinition
  | CustomErrorDefinition
  | EventDefinition
  | ContractDefinition
  | StateVariableDeclaration
  | StateVariableDeclarationVariable;
const SubNodeTypeStrings = [
  "StructDefinition",
  "EnumDefinition",
  "FunctionDefinition",
  "CustomErrorDefinition",
  "EventDefinition",
  "ContractDefinition",
  "StateVariableDeclaration",
  "StateVariableDeclarationVariable",
];
type SubNodeTypeString = typeof SubNodeTypeStrings[number];

type SubNodeTypeMap<U> = {
  [K in SubNodeTypeString]: U extends { type: K } ? U : never;
};
type OutputMap = SubNodeTypeMap<DefinedType>;
type InputMap = SubNodeTypeMap<SubNodeType>;
type ParserMap = {
  [K in SubNodeTypeString]: (
    scopeName: string,
    input: InputMap[K]
  ) => OutputMap[K];
};
const parsers: ParserMap = {
  StructDefinition: parseStruct,
  EnumDefinition: parseEnum,
  FunctionDefinition: parseFunction,
  CustomErrorDefinition: parseError,
  EventDefinition: parseEvent,
  StateVariableDeclaration: parseStateVariableDeclaration,
  StateVariableDeclarationVariable: parseStateVariableDeclarationVariable,
  // 'ContractDefinition': parseContract,
};

function parseSubNode(scopeName: string, subNode: SubNodeType) {
  return parsers[subNode.type](scopeName, subNode);
}

export { parseSubNode };

export function parseContract(contractNode: ContractDefinition): DefinedType[] {
  const structs = [];
  const { subNodes, name } = contractNode;
  for (const subNode of subNodes) {
    const node = subNode as StructDefinition | EnumDefinition;
    try {
      const parsed = parseSubNode(name, node /* false */);
      if (parsed) structs.push(parsed);
    } catch (err) {
      if ((node.type as any) === "StateVariableDeclaration") console.log(node);
      console.log(
        `Failed to parse subNode ${node.name} in ${name}: \n\t${err.message}`
      );
    }
  }
  return structs;
}

export const isSupportedNode = (x: ASTNode): x is SubNodeType => {
  return SubNodeTypeStrings.includes(x.type);
};

// type Contract = {
//   name: string;
//   subNodes: DefinedType[];
// }

// export function parseFileContracts(file: string): {
//   nodes: DefinedType[];
//   contracts: DefinedType[];
//   name?: string;
// } {
//   const nodes: DefinedType[] = [];
//   let name: string;
//   const { children } = <SourceUnit>parse(file, { tolerant: true });
//   for (const child of children) {
//     if (isSupportedNode(child)) {
//       if (child.type === "ContractDefinition") {
//         name = child.name;
//         nodes.push(...parseContract(child));
//         const contractNodes = parseContract(child);
//       } else {
//         nodes.push(parseSubNode("", child));
//       }
//     }
//   }
//   return { nodes, name };
// }

export function parseFile(file: string): {
  nodes: DefinedType[];
  name?: string;
} {
  const nodes: DefinedType[] = [];
  let name: string;
  const { children } = <SourceUnit>(
    parse(file, { tolerant: true, loc: true, range: true })
  );
  for (const child of children) {
    if (isSupportedNode(child)) {
      if (child.type === "ContractDefinition") {
        name = child.name;
        nodes.push(...parseContract(child));
      } else {
        nodes.push(parseSubNode("", child));
      }
    }
  }
  return { nodes, name };
}

export function recursiveDirectorySearch(_dirPath) {
  const files = fs
    .readdirSync(_dirPath)
    .map((name) => path.join(_dirPath, name));
  let filePaths = [];
  for (const fileName of files) {
    if (!fileName.includes(".")) {
      const subFiles = recursiveDirectorySearch(fileName);
      filePaths = filePaths.concat(subFiles);
    } else if (fileName.includes(".sol")) {
      filePaths.push(fileName);
    }
  }
  return filePaths;
}

export function parseFileOrganized(file: string): {
  nodes: OrganizedNodes;
  name?: string;
} {
  const nodes: DefinedType[] = [];

  let name: string;
  const { children } = <SourceUnit>(
    parse(file, { tolerant: true, loc: true, range: true })
  );
  for (const child of children) {
    if (isSupportedNode(child)) {
      if (child.type === "ContractDefinition") {
        name = child.name;
        nodes.push(...parseContract(child));
      } else {
        nodes.push(parseSubNode("", child));
      }
    }
  }
  return { nodes: organizeNodes(nodes), name };
}

type OrganizedNodes = {
  functions: FunctionType[];
  structs: StructType[];
  events: EventType[];
  stateVariables: StateVariableType[];
  enums: EnumType[];
  errors: ErrorType[];
};
const typeToKey = {
  FunctionDefinition: "functions",
  StructDefinition: "structs",
  EventDefinition: "events",
  StateVariableDeclaration: "stateVariables",
  EnumDefinition: "enums",
  CustomErrorDefinition: "errors",
};
const emptyOrganizedNodes = {
  functions: [],
  structs: [],
  events: [],
  stateVariables: [],
  enums: [],
  errors: [],
} as OrganizedNodes;

export const organizeNodes = (nodes: DefinedType[]): OrganizedNodes =>
  nodes.reduce(
    (obj, node) => ({
      ...obj,
      [typeToKey[node.type]]: [...(obj[typeToKey[node.type]] || []), node],
    }),
    _.cloneDeep(emptyOrganizedNodes)
  );

export const combineOrganizedNodes = (groups: OrganizedNodes[]) => {
  return groups.reduce((combined, group) => {
    Object.keys(emptyOrganizedNodes).forEach((key) => {
      combined[key].push(...group[key]);
    });
    return combined;
  }, _.cloneDeep(emptyOrganizedNodes));
};

export function parseDirectory(_dirPath: string, entryFilePath: string) {
  const filePaths = getAllSolidityFilesInDirectory(_dirPath).filter(
    (fp) => !fp.includes("TransferHelper") && !fp.includes("Conduit")
  );
  const entryPath = path.join(_dirPath, entryFilePath);
  const entryName = path.parse(entryPath).name;
  const sources: Record<string, string> = {};
  const nodesByFile: Record<string, OrganizedNodes> = {};
  for (const filePath of filePaths) {
    const data = fs.readFileSync(filePath, "utf8");
    sources[filePath] = data;
    try {
      const { nodes /* name */ } = parseFileOrganized(data);
      nodesByFile[filePath] = nodes;
    } catch (err) {
      console.log(`Caught error parsing ${filePath}`);
      throw err;
    }
  }
  const result = combineOrganizedNodes(Object.values(nodesByFile));
  // const result = nodes.reduce(
  //   (obj, node) => ({
  //     ...obj,
  //     [typeToKey[node.type]]: [...(obj[typeToKey[node.type]] || []), node],
  //   }),
  //   {
  //     functions: [],
  //     structs: [],
  //     events: [],
  //     stateVariables: [],
  //     enums: [],
  //     errors: [],
  //   } as OrganizedNodes
  // );
  return {
    ...result,
    sources,
    entryName,
    entryPath,
    nodesByFile,
  };
}
