import _, { last } from "lodash";
// import { BuiltinFunctionIds } from "./builtin";
import {
  // expressionEq,
  // expressionLt,
  mathNodeToYul,
  simplifyYulExpression,
  yulToMathNode,
  yulToStringExpression,
} from "./mathjs";
// import { Factory } from "../Factory";
import { /* makeYulIdentifier, */ makeYulLiteral } from "./utils";
import { parse, simplify } from "mathjs";
import { YulExpression /* YulFunctionCall */ } from "./ast";

export function getDiff(a: YulExpression, b: YulExpression) {
  return `${yulToStringExpression(a)} - ${yulToStringExpression(b)}`;
}

type CopyExpression = {
  dst: YulExpression;
  src: YulExpression;
  size: YulExpression;
  names?: string[];
};

// const dstEnd = ({ dst, size }: Copy) =>
//   parse(yulToStringExpression(dst.add(size)));
// const srcEnd = ({ src, size }: Copy) =>
//   parse(yulToStringExpression(src.add(size)));

const distance = (copy1: CopyExpression, copy2: CopyExpression) => {
  const srcDist = simplify(
    yulToMathNode(copy2.src.sub(copy1.src.add(copy1.size)))
  );

  const dstDist = simplify(
    yulToMathNode(copy2.dst.sub(copy1.dst.add(copy1.size)))
  );

  if (!srcDist.equals(dstDist)) {
    return undefined;
  }
  return mathNodeToYul(srcDist);
};

function expressionGt(a: YulExpression, b: YulExpression) {
  const gtNode = simplify(yulToMathNode(a.sub(b).gt(0)));
  if (gtNode.type === "ConstantNode") {
    return gtNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

// const toCopyExpression = (copy: CopyExpression) =>
//   new YulFunctionCall(BuiltinFunctionIds.calldatacopy, [
//     copy.dst,
//     copy.src,
//     copy.size,
//   ]);

export const maxIntermediateBytes = makeYulLiteral(4 * 32);
export function combineSequentialCopies(_copies: CopyExpression[]) {
  const copies = _.cloneDeep(_copies).sort((a, b) =>
    expressionGt(a.dst, b.dst)
  );
  const newCopies: CopyExpression[] = [copies[0]];

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

// const factory = new Factory();
// const yulConst = (name: string, value: string | number) =>
//   factory.yul.identifierFor(factory.makeConstantUint256(name, value, 0));

// const b1Src = makeYulIdentifier("parentCdPtr").add(
//   makeYulIdentifier("cdHeadSize")
// );
// const b1Dst = makeYulIdentifier("parentMPtr").add(
//   makeYulIdentifier("mHeadSize")
// );
// const b1Length = yulConst("b1Length", 32);

// const b2Dst = makeYulIdentifier("parentMPtr")
//   .add(makeYulIdentifier("mHeadSize"))
//   .add(b1Length)
//   .add(maxIntermediateBytes);

// const b2Src = makeYulIdentifier("parentCdPtr")
//   .add(makeYulIdentifier("cdHeadSize"))
//   .add(b1Length)
//   .add(maxIntermediateBytes);

// const b2Length = yulConst("b2Length", 64);
// const copy1 = {
//   dst: b1Dst,
//   src: b1Src,
//   size: b1Length,
// };
// const copy2 = {
//   dst: b2Dst,
//   src: b2Src,
//   size: b2Length,
// };

export function expressionLt2(a: YulExpression, b: YulExpression) {
  const ltNode = simplify(yulToMathNode(a.sub(b).eq(0)));
  if (ltNode.type === "ConstantNode") {
    return ltNode.equals(parse("1")) ? 1 : -1;
  }
  return 0;
}

// console.log(expressionLt(b2Src, b1Src));
// console.log(expressionEq(b2Src, b1Src));
// console.log(expressionEq(b2Src, b2Src.add(0)));
// console.log(expressionLt2(b2Src, b1Src));

// export function compareCopies()

// factory.yul.identifierFor(constantA);
//
// distance(copy1, copy2);
// console.log(expressionGt(copy2.dst, copy1.dst));

// combineSequentialCopies([copy1, copy2]).forEach((copy) => {
//   console.log(yulToStringExpression(toCopyExpression(copy)));
// });

// console.log(
//   simplify(getDiff(b2Dst, b1Dst)).equals(simplify(getDiff(b2Src, b1Src)))
// );
