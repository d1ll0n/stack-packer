import _, { last } from "lodash";
import {
  combineSequentialCopies,
  maxIntermediateBytes,
  PendingCopy,
} from "./utils";

let i = 0;

const expectSeq = (oldArr: PendingCopy[], expectedArr?: PendingCopy[]) => {
  if (!expectedArr) {
    expectedArr = _.cloneDeep(oldArr);
  }
  const actualArray = combineSequentialCopies(oldArr);
  const tI = i++;
  if (actualArray.length !== expectedArr.length) {
    throw Error(
      `Test ${tI} Unexpected output size: size ${actualArray.length} vs ${expectedArr.length}`
    );
  }
  for (let i = 0; i < expectedArr.length; i++) {
    const expectedItem = expectedArr[i];
    const actualItem = actualArray[i];
    Object.keys(expectedItem).forEach((key) => {
      if (expectedItem[key] !== actualItem[key]) {
        throw Error(
          `Test ${tI} arr[${i}]${key} does not match expected: ${expectedItem[key]} vs ${actualItem[key]}`
        );
      }
    });
  }
  console.log(`Test ${tI} passed`);
};

const ct = (src = 0, dst = 0, size = 32) => ({
  src,
  dst,
  size,
});
const add = (arr: PendingCopy[], src = 0, dst = 0, size = 0) => {
  const prev = last(arr);
  return [
    ...arr,
    {
      src: prev.src + src,
      dst: prev.dst + dst,
      size: prev.size + size,
    },
  ];
};

const ctSequential = (
  dst: number,
  src: number,
  count: number,
  size: number
) => {
  const arr: PendingCopy[] = [];
  for (let i = 0; i < count; i++) {
    arr.push(ct(dst + size * i, src + size * i, size));
  }
  return arr;
};

const TestArrays = {
  get BaseItem() {
    return [ct(0, 0, 32)];
  },
  get NoSeqSorted() {
    return add(TestArrays.BaseItem, 64, 32);
  },
  get NoSeqUnsorted() {
    return TestArrays.NoSeqSorted.reverse();
  },
  get SkipOneIn() {
    return [ct(64, 32, 32), ct(96, 64, 32)];
  },
  get SkipOneOut() {
    return [ct(64, 32, 64)];
  },
  get MultipleIn() {
    return ctSequential(0, 0, 10, 32);
  },
  get MultipleOut() {
    return [ct(0, 0, 320)];
  },
  get SkipMaxIn() {
    return add(
      TestArrays.BaseItem,
      maxIntermediateBytes,
      maxIntermediateBytes,
      64
    );
  },
  get SkipMaxOut() {
    return [ct(0, 0, maxIntermediateBytes + 96)];
  },
  get SkipTooMany() {
    return add(
      TestArrays.BaseItem,
      maxIntermediateBytes + 64,
      maxIntermediateBytes + 64,
      64
    );
  },
};

expectSeq(TestArrays.NoSeqSorted);
expectSeq(TestArrays.NoSeqUnsorted, TestArrays.NoSeqSorted);
expectSeq(TestArrays.SkipOneIn, TestArrays.SkipOneOut);
expectSeq(TestArrays.MultipleIn, TestArrays.MultipleOut);
expectSeq(TestArrays.SkipMaxIn, TestArrays.SkipMaxOut);
expectSeq(TestArrays.SkipTooMany);
