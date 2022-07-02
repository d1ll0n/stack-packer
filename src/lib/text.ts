import { ArrayJoinInput } from "../types";
import "./String"
const { toWords } = require("number-to-words");

export const toArray = (arr: ArrayJoinInput<string>) => Array.isArray(arr) ? arr : [arr];

export const joinWithLineLimit = (chunks: string[], limit: number) => {
  let arr: string[] = [];
  let currentLine = chunks[0];
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (currentLine.length + chunk.length <= limit) {
      currentLine = currentLine.concat(" ", chunk);
    } else {
      arr.push(currentLine);
      currentLine = chunk;
    }
  }
  if (currentLine) {
    arr.push(currentLine);
  }
  return arr;
};

export function arrJoiner(arr: ArrayJoinInput) {
  const ret: string[] = [];
  const doMap = (subArr: ArrayJoinInput<string>, depth = 0) => {
    if (subArr == null || subArr == undefined) return;
    if (Array.isArray(subArr)) for (let x of subArr) doMap(x, depth + 1);
    else if (typeof subArr == "string") {
      if (subArr.length > 0) ret.push(`${"\t".repeat(depth)}${subArr}`);
      else ret.push("");
    }
  };
  for (let x of arr) doMap(x);
  if (ret[ret.length - 1] == "" || ret[ret.length - 1] == "\n") ret.pop();
  return ret.join(`\n`);
}

type ModificationType = "set" | "prefix" | "suffix";
type StringModification = {
  type: ModificationType;
  text: string;
};

type ArrayModification = StringModification & {
  position: "first" | "last";
};

const modifyString = (original: string, { type, text }: StringModification) => {
  if (type === "set") return text;
  if (type === "prefix") return text.concat(original);
  // suffix
  return original.concat(text);
};

const modifyItem = (
  arrOrStr: ArrayJoinInput<string>,
  modification: ArrayModification
) => {
  const { position, ...stringModification } = modification;
  if (typeof arrOrStr === "string") {
    return modifyString(arrOrStr, stringModification);
  }
  const index = position === "first" ? 0 : arrOrStr.length - 1;
  const lastItem = arrOrStr[index];
  const modified = modifyItem(lastItem, modification);
  // If item is a string, update the array
  if (typeof modified === "string") {
    arrOrStr[index] = modified;
  }
  return arrOrStr
};

export const setFirstString = (
  arrOrStr: ArrayJoinInput<string>,
  text: string
) => modifyItem(arrOrStr, { position: "first", type: "set", text });

export const prefixFirstString = (
  arrOrStr: ArrayJoinInput<string>,
  text: string
) => modifyItem(arrOrStr, { position: "first", type: "prefix", text });

export const suffixFirstString = (
  arrOrStr: ArrayJoinInput<string>,
  text: string
) => modifyItem(arrOrStr, { position: "first", type: "suffix", text });

export const setLastString = (arrOrStr: ArrayJoinInput<string>, text: string) =>
  modifyItem(arrOrStr, { position: "last", type: "set", text });

export const prefixLastString = (
  arrOrStr: ArrayJoinInput<string>,
  text: string
) => modifyItem(arrOrStr, { position: "last", type: "prefix", text });

export const suffixLastString = (
  arrOrStr: ArrayJoinInput<string>,
  text: string
) => modifyItem(arrOrStr, { position: "last", type: "suffix", text });

export const numberToPascalCaseWords = (n: number) => {
  const words = toWords(n).split("-");
  return words
    .map((word) => word[0].toUpperCase().concat(word.slice(1)))
    .join("");
};