import {
  ASTNodeWriter,
  ASTWriter,
  DefaultASTWriterMapping,
  InlineAssembly,
  PrettyFormatter,
  SourceFormatter,
  SrcDesc,
  StructuredDocumentation,
} from "solc-typed-ast";
import { YulBlock } from "./ast";
import { translateYulNode } from "./translate";

function join<T1, T2>(arr: readonly T1[], join: T2): Array<T1 | T2> {
  const result: Array<T1 | T2> = [];

  for (let i = 0; i < arr.length; i++) {
    result.push(arr[i]);

    if (i !== arr.length - 1) {
      result.push(join);
    }
  }

  return result;
}

export class StructuredDocumentationWriter extends ASTNodeWriter {
  static render(text: string, formatter: SourceFormatter): string {
    const indent = formatter.renderIndent();
    const prefix = "/// ";

    const documentation = text.replace(/\n/g, (sub) => sub + indent + prefix);

    return prefix + documentation;
  }

  writeInner(node: StructuredDocumentation, writer: ASTWriter): SrcDesc {
    return [StructuredDocumentationWriter.render(node.text, writer.formatter)];
  }
}

export function writePrecedingDocs(
  documentation: string | StructuredDocumentation | undefined,
  writer: ASTWriter
): SrcDesc {
  if (documentation === undefined) {
    return [];
  }

  const indent = writer.formatter.renderIndent();

  if (documentation instanceof StructuredDocumentation) {
    return writer.desc(documentation, "\n", indent);
  }

  return [
    StructuredDocumentationWriter.render(documentation, writer.formatter),
    "\n",
    indent,
  ];
}

export class InlineAssemblyWriter extends ASTNodeWriter {
  writeInner(node: InlineAssembly, writer: ASTWriter): SrcDesc {
    const result: SrcDesc = ["assembly "];

    if (node.flags !== undefined) {
      const quotedFlags = node.flags.map((flag) => `"${flag}"`);

      result.push("(", ...join(quotedFlags, ", "), ") ");
    }

    if (node.operations !== undefined) {
      result.push(node.operations);
    } else if (node.yul !== undefined) {
      const yulNode = translateYulNode(node.yul, node);

      result.push(yulNode.write(writer.formatter));
    } else {
      throw new Error(
        "Unable to detect Yul data in inline assembly node: " + node.print()
      );
    }

    return result;
  }

  writeWhole(node: InlineAssembly, writer: ASTWriter): SrcDesc {
    return [
      ...writePrecedingDocs(node.documentation, writer),
      [node, this.writeInner(node, writer)],
    ];
  }
}

DefaultASTWriterMapping.set(
  YulBlock,
  
)

DefaultASTWriterMapping.set(InlineAssembly, new InlineAssemblyWriter());
const writer = new ASTWriter(
  DefaultASTWriterMapping,
  new PrettyFormatter(2, 0)
);
