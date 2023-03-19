import path from "path";
import { readFileSync, writeFileSync } from "fs";

const code = readFileSync(path.join(__dirname, "txt"), "utf8");

const re = /constructor\(\s*((?:\s|.)*?)\s*\)\s*{\s*(super\(\);)/g;

const newCode = code.replace(re, (sub: string, ...matches: string[]) => {
  const [args, superCall] = matches;
  const newArgs =
    (args.endsWith(",") ? args : args + ",") +
    "\nid?: number,\nsrc?: string,";
  const newSuperCall = `super(id, src);`;
  return sub.replace(args, newArgs).replace(superCall, newSuperCall);
});

writeFileSync(path.join(__dirname, "txt-2.ts"), newCode);