import { getMaxUint } from "./bytes";

const findSmallestModulusWithDifferentRemainderForStrings = (
  selectors: number[],
  maxModulus: number
) => {
  for (let i = 3; i < maxModulus; i++) {
    const remainders = selectors.map((selector) => selector % i);
    if (new Set(remainders).size === selectors.length) {
      return i;
    }
  }
};

export type SelectorMagicModulus = {
  startIndex: number;
  bits: number;
  modulus?: number;
};

export type MagicModulusOptions = {
  noSlicing?: boolean; // Disable taking a sub-set of a selector
  maxModulus?: number; // Maximum modulus
};

export function findMagicModulus(
  selectorStrings: string[],
  options: MagicModulusOptions
): SelectorMagicModulus | undefined {
  const selectors = selectorStrings.map((s) => parseInt(s, 16));
  const maxModulus = options.maxModulus || 0xffff;
  const modulus = findSmallestModulusWithDifferentRemainderForStrings(
    selectors,
    maxModulus
  );
  if (!modulus) return undefined;
  const basicAttempt = { startIndex: 0, bits: 32, modulus };
  if (options.noSlicing) {
    return basicAttempt;
  }
  const minBits = Math.ceil(Math.log2(selectors.length));

  const sliceAttempts = [];
  for (let bits = minBits; bits <= 32; bits++) {
    for (let startIndex = 0; startIndex + bits <= 32; startIndex += 8) {
      const slices = selectors.map((s) =>
        getBitsBetween(s, startIndex, bits)
      );
      // Check strings are all unique
      if (new Set(slices).size !== slices.length) continue;
      const modulus = findSmallestModulusWithDifferentRemainderForStrings(
        slices,
        maxModulus
      );
      sliceAttempts.push({ startIndex: startIndex / 8, bits, modulus });
    }
  }

  sliceAttempts.sort((a, b) => a.modulus - b.modulus);
  const bestAttempt = sliceAttempts[0];
  const minWordsWithSlice = Math.ceil(bestAttempt.modulus / 32);
  const minWordsWithoutSlice = Math.ceil(basicAttempt.modulus / 32);
  if (minWordsWithSlice < minWordsWithoutSlice) return bestAttempt;
  return basicAttempt;
}

export const getBitsBetween = (n: number, startIndex: number, bits: number) =>
  +(
    (BigInt(n) >> BigInt(32 - (startIndex + bits))) &
    BigInt(getMaxUint(bits))
  ).toString(10);
