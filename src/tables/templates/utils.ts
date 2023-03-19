import { toNatspec } from "../../code-gen/comments";
import { coerceArray, withSpaceOrNull, wrap } from "../../lib/text";
import { ArrayJoinInput } from "../../types";

export const combineArgs = (args?: ArrayJoinInput) =>
  coerceArray(args || []).join(", ");

export const toFn = (
  name: string,
  body: ArrayJoinInput,
  inputs?: ArrayJoinInput,
  outputs?: ArrayJoinInput,
  comments?: string[],
  pure = true,
  visibility = ""
) => {
  const inputArgs = combineArgs(inputs);
  let outputArgs = combineArgs(outputs);
  if (outputArgs) {
    outputArgs = coerceArray(wrap(combineArgs(outputs), "returns(", ")")).join(
      ""
    );
  }

  const modifiers = [visibility, pure ? "pure" : "", outputArgs]
    .map(withSpaceOrNull)
    .join("");

  const code = wrap(
    body,
    `function ${name}(${inputArgs})${modifiers} {`,
    "}",
    true,
    true,
    true
  ) as ArrayJoinInput[];
  if (comments) {
    code.unshift(...toNatspec(comments));
  }
  return code;
};
