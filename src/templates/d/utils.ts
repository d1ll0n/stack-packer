import _, { findIndex, last } from "lodash";
import { AbiType } from "../../types";
import { getInclusiveRangeWith } from "../../lib/array";
import { isReferenceType, isValueType } from "../../type-utils";
import { makeYulLiteral } from "../../ast-rewriter/yul/utils";
import {
  mathNodeToYul,
  simplifyYulExpression,
  yulToMathNode,
  yulToStringExpression,
} from "../../ast-rewriter/yul/mathjs";
import { parse, simplify } from "mathjs";
import { YulExpression } from "../../ast-rewriter/yul/ast";

export function getDiff(a: YulExpression, b: YulExpression) {
  return `${yulToStringExpression(a)} - ${yulToStringExpression(b)}`;
}

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

const printableCopy = (copy: PendingDynamicCopy) => ({
  dst: yulToStringExpression(copy.dst),
  src: yulToStringExpression(copy.src),
  size: yulToStringExpression(copy.size),
  names: copy.names,
});

const distance = (copy1: PendingDynamicCopy, copy2: PendingDynamicCopy) => {
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

function expressionGt(a: YulExpression, b: YulExpression) {
  const gtNode = simplify(yulToMathNode(a.sub(b).gt(0)));
  if (gtNode.type === "ConstantNode") {
    return gtNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

export const maxIntermediateBytes = makeYulLiteral(4 * 32);

export function combineSequentialCopies(_copies: PendingDynamicCopy[]) {
  const copies = _.cloneDeep(_copies).sort((a, b) =>
    expressionGt(a.dst, b.dst)
  );
  const newCopies: PendingDynamicCopy[] = [copies[0]];

  for (let i = 1; i < copies.length; i++) {
    const prev = last(newCopies);
    const next = copies[i];
    const dist = distance(prev, next);
    const mightExceedSizeLimit =
      dist !== undefined && expressionGt(dist, maxIntermediateBytes) !== -1;
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
