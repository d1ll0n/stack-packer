import { YulIdentifier } from "./ast";

export const BuiltinFunctionIds = {
  get stop() {
    return new YulIdentifier("stop");
  },
  get add() {
    return new YulIdentifier("add");
  },
  get sub() {
    return new YulIdentifier("sub");
  },
  get mul() {
    return new YulIdentifier("mul");
  },
  get div() {
    return new YulIdentifier("div");
  },
  get sdiv() {
    return new YulIdentifier("sdiv");
  },
  get mod() {
    return new YulIdentifier("mod");
  },
  get smod() {
    return new YulIdentifier("smod");
  },
  get exp() {
    return new YulIdentifier("exp");
  },
  get not() {
    return new YulIdentifier("not");
  },
  get lt() {
    return new YulIdentifier("lt");
  },
  get gt() {
    return new YulIdentifier("gt");
  },
  get slt() {
    return new YulIdentifier("slt");
  },
  get sgt() {
    return new YulIdentifier("sgt");
  },
  get eq() {
    return new YulIdentifier("eq");
  },
  get iszero() {
    return new YulIdentifier("iszero");
  },
  get and() {
    return new YulIdentifier("and");
  },
  get or() {
    return new YulIdentifier("or");
  },
  get xor() {
    return new YulIdentifier("xor");
  },
  get byte() {
    return new YulIdentifier("byte");
  },
  get shl() {
    return new YulIdentifier("shl");
  },
  get shr() {
    return new YulIdentifier("shr");
  },
  get sar() {
    return new YulIdentifier("sar");
  },
  get addmod() {
    return new YulIdentifier("addmod");
  },
  get mulmod() {
    return new YulIdentifier("mulmod");
  },
  get signextend() {
    return new YulIdentifier("signextend");
  },
  get keccak256() {
    return new YulIdentifier("keccak256");
  },
  get pc() {
    return new YulIdentifier("pc");
  },
  get pop() {
    return new YulIdentifier("pop");
  },
  get mload() {
    return new YulIdentifier("mload");
  },
  get mstore() {
    return new YulIdentifier("mstore");
  },
  get mstore8() {
    return new YulIdentifier("mstore8");
  },
  get sload() {
    return new YulIdentifier("sload");
  },
  get sstore() {
    return new YulIdentifier("sstore");
  },
  get msize() {
    return new YulIdentifier("msize");
  },
  get gas() {
    return new YulIdentifier("gas");
  },
  get address() {
    return new YulIdentifier("address");
  },
  get balance() {
    return new YulIdentifier("balance");
  },
  get selfbalance() {
    return new YulIdentifier("selfbalance");
  },
  get caller() {
    return new YulIdentifier("caller");
  },
  get callvalue() {
    return new YulIdentifier("callvalue");
  },
  get calldataload() {
    return new YulIdentifier("calldataload");
  },
  get calldatasize() {
    return new YulIdentifier("calldatasize");
  },
  get calldatacopy() {
    return new YulIdentifier("calldatacopy");
  },
  get codesize() {
    return new YulIdentifier("codesize");
  },
  get codecopy() {
    return new YulIdentifier("codecopy");
  },
  get extcodesize() {
    return new YulIdentifier("extcodesize");
  },
  get extcodecopy() {
    return new YulIdentifier("extcodecopy");
  },
  get returndatasize() {
    return new YulIdentifier("returndatasize");
  },
  get returndatacopy() {
    return new YulIdentifier("returndatacopy");
  },
  get extcodehash() {
    return new YulIdentifier("extcodehash");
  },
  get create() {
    return new YulIdentifier("create");
  },
  get create2() {
    return new YulIdentifier("create2");
  },
  get call() {
    return new YulIdentifier("call");
  },
  get callcode() {
    return new YulIdentifier("callcode");
  },
  get delegatecall() {
    return new YulIdentifier("delegatecall");
  },
  get staticcall() {
    return new YulIdentifier("staticcall");
  },
  get return() {
    return new YulIdentifier("return");
  },
  get revert() {
    return new YulIdentifier("revert");
  },
  get selfdestruct() {
    return new YulIdentifier("selfdestruct");
  },
  get invalid() {
    return new YulIdentifier("invalid");
  },
  get log0() {
    return new YulIdentifier("log0");
  },
  get log1() {
    return new YulIdentifier("log1");
  },
  get log2() {
    return new YulIdentifier("log2");
  },
  get log3() {
    return new YulIdentifier("log3");
  },
  get log4() {
    return new YulIdentifier("log4");
  },
  get chainid() {
    return new YulIdentifier("chainid");
  },
  get basefee() {
    return new YulIdentifier("basefee");
  },
  get origin() {
    return new YulIdentifier("origin");
  },
  get gasprice() {
    return new YulIdentifier("gasprice");
  },
  get blockhash() {
    return new YulIdentifier("blockhash");
  },
  get coinbase() {
    return new YulIdentifier("coinbase");
  },
  get timestamp() {
    return new YulIdentifier("timestamp");
  },
  get number() {
    return new YulIdentifier("number");
  },
  get difficulty() {
    return new YulIdentifier("difficulty");
  },
  get gaslimit() {
    return new YulIdentifier("gaslimit");
  },
};
