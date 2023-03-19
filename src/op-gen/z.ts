import { writeFileSync } from "fs";
import path from "path";
import { JavaScriptReservedKeywords } from "../lib/ReservedKeywords";

const code_old = `| stop()
| add(x, y)  
| sub(x, y)  
| mul(x, y)  
| div(x, y)  
| sdiv(x, y) 
| mod(x, y)  
| smod(x, y) 
| exp(x, y)  
| not(x)  
| lt(x, y)
| gt(x, y)
| slt(x, y)  
| sgt(x, y)  
| eq(x, y)
| iszero(x)  
| and(x, y)  
| or(x, y)
| xor(x, y)  
| byte(n, x) 
| shl(x, y)  
| shr(x, y)  
| sar(x, y)  
| addmod(x, y, m) 
| mulmod(x, y, m) 
| signextend(i, x)
| keccak256(p, n) 
| pc()    
| pop(x)  
| mload(p)
| mstore(p, v)    
| mstore8(p, v)   
| sload(p)
| sstore(p, v)    
| msize() 
| gas()   
| address()  
| balance(a) 
| selfbalance()   
| caller()
| callvalue()
| calldataload(p) 
| calldatasize()  
| calldatacopy(t, f, s)   
| codesize() 
| codecopy(t, f, s)  
| extcodesize(a)  
| extcodecopy(a, t, f, s) 
| returndatasize()
| returndatacopy(t, f, s) 
| extcodehash(a)  
| create(v, p, n) 
| create2(v, p, n, s)
| call(g, a, v, in, insize, out, outsize)
| callcode(g, a, v, in, insize, out, outsize)
| delegatecall(g, a, in, insize, out, outsize)  
| staticcall(g, a, in, insize, out, outsize)  
| return(p, s)    
| revert(p, s)    
| selfdestruct(a) 
| invalid()  
| log0(p, s) 
| log1(p, s, t1)  
| log2(p, s, t1, t2) 
| log3(p, s, t1, t2, t3)  
| log4(p, s, t1, t2, t3, t4) 
| chainid()  
| basefee()  
| origin()
| gasprice() 
| blockhash(b)    
| coinbase() 
| timestamp()
| number()
| difficulty()    
| gaslimit()`;

// const _code = `| add(x, y)
// | sub(x, y)
// | mul(x, y)
// | div(x, y)
// | sdiv(x, y)
// | mod(x, y)
// | smod(x, y)
// | exp(x, y)
// | not(x)
// | lt(x, y)
// | gt(x, y)
// | slt(x, y)
// | sgt(x, y)
// | eq(x, y)
// | iszero(x)
// | and(x, y)
// | or(x, y)
// | xor(x, y)
// | byte(n, x)
// | shl(x, y)
// | shr(x, y)
// | sar(x, y)
// | addmod(x, y, m)
// | mulmod(x, y, m)
// | signextend(i, x)
// | keccak256(p, n)
// | mload(p)
// | mstore(p, v)
// | mstore8(p, v)
// | sload(p)
// | sstore(p, v)
// | calldataload(p)
// | calldatacopy(t, f, s)
// | returndatacopy(t, f, s)


// | codecopy(t, f, s)
// | extcodesize(a)
// | extcodecopy(a, t, f, s)

// | msize()
// | gas()  
// | address() 
// | balance(a)
// | selfbalance()  
// | caller()  
// | callvalue()    
// | calldataload(p)
// | calldatacopy(t, f, s)
// | calldatasize() 
// | codesize()
// | codecopy(t, f, s)
// | extcodesize(a)
// | extcodecopy(a, t, f, s)
// | returndatasize()  
// | returndatacopy(t, f, s)

// -- accounts --
// | extcodehash(a)
// | create(v, p, n) 
// | create2(v, p, n, s)
// | call(g, a, v, in, insize, out, outsize)
// | callcode(g, a, v, in, insize, out, outsize)
// | delegatecall(g, a, in, insize, out, outsize)  
// | staticcall(g, a, in, insize, out, outsize)  

// -- machine --
// | stop()  | \`-\` | F | stop execution, identical to return(0, 0)  |
// | return(p, s)    
// | revert(p, s)    
// | selfdestruct(a) 
// | invalid()  
// | pc()   
// | pop(x)

// | log0(p, s) 
// | log1(p, s, t1)  
// | log2(p, s, t1, t2) 
// | log3(p, s, t1, t2, t3)  
// | log4(p, s, t1, t2, t3, t4) 

// -- globals --
// | chainid()
// | basefee()  
// | origin()
// | gasprice() 
// | blockhash(b)    
// | coinbase() 
// | timestamp()
// | number()
// | difficulty()    
// | gaslimit()`;

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
  create2: {
    s: "salt",
  },
  byte: {
    n: "index",
  },
  sstore: { s: "slot" },
  sload: { s: "slot" },
  t1: "topic1",
  t2: "topic2",
  t3: "topic3",
  t4: "topic4",
};

const arithmeticOps = [
  "add",
  "mul",
  "sub",
  "div",
  "sdiv",
  "mod",
  "smod",
  "addmod",
  "mulmod",
  "exp",
  "signextend",
  "lt",
  "gt",
  "slt",
  "sgt",
  "eq",
  "iszero",
  "and",
  "or",
  "xor",
  "not",
  "byte",
  "shl",
  "shr",
  "sar",
];

type OpKind = {
  name: string;
  paramNames: string[];
};

function parseOps(code: string) {
  const allOps: OpKind[] = [];
  const lines = code.split("\n");
  const lns: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().length) break;
    const re = /([\w|\d]+)\((([0-9A-z]+)?((?:,\s*)[0-9A-z]+)*)?\)/g;

    const result = re.exec(lines[i]);
    if (!result) break;
    const [, name, inner] = result;
    const args = inner ? inner.split(",") : [];

    let paramNames = args
      .filter(Boolean)
      .map((a) => a.replace(/\s|,/g, ""))
      .map((a) => replacements[name]?.[a] ?? replacements[a] ?? a)
      .map((a) => (JavaScriptReservedKeywords.includes(a) ? "_" + a : a));
    allOps.push({ name, paramNames });
    const inputs = paramNames
      .map((arg) => `${arg}: CastableToIdentifierOrLiteral`)
      .join(", ");
    if (paramNames.length > 0) {
      paramNames = [", [", paramNames.join(", "), "]"];
    }
    const fnCall = [`this.fnCall("${name}"`, ...paramNames, ")"].join("");
    const code = `\t${name} = (${inputs}) => ${fnCall};`;
    lns.push(code);
    lns.push("");
  }
  return allOps;
}

const allOps: OpKind[] = parseOps(_code);
// const lines = _code.split("\n");
// const lns: string[] = [];
// for (let i = 0; i < lines.length; i++) {
//   if (!lines[i].trim().length) break;
//   const re = /([\w|\d]+)\((([0-9A-z]+)?((?:,\s*)[0-9A-z]+)*)?\)/g;

//   const result = re.exec(lines[i]);
//   if (!result) break;
//   const [, name, inner] = result;
//   const args = inner ? inner.split(",") : [];

//   let paramNames = args
//     .filter(Boolean)
//     .map((a) => a.replace(/\s|,/g, ""))
//     .map((a) => replacements[name]?.[a] ?? replacements[a] ?? a)
//     .map((a) => (JavaScriptReservedKeywords.includes(a) ? "_" + a : a));
//   allOps.push({ name, paramNames });
//   const inputs = paramNames
//     .map((arg) => `${arg}: CastableToIdentifierOrLiteral`)
//     .join(", ");
//   if (paramNames.length > 0) {
//     paramNames = [", [", paramNames.join(", "), "]"];
//   }
//   const fnCall = [`this.fnCall("${name}"`, ...paramNames, ")"].join("");
//   const code = `\t${name} = (${inputs}) => ${fnCall};`;
//   lns.push(code);
//   lns.push("");
// }

const arithmetic = allOps.filter(({ name }) => arithmeticOps.includes(name));

const { unary, binary, ternary } = allOps.reduce(
  (obj, op) => {
    const name = [
      "n_ary",
      "unary",
      "binary",
      "ternary",
      ...new Array(5).fill("n_ary"),
    ][op.paramNames.length];
    obj[name].push(op);
    return obj;
  },
  {
    unary: [] as OpKind[],
    binary: [] as OpKind[],
    ternary: [] as OpKind[],
    n_ary: [] as OpKind[],
  }
);
unary.sort((a, b) => (a.name < b.name ? -1 : 1));
binary.sort((a, b) => (a.name < b.name ? -1 : 1));
ternary.sort((a, b) => (a.name < b.name ? -1 : 1));

console.log("UNARY");
console.log(unary.map((n) => n.name));
console.log(binary.map((n) => n.name));
console.log(ternary.map((n) => n.name));

export const ax = ["a", "b"] as const;

const typeDefs = [
  `export const ArithmeticOpNames = [${arithmetic
    .map((n) => `"${n.name}"`)
    .join(", ")}] as const;`,
  `export const UnaryOpNames = [${unary
    .map((n) => `"${n.name}"`)
    .join(", ")}] as const;`,
  `export type UnaryOp = typeof UnaryOpNames[number];`,
  `export const BinaryOpNames = [${binary
    .map((n) => `"${n.name}"`)
    .join(", ")}] as const;`,
  `export type BinaryOp = typeof BinaryOpNames[number];`,
  `export const TernaryOpNames = [${ternary
    .map((n) => `"${n.name}"`)
    .join(", ")}] as const;`,
  `export type TernaryOp = typeof TernaryOpNames[number];`,
];

/* 
for (const op of unary) {

} */

writeFileSync(path.join(__dirname, "T.ts"), typeDefs.join("\n"));
