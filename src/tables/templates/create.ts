import { toHex } from "../../lib/bytes";
import { ArrayJoinInput } from "../../types";
import { LibraryGeneratorHelpers } from "../types";

import { toFn } from "./utils";

export function getCreateTableFunction(
  {
    typeName,
    memberType,
    type,
    elementsPerWord,
    positionRef,
  }: LibraryGeneratorHelpers,
  elements: number,
  arrayOutput: boolean,
  arrayInput = true
) {
  const numSegments = Math.ceil(elements / elementsPerWord);
  const inputName = (type === "Lookup" ? "value" : "fn").concat(
    arrayInput ? "s" : ""
  );
  const inputArg = arrayInput
    ? `${memberType}[${elements}] memory ${inputName}`
    : new Array(elements)
        .fill(null)
        .map((n, i) => `${memberType} ${inputName}${i}`);
  const outputArgs =
    arrayOutput && numSegments > 1
      ? `${typeName}[${numSegments}] memory segments`
      : new Array(numSegments).fill(null).map((_, i) => {
          if (numSegments === 1) return `${typeName} table`;
          return `${typeName} tableSegment${i}`;
        });

  const positionedElements = new Array(elements)
    .fill(null)
    .map(
      (_, i) =>
        `${positionRef}(${i}, ${
          arrayInput ? `${inputName}[${i}]` : `${inputName}${i}`
        })`
    );
  const body: ArrayJoinInput = [];
  for (let i = 0; i < elements; i += elementsPerWord) {
    const positioned = positionedElements.slice(i, i + elementsPerWord);
    const combined = positioned.join(" | ");
    const segmentIndex = Math.floor(i / elementsPerWord);
    const segment =
      numSegments === 1
        ? "table"
        : arrayOutput
        ? `segments[${segmentIndex}]`
        : `tableSegment${segmentIndex}`;
    body.push(`${segment} = to${typeName}(${combined});`);
  }
  return toFn(`create${typeName}`, body, inputArg, outputArgs);
}

export const getForgeTestCreateTable = (
  { typeName, bits }: LibraryGeneratorHelpers,
  inputs: string[]
) =>
  `function testCreateTableFrom${inputs.length}Members(${inputs.join(
    ", "
  )}) external
{
  uint${bits}[] calldata _inputArr = fakeCalldataArray(${inputs.length});
  {
    uint256[${inputs.length}] memory arr;
    assembly ('memory-safe') {
      calldatacopy(arr, 4, ${toHex(32 * inputs.length)})
    }
    validate(_inputArr, create${typeName}(arr), ${inputs.length});
  }
  validate(
    _inputArr,
    create${typeName}(${inputs.map((i) => i.replace(`uint${bits} `, ""))}),
    ${inputs.length}
  );
}
`;
