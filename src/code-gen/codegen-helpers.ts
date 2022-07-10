import { suffixLastString, toArray } from "../lib/text";
import { ArrayJoinInput, CodeGenFunction, ProcessedField } from "../types";
import { toNatspec } from "./comments";

const arrayifyFields = (
  beforeStr: string,
  arr: string[] | string,
  afterStr: string
) => {
  if (Array.isArray(arr) && arr.length === 1) {
    arr = arr[0];
  }
  if (Array.isArray(arr)) {
    const withCommas = arr.map(
      (o, i) => `${o}${i === arr.length - 1 ? "" : ","}`
    );
    return [beforeStr, withCommas, afterStr];
  }
  return [[beforeStr, arr, afterStr].join("")];
};

export const buildAssemblyBlock = (lines: ArrayJoinInput<string>) => [
  `assembly {`,
  lines,
  `}`,
];

export const generateInternalLibraryCall = (fn: CodeGenFunction, libraryName: string) => {
  const outputs = arrayifyFields(
    `(`,
    fn.outputs.map(f => f.name),
    `) = ${libraryName}.${fn.name}(`
  );
  const fnCall = arrayifyFields(
    outputs[outputs.length - 1] as string,
    fn.inputs.map(f => f.name),
    `);`
  )

  const code: ArrayJoinInput<string>[] = [
    ...outputs.slice(0, outputs.length - 1),
    ...fnCall
  ];

  return code;
}

export const generateFunctionCode = (fn: CodeGenFunction): ArrayJoinInput<string>[] => {
  const inputs = arrayifyFields(
    `function ${fn.name}(`,
    fn.inputs.map(f => f.definition),
    `) ${fn.location}${fn.visibility ? ` ${fn.visibility}` : ''}`
  );
  const code: ArrayJoinInput<string>[] = [
    ...(fn.natspecLines ? toNatspec(fn.natspecLines) : []),
    ...inputs.slice(0, inputs.length - 1)
  ];

  if (fn.outputs.length) {
    suffixLastString(inputs, ' returns (');
    code.push(...arrayifyFields(
      inputs[inputs.length - 1] as string,
      fn.outputs.map(f => f.definition),
      `) {`
    ));
  } else {
    suffixLastString(inputs, ' {')
    code.push(...arrayifyFields(
      inputs[inputs.length - 1] as string,
      '',
      ``
    ))
  }
  code.push(fn.body, '}');
  return code;
}

export const buildFunctionBlock = (
  name: string,
  input: string[] | string,
  output: string[] | string,
  lines: ArrayJoinInput<string>
) => {
  const withInputs = arrayifyFields(
    `function ${name}(`,
    input,
    `) internal pure`
  );
  let outputs: ArrayJoinInput<string>[] = []
  if (output.length) {
    suffixLastString(withInputs, ' returns (');
    outputs = arrayifyFields(
      withInputs[withInputs.length - 1] as string,
      output,
      `) {`
    );
  } else {
    suffixLastString(withInputs, ' {')
    outputs = arrayifyFields(
      withInputs[withInputs.length - 1] as string,
      '',
      ``
    );
  }
  const allButLastInput = withInputs.slice(0, withInputs.length - 1);
  return [...allButLastInput, ...outputs, lines, "}"];
};

export function buildImportStatement(file: string, imports: string[]) {
  if (imports.length == 0) return [`import "./${file}";`];
  return [
    'import {',
    [
      ...imports.slice(0, imports.length - 1).map(_import => `${_import},`),
      imports[imports.length-1],
    ],
    `} from "./${file}";`
  ]
}

export function buildNestedAssemblyOr(
  fields: { positioned: ProcessedField["positioned"] }[]
): ArrayJoinInput<string> {
  const positionedFields: string[] = fields.map((f) => f.positioned);
  const lastIndex = positionedFields.length - 1;
  const getChunk = (index: number) => {
    if (index < lastIndex) {
      const nextChunk = getChunk(index + 1);
      return [
        "or(",
        [
          `${positionedFields[index]},`,
          ...(Array.isArray(nextChunk) ? nextChunk : [nextChunk]),
        ],
        `)`,
      ];
    }
    return positionedFields[index];
  };
  return toArray(getChunk(0));
}