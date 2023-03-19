import { ArrayJoinInput } from "../types";

import "./String";
const { toWords } = require("number-to-words");

export const toArray = (arr: ArrayJoinInput<string>) =>
  Array.isArray(arr) ? arr : [arr];

export const joinWithLineLimit = (chunks: string[], limit: number) => {
  const arr: string[] = [];
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

export const withSpaceOrNull = (str?: string | boolean | null) =>
  str && typeof str === "string" ? ` ${str}` : "";

export function arrJoiner(arr: ArrayJoinInput) {
  if (typeof arr === "string") return arr;
  const ret: string[] = [];
  const doMap = (subArr: ArrayJoinInput<string>, depth = 0) => {
    if (
      subArr == null ||
      subArr === undefined ||
      (typeof subArr === "boolean" && !subArr)
    )
      return;
    if (Array.isArray(subArr)) for (const x of subArr) doMap(x, depth + 1);
    else if (typeof subArr === "string") {
      if (subArr.length > 0) ret.push(`${"\t".repeat(depth)}${subArr}`);
      else ret.push("");
    }
  };
  for (const x of arr) doMap(x);
  if (ret[ret.length - 1] === "" || ret[ret.length - 1] === "\n") ret.pop();
  return ret.join(`\n`);
}

type TypicalStringModification = {
  type: "set" | "prefix" | "suffix";
  text: string;
};
type CallbackStringModification = {
  type: "callback";
  cb: StringModificationCallback;
};

type StringModificationCallback = (text: string) => string;

type StringModification =
  | TypicalStringModification
  | CallbackStringModification;

export type ModificationType = StringModification["type"];

type ArrayModification = StringModification & {
  position: "first" | "last";
};

const modifyString = (original: string, modification: StringModification) => {
  if (modification.type === "callback") {
    return modification.cb(original);
  }
  const { type, text } = modification;
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
  if (modified === undefined) {
    arrOrStr.splice(index, 1);
  }
  return arrOrStr;
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

export const modifyFirstString = (
  arrOrStr: ArrayJoinInput<string>,
  cb: StringModificationCallback
) => modifyItem(arrOrStr, { position: "first", type: "callback", cb });

export const modifyLastString = (
  arrOrStr: ArrayJoinInput<string>,
  cb: StringModificationCallback
) => modifyItem(arrOrStr, { position: "last", type: "callback", cb });

export const removeTrailingNewLines = (arrOrStr: ArrayJoinInput<string>) =>
  modifyLastString(arrOrStr, (str: string) => (str === "" ? undefined : str));

export const numberToPascalCaseWords = (n: number) => {
  const words = toWords(n).split("-");
  return words
    .map((word) => word[0].toUpperCase().concat(word.slice(1)))
    .join("");
};

export const addCommaSeparators = (arr: ArrayJoinInput[]) => {
  for (let i = 0; i < arr.length - 1; i++) {
    arr[i] = suffixLastString(arr[i], ",");
  }
  return arr;
};

export const addSeparators = (arr: ArrayJoinInput[], separator: string) => {
  for (let i = 0; i < arr.length - 1; i++) {
    arr[i] = suffixLastString(arr[i], separator);
  }
  return arr;
};

export const hasSomeMembers = (arr: ArrayJoinInput) => {
  if (typeof arr === "string") return true;
  return arr.some(hasSomeMembers);
};

export const coerceArray = <T>(arr: T | T[]) =>
  Array.isArray(arr) ? arr : [arr];

export const wrap = (
  arr: ArrayJoinInput,
  l: string,
  r: string,
  // return wrap components even if array is empty
  coerce?: boolean,
  // adds wrap as new items instead of prefix/suffix
  addElements?: boolean,
  // adds wrap as new level above the current array so that the
  // existing elements become indented
  indent?: boolean
) => {
  if (coerce && !hasSomeMembers(arr)) {
    return l.concat(r);
  }
  if (addElements) {
    arr = coerceArray(arr);
    if (indent) {
      arr = [l, arr, r];
    } else {
      arr.unshift(l);
      arr.push(r);
    }
  } else {
    arr = prefixFirstString(arr, l);
    arr = suffixLastString(arr, r);
  }
  return arr;
};

export const wrapParentheses = (
  arr: ArrayJoinInput,
  coerce?: boolean,
  addElements?: boolean,
  indent?: boolean
) => wrap(arr, "(", ")", coerce, addElements, indent);
export const wrapBraces = (
  arr: ArrayJoinInput,
  coerce?: boolean,
  addElements?: boolean,
  indent?: boolean
) => wrap(arr, "{", "}", coerce, addElements, indent);
export const wrapBrackets = (
  arr: ArrayJoinInput,
  coerce?: boolean,
  addElements?: boolean,
  indent?: boolean
) => wrap(arr, "[", "]", coerce, addElements, indent);
