// const strip = require('strip-comments');
import { AbiStruct, AbiEnum, ArrayJoinInput } from '../types';
import './str';
import { arrJoiner } from '../lib/text';
import { toTypeName, abiStructToSol, processFields, separateGroups } from './fields';
import {
	getDecodeFunction,
	getEncodeFunction,
	getReadFieldFunction,
	getWriteFieldFunction,
	getEncodeGroupFunction,
	getDecodeGroupFunction,
} from './functions';
import { toCommentSeparator, generateNotice } from './comments';
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
    context.addSection(
      `${field.structName}.${field.originalName} coders`,
      [
        '',
        getReadFieldFunction(field),
        '',
        getWriteFieldFunction(field, context)
      ]
    )
	}

	const groupedFields = separateGroups(fields);

	for (const group of groupedFields) {
    context.addSection(
      `${group[0].structName} ${group[0].group} Group`,
      [
        '',
        getEncodeGroupFunction(group, context),
        '',
        getDecodeGroupFunction(group)
      ]
    )
	}

	const decodeFunctionBlock = getDecodeFunction(fields);
	const encodeFunctionBlock = getEncodeFunction(fields, context);

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
	static createLibrary(structsAndEnums: Array<AbiStruct | AbiEnum>, opts: GeneratorOptions): {string} {
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
    const code = arrJoiner([
      '// SPDX-License-Identifier: MIT',
      `pragma solidity >=0.8.0;`,
      '',
      ...generateNotice(opts.unsafe),
      '',
      ...libraryCode,
    ])
		return prettierFormat(
			opts.noComments ? strip(code) : code
		);
	}
}
