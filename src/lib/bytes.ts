const padEvenBytes = (s: string) => {
  if (s.length % 2) s = `0${s}`;
  return s;
}

export const toHex = (n: number) => {
  let bytes = n.toString(16);
  if (bytes.length % 2) {
    bytes = `0${bytes}`;
  }
  return `0x${bytes}`;
};

export const BI_ONE = BigInt(1);
export const BI_TWO = BigInt(2);
const maxUint = (bits: number) => BI_TWO ** BigInt(bits) - BI_ONE

export const getMaxUint = (bits: number) => `0x${maxUint(bits).toString(16).padStart(64, '0')}`

const getOmitMask = (offset: number, size: number) => {
  const bitsAfterStart = 256 - offset;
  const bitsAfter = bitsAfterStart - size;
  let mask = maxUint(offset) << BigInt(bitsAfterStart) 
  mask |= maxUint(bitsAfter)
  return mask;
}

export const getGroupOmissionMask = (fields: {type: { size?: number }, offset: number}[]) =>
  '0x'.concat(
    fields
    .map(field => getOmitMask(field.offset, field.type.size))
    .reduce((prev, next) => prev & next, maxUint(256))
    .toString(16).padStart(64, '0')
  );

export const getOmissionMask = (bitsBefore: number, size: number) => {
  return `0x${getOmitMask(bitsBefore, size).toString(16).padStart(64, '0')}`
}

export const getInclusionMask = (bits: number) => `0x${maxUint(bits).toString(16)}`

export const bitsRequired = (n: number, roundUp?: boolean): number => {
	let a = Math.ceil(Math.log2(n + 1));
  return (roundUp && a % 8) ? a + (8 - (a % 8)) : a
	// let m = a % 8;
	// return m == 0 ? a : a + 8 - m;
};