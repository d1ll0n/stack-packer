export type CommentLines = {
  type: "param" | "dev" | "notice" | "note";
  text: string | string[];
};

export const toCommentSeparator = (comment: string) => {
  const halfSpaceBefore = Math.ceil((64 - comment.length) / 2);
  return [
    `/*${"/".repeat(62)}`,
    `${" ".repeat(halfSpaceBefore)}${comment}`,
    `${"/".repeat(62)}*/`,
  ];
};

export const toNatspec = (comments: CommentLines[]) => {
  const linesOut: string[] = ["/**"];
  for (const comment of comments) {
    if (!comment.text.length) continue;
    const [firstLine, ...otherLines] =
      typeof comment.text === "string" ? [comment.text] : comment.text;
    const lines = [
      ` * @${comment.type} ${firstLine}`,
      ...otherLines.map(
        (ln) => ` *${" ".repeat(comment.type.length + 2)} ${ln}`
      ),
    ];
    linesOut.push(...lines);
  }
  linesOut.push(" */");
  return linesOut;
};

const UnsafeWarning = [
  `//                           --- WARNING ---`,
  `// This library was generated with the 'unsafe' flag, and does not`,
  `// check for overflows in parameter assignment as a result. Ensure`,
  `// that your code will never pass a value to a setter function that`,
  `// could exceed the parameter size.`
]

export const generateNotice = (unsafe: boolean) => [
  `// ============================== NOTICE ==============================`,
  `// This library was automatically generated with stackpacker.`,
  `// Be very careful about modifying it, as doing so incorrectly could`,
  `// result in corrupted reads/writes.`,
  ...(unsafe ? UnsafeWarning : []),
  `// ====================================================================`
];