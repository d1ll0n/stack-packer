// const strip = require('strip-comments');
import { AbiStruct, AbiEnum, ProcessedField, ProcessedStruct } from '../types';
import { arrJoiner } from '../lib/text';
import { toTypeName, abiStructToSol, processFields, resolveGroupMembers, processStruct } from './fields';
import {
	getDecodeFunction,
	getEncodeFunction,
	getEncodeGroupFunction,
	getDecodeGroupFunction,
  generateFieldAccessors,
  generateComparisonFunctions,
} from './functions';
import { generateNotice } from './comments';
import { GeneratorOptions, FileContext, generateFileHeader } from './context';
import { prettierFormat } from './prettier';
import { generateExternalCoder, generateHardhatTest } from './test';
import path from 'path';
import { getDir, isSolFile } from '../project';

// Function to strip comments in a string
// Code created with the help of Stack Overflow answer by AymKdn
// https://stackoverflow.com/a/59094308
function strip(str: string) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g,'').trim();
}

export function generateCoderLibrary(struct: ProcessedStruct, context: FileContext) {
	if (struct.dynamic) {
		throw Error('Does not support dynamic structs');
	}

  const { fields, groups } = struct

  context.addFunctions([
    getDecodeFunction(struct, fields),
    getEncodeFunction(struct, fields, context),
  ].filter(Boolean), struct.name)

  for (const group of groups) {
    const functions = [
      getEncodeGroupFunction(struct, group, context),
      getDecodeGroupFunction(struct, group)
    ].filter(Boolean)
    context.addFunctions(functions, `${struct.name} ${group.name} coders`)
  }

	for (const field of fields) {
    context.addFunctions(generateFieldAccessors(struct, field, context),  `${field.structName}.${field.originalName} coders`)
	}

  context.addFunctions(generateComparisonFunctions(struct), `${struct.name} comparison methods`)

	const typeDef = [
		`// struct ${struct.name} {`,
		...fields.map((field) => `//   ${toTypeName(field.type)} ${field.originalName};`),
		'// }',
		`type ${struct.name} is uint256;`,
    '',
    `${struct.name} constant Default${struct.name} = ${struct.name}.wrap(0);`
	];
	context.constants.sort();

	const topLevel = [
		...typeDef,
		'',
		`library ${struct.name}Coder {`,
		// decodeFunctionBlock,
		// '',
		// encodeFunctionBlock,
		// '',
		...context.code,
		`}`,
	];

	return arrJoiner(topLevel);
}

function generateSolFile(codeLines: string[], context: FileContext, imports: string[]) {
  let code = arrJoiner([
    ...generateFileHeader(true, context.opts.unsafe, imports),
    ...codeLines,
  ])
  code = prettierFormat(
    context.opts.noComments ? strip(code) : code
  );
  return code;
}

export class UnpackerGen {
	static createLibrary(structsAndEnums: Array<AbiStruct | AbiEnum>, context: FileContext): {
    code: string;
    libraryName?: string;
    externalCode: string;
    hardhatTest: string
  } {
		const libraryCode: string[] = [];
    const externalCode: string[] = [];
    const hardhatTests: string[] = [];
    let processedStruct: ProcessedStruct;
    
		for (let structOrEnum of structsAndEnums) {
			if (structOrEnum.dynamic) {
				throw Error('Dynamic sized structs not currently supported');
			}
			if (structOrEnum.meta === 'enum') {
				libraryCode.push(
          arrJoiner(abiStructToSol(structOrEnum)),
          ''
        );
			} else {
        processedStruct = processStruct(structOrEnum, context)
        const code = generateCoderLibrary(processedStruct, context)
        if (!context.opts.constantsFile) {
          libraryCode.push(arrJoiner(context.constants))
        }
        libraryCode.push(code, '');
        const externalFns = generateExternalCoder(
          context.functions,
          structOrEnum.name,
          `_${structOrEnum.name.toCamelCase()}`,
          `${structOrEnum.name}Coder`
        );
        externalCode.push(arrJoiner(externalFns.externalCode))
        hardhatTests.push(generateHardhatTest(processedStruct, externalFns.externalFunctions, structOrEnum.name))
        context.clearCode();
			}
		}
		if (libraryCode.length && libraryCode[libraryCode.length - 1] === '') {
			libraryCode.pop();
		}
    // let code = arrJoiner([
    //   ...generateFileHeader(true, context.opts.unsafe, context.opts.constantsFile && ['import "./CoderConstants.sol";']),
    //   ...libraryCode,
    // ])
		// code = prettierFormat(
		// 	context.opts.noComments ? strip(code) : code
		// );
    // const testCode = arrJoiner(generateExternalCoder(context.functions, ))
    const structs = structsAndEnums.filter(f => f.meta === 'struct');
    const libraryName = structs.length === 1 && `${structs[0].name}Coder`;
    const code = generateSolFile(libraryCode, context, context.opts.constantsFile && ['import "./CoderConstants.sol";']);
    const coderPath = isSolFile(context.opts.output) ? context.opts.output : path.join(context.opts.output, `${libraryName}.sol`);
    const testPath = context.opts.testContractsDirectory || getDir(coderPath);

    const relativePath = path.normalize(path.relative(testPath, coderPath))
    const externalFile = generateSolFile(externalCode, context, [`import "${relativePath}";`]);
    return {
      code,
      externalCode: externalFile,
      libraryName,
      hardhatTest: arrJoiner(hardhatTests)
    }
	}
}
