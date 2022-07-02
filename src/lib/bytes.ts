export const toHex = (n: number) => {
  let bytes = n.toString(16);
  if (bytes.length % 2) {
    bytes = `0${bytes}`;
  }
  return `0x${bytes}`;
};

export const getOmissionMask = (bitsBefore: number, size: number) =>
  `0x${"ff".repeat(bitsBefore / 8)}${"00".repeat(size / 8)}`.padEnd(66, "f");

export const getInclusionMask = (size: number) => `0x${"ff".repeat(size / 8)}`;

export const bitsRequired = (n: number): number => {
	let a = Math.ceil(Math.log2(n + 1));
	let m = a % 8;
	return m == 0 ? a : a + 8 - m;
};