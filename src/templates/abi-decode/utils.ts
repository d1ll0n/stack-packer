import _, { findIndex, last } from "lodash";
import { AbiType } from "../../types";
import {
  expressionGt,
  mathNodeToYul,
  simplifyYulExpression,
  yulToMathNode,
  yulToStringExpression,
} from "../../ast-rewriter/yul/mathjs";
import { getInclusiveRangeWith } from "../../lib/array";
import { isReferenceType, isValueType } from "../../type-utils";
import { makeYulLiteral, YulExpression } from "../../ast-rewriter/yul";
import { simplify } from "mathjs";

export const getSequentialFromFixedMembers = (types: AbiType[]) => {
  const firstValueIndex = findIndex(types, isValueType);
  const segments: AbiType[][] = [];
  let currentSegment: AbiType[] = [];
  let numDynamic = 0;
  const endSegment = () => {
    if (currentSegment.length) {
      const filtered = getInclusiveRangeWith(currentSegment, isValueType);
      for (let i = 1; i < filtered.length; i++) {
        const { calldataHeadOffset: cdHead, memoryHeadOffset: mHead } =
          filtered[i];
        const { calldataHeadOffset: cdHeadLast, memoryHeadOffset: mHeadLast } =
          filtered[i - 1];
        if (cdHeadLast + 32 !== cdHead) {
          throw Error(
            `Got non-sequential calldata heads: [${
              i - 1
            }] = ${cdHeadLast}, [${i}] = ${cdHead}`
          );
        }
        if (mHeadLast + 32 !== mHead) {
          throw Error(
            `Got non-sequential memory heads: [${
              i - 1
            }] = ${mHeadLast}, [${i}] = ${mHead}`
          );
        }
      }
      segments.push(filtered);
      currentSegment = [];
    }
    numDynamic = 0;
  };
  for (let i = firstValueIndex; i < types.length; i++) {
    const type = types[i];
    if (
      type.calldataHeadSize !== 32 ||
      (isReferenceType(type) && ++numDynamic > 4)
    ) {
      endSegment();
      continue;
    }
    if (isValueType(type)) {
      numDynamic = 0;
    }
    currentSegment.push(type);
    if (i === types.length - 1) {
      endSegment();
    }
  }
  return segments;
};

const dstEnd = ({ dst, size }: PendingCopy) => dst + size;
const srcEnd = ({ src, size }: PendingCopy) => src + size;

const distance = (copy1: PendingCopy, copy2: PendingCopy) => {
  const srcDist = copy2.src - srcEnd(copy1);
  const dstDist = copy2.dst - dstEnd(copy1);
  if (srcDist !== dstDist) return undefined;
  return srcDist;
};

export type PendingPointer = {
  dst: number;
  value: number;
  name?: string;
};

// export type PendingPointerAST = {
//   dst: CastableToYulExpression;
// }

export type PendingCopy = {
  dst: number;
  src: number;
  size: number;
  names?: string[];
  // src
};

export type PendingDynamicPointer = {
  dst: YulExpression;
  value: YulExpression;
  name?: string;
};

export type PendingDynamicCopy = {
  dst: YulExpression;
  src: YulExpression;
  size: YulExpression;
  names?: string[];
};

export const maxIntermediateBytes = 4 * 32;
export function combineSequentialCopies(_copies: PendingCopy[]) {
  const copies = _.cloneDeep(_copies).sort((a, b) => a.dst - b.dst);
  const newCopies: PendingCopy[] = [copies[0]];

  for (let i = 1; i < copies.length; i++) {
    const prev = last(newCopies);
    const next = copies[i];
    const dist = distance(prev, next);
    if (dist === undefined || dist > maxIntermediateBytes) {
      newCopies.push(next);
    } else {
      prev.size += dist + next.size;
      if (next.names) {
        prev.names = prev.names || [];
        prev.names.push(...next.names);
      }
    }
  }
  return newCopies;
}

const printableCopy = (copy: PendingDynamicCopy) => ({
  dst: yulToStringExpression(copy.dst),
  src: yulToStringExpression(copy.src),
  size: yulToStringExpression(copy.size),
  names: copy.names,
});

const dynamicDistance = (
  copy1: PendingDynamicCopy,
  copy2: PendingDynamicCopy
) => {
  const srcDist = simplify(
    yulToMathNode(copy2.src.sub(copy1.src.add(copy1.size)))
  );

  const dstDist = simplify(
    yulToMathNode(copy2.dst.sub(copy1.dst.add(copy1.size)))
  );

  if (!srcDist.equals(dstDist)) {
    return undefined;
  }
  try {
    return mathNodeToYul(srcDist);
  } catch (err) {
    console.log("==".repeat(12));
    console.log(printableCopy(copy1));
    console.log(printableCopy(copy2));
    console.log("==".repeat(12));
    throw err;
  }
};

export const maxIntermediateBytesLiteral = makeYulLiteral(4 * 32);
export function combineSequentialDynamicCopies(_copies: PendingDynamicCopy[]) {
  const copies = [..._copies].sort((a, b) => expressionGt(a.dst, b.dst));
  const newCopies: PendingDynamicCopy[] = [copies[0]];

  for (let i = 1; i < copies.length; i++) {
    const prev = last(newCopies);
    const next = copies[i];
    const dist = dynamicDistance(prev, next);
    const mightExceedSizeLimit =
      dist !== undefined &&
      expressionGt(dist, maxIntermediateBytesLiteral) !== -1;
    if (dist === undefined || mightExceedSizeLimit) {
      newCopies.push(next);
    } else {
      prev.size = simplifyYulExpression(prev.size.add(dist).add(next.size));
      // += dist + next.size;
      if (next.names) {
        prev.names = prev.names || [];
        prev.names.push(...next.names);
      }
    }
  }
  return newCopies;
}

// export const convertCopies()
