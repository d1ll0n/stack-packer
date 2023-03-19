import { YulNode } from "./ast";

const jSel = require("jsel");

/* istanbul ignore next */
jSel.addFunction(null, "is", (...args: any[]) => {
  if (args.length !== 2) {
    throw new Error('Function "is" expects (object)');
  }

  const [context, pathExpr] = args;

  const value = pathExpr.evaluate(context);

  if (value.constructor.name === "XNodeSet") {
    const tree = value.tree;

    if (tree && tree.node && !tree.node.value) {
      value.tree = null;
    }
  }

  return value.bool();
});

interface SchemaInterface {
  nodeName: (node: any) => string;
  childNodes: (node: any) => readonly any[];
  attributes: (node: any) => { [attribute: string]: any };
  nodeValue: (node: any) => any;
}

const SKIP = new Set([
  "context",
  "requiredContext",
  "raw",
  "children",
  "parent",
  "type",
  "xpath",
]);

const YulNodeSchema: SchemaInterface = {
  nodeName: (node: YulNode) => node.nodeType,
  childNodes: (node: YulNode) => node.children,

  attributes: (node: YulNode) => {
    const attrs: any = {};

    for (const [k, v] of node.getFieldValues().entries()) {
      if (SKIP.has(k)) {
        continue;
      }

      attrs[k] = v;
    }

    for (const [g, v] of node.getGettersValues().entries()) {
      if (SKIP.has(g)) {
        continue;
      }

      attrs[g] = v;
    }

    return attrs;
  },

  nodeValue: () => undefined,
};

export class YulXPath {
  private dom: any;

  constructor(node: YulNode) {
    const dom = jSel(node);

    dom.schema(YulNodeSchema);

    this.dom = dom;
  }

  query(path: string): any {
    return this.dom.selectAll(path);
  }
}
