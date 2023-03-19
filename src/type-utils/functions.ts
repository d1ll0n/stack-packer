import keccak256 from "keccak256";

import { AbiFunction } from "../types";

import { toTypeStringForSignature } from "./names";

export const getSignature = (fn: AbiFunction) =>
  `${fn.name}(${fn.input.fields
    .map((f) => toTypeStringForSignature(f.type))
    .join(",")})`;

export const getSelector = (fn: AbiFunction) => {
  const sig = getSignature(fn);
  console.log(sig);
  return `0x${keccak256(sig).subarray(0, 4).toString("hex")}`;
};
