// const strip = require('strip-comments');
import { AbiStruct, AbiEnum } from '../types';
import { arrJoiner } from '../lib/text';
import { toTypeName, abiStructToSol, processFields, resolveGroupMembers } from './fields';
import {
	getDecodeFunction,
	getEncodeFunction,
	getEncodeGroupFunction,
	getDecodeGroupFunction,
  generateFieldAccessors,
} from './functions';
import { generateNotice } from './comments';
import { GeneratorOptions, FileContext } from './context';
import { prettierFormat } from './prettier';

// Function to strip comments in a string
// Code created with the help of Stack Overflow answer by AymKdn
// https://stackoverflow.com/a/59094308
function strip(str: string) {
  return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g,'').trim();
}

export function generateCoderLibrary(struct: AbiStruct, opts: GeneratorOptions) {
	console.log('ENTERING UNPACKER');
	if (struct.dynamic) {
		throw Error('Does not support dynamic structs');
	}

	const context = new FileContext(opts);
	const fields = processFields(struct, context);

	for (const field of fields) {
    generateFieldAccessors(field, context)
	}

  for (const group of struct.groups) {
    const groupFields = resolveGroupMembers(struct, group, fields);
    context.addSection(
      `${struct.name} ${group.name} Group`,
      [
        '',
        getEncodeGroupFunction(group, groupFields, context),
        '',
        getDecodeGroupFunction(group, groupFields)
      ]
    )
  }

	const decodeFunctionBlock = getDecodeFunction(struct, fields);
	const encodeFunctionBlock = getEncodeFunction(struct, fields, context);

	const typeDef = [
		`// struct ${struct.name} {`,
		...fields.map((field) => `//   ${toTypeName(field.type)} ${field.originalName};`),
		'// }',
		`type ${struct.name} is uint256;`,
	];
	context.constants.sort();

	const topLevel = [
		'',
		...typeDef,
		'',
		...context.constants,
		'',
		`library ${struct.name}Coder {`,
		decodeFunctionBlock,
		'',
		encodeFunctionBlock,
		'',
		...context.code,
		`}`,
	];

	return arrJoiner(topLevel);
}

export class UnpackerGen {
	static createLibrary(structsAndEnums: Array<AbiStruct | AbiEnum>, opts: GeneratorOptions): {
    code: string;
    libraryName?: string;
  } {
		const libraryCode: string[] = [];
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
				libraryCode.push(
          generateCoderLibrary(structOrEnum, opts),
          ''
        );
			}
		}
		if (libraryCode.length && libraryCode[libraryCode.length - 1] === '') {
			libraryCode.pop();
		}
    let code = arrJoiner([
      '// SPDX-License-Identifier: MIT',
      `pragma solidity >=0.8.0;`,
      '',
      ...generateNotice(opts.unsafe),
      '',
      ...libraryCode,
    ])
		code = prettierFormat(
			opts.noComments ? strip(code) : code
		);
    const structs = structsAndEnums.filter(f => f.meta === 'struct');
    const libraryName = structs.length === 1 && `${structs[0].name}Coder`;
    return {
      code,
      libraryName
    }
	}
}
