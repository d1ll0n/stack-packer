import { toArray } from "../lib/text";
import { ArrayJoinInput } from "../types";
import { ProcessedField } from "./fields";

export const buildAssemblyBlock = (lines: ArrayJoinInput<string>) => [
  `assembly {`,
  lines,
  `}`,
];

export const buildFunctionBlock = (
  name: string,
  input: string[] | string,
  output: string[] | string,
  lines: ArrayJoinInput<string>
) => {
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
  const withInputs = arrayifyFields(
    `function ${name}(`,
    input,
    `) internal pure returns (`
  );
  const withOutputs = arrayifyFields(
    withInputs[withInputs.length - 1] as string,
    output,
    `) {`
  );
  const allButLastInput = withInputs.slice(0, withInputs.length - 1);
  return [...allButLastInput, ...withOutputs, lines, "}"];
};

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