import path from "path";
import { groups } from "./op-groups";
import { JavaScriptReservedKeywords } from "../lib/ReservedKeywords";
import { readFileSync, writeFileSync } from "fs";

// remove whitespace
const rmWS = (str: string | string[]) =>
  Array.isArray(str)
    ? str.map(rmWS).filter(Boolean)
    : str.replace(/(^\s*)|(\s*$)/g, "");

const text = readFileSync(path.join(__dirname, "./ops.rst"), "utf8")
  .split("\n")
  .slice(3)
  .join("\n");
const separator = `+-------------------------+-----+---+-----------------------------------------------------------------+`;
const rows = rmWS(text.split(separator));

const ops: any = [];

const replacements = {
  in: "inPtr",
  insize: "inSize",
  out: "outPtr",
  outsize: "outSize",
  t: "dst",
  f: "src",
  s: "size",
  a: "address",
  g: "gas",
  p: "ptr",
  v: "value",
  n: "size",
  create2: { s: "salt" },
  byte: { n: "index" },
  sstore: { s: "slot" },
  sload: { s: "slot" },
  t1: "topic1",
  t2: "topic2",
  t3: "topic3",
  t4: "topic4",
};

function parseDefinition(definition: string) {
  const re = /([\w|\d]+)\((([0-9A-z]+)?((?:,\s*)[0-9A-z]+)*)?\)/g;

  const result = re.exec(definition);
  if (!result) return undefined;
  const [, name, inner] = result;
  const args = inner ? inner.split(",") : [];

  const parameters = args
    .filter(Boolean)
    .map((a) => a.replace(/\s|,/g, ""))
    .map((a) => replacements[name]?.[a] ?? replacements[a] ?? a)
    .map((a) => (JavaScriptReservedKeywords.includes(a) ? "_" + a : a));

  return { name, parameters };
}

for (const row of rows) {
  const lines = rmWS(row.split("\n"));
  let definition = "";
  let comment = "";
  for (const line of lines) {
    const [, definitionFragment, , , commentFragment] = line
      .split("|")
      .map((col) => rmWS(col));

    if (definitionFragment) definition += " " + definitionFragment;
    if (commentFragment) comment += " " + commentFragment;
  }
  if (definition) {
    const { name, parameters } = parseDefinition(definition) || {};
    if (name && parameters) {
      ops.push({ name, parameters, comment });
    }
  }
}

const opGroups = [];
for (const groupName of Object.keys(groups)) {
  const group = groups[groupName];
  const newGroup = [];
  for (const opName of Object.keys(group)) {
    const haveOp = ops.find((op) => op.name === opName);
    if (!haveOp) {
      console.log(`Did not find op for ${opName}`);
    } else {
      newGroup.push(haveOp);
    }
  }
  opGroups.push({
    name: groupName,
    ops: newGroup,
  });
}

writeFileSync(path.join(__dirname, "ops.json"), JSON.stringify(ops, null, 2));
writeFileSync(
  path.join(__dirname, "groups.json"),
  JSON.stringify(opGroups, null, 2)
);
