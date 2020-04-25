# abi-codegen
Typescript library for generating solidity and javascript code to handle tightly packed ABI structures.

Currently supports generation of solidity code for packed decoding on statically sized structs.

See test/test.ts for an example.

# Command Line
> abi-codegen --input ./Structs.sol --output ./StructLib.sol

**--verbose**
Tells the code generator to explicitly define variables and construct the output rather than assigning directly to memory.

## Examples
**Input Struct**
```
struct TestWrapped {
  uint32 a;
  bytes32 b;
  bytes32 c;
  uint8 d;
  ABC e;
}
```

**Output Function**
```
function unpackTestWrapped(bytes memory input)
internal pure returns (TestWrapped memory ret) {
  assembly {
    let ptr := add(input, 32)
    mstore(ret, shr(224, mload(ptr)))
    mstore(add(ret, 32), mload(add(ptr, 4)))
    mstore(add(ret, 64), mload(add(ptr, 36)))
    mstore(add(ret, 96), shr(248, mload(add(ptr, 68))))
    mstore(add(ret, 128), shr(248, mload(add(ptr, 69))))
  }
}
```

**Verbose Output Function**
```
function unpackTestWrapped(bytes memory input)
internal pure returns (TestWrapped memory) {
  uint32 a;
  bytes32 b;
  bytes32 c;
  uint8 d;
  ABC e;
  assembly {
    let ptr := add(input, 32)
    a := shr(224, mload(ptr))
    b := mload(add(ptr, 4))
    c := mload(add(ptr, 36))
    d := shr(248, mload(add(ptr, 68)))
    e := shr(248, mload(add(ptr, 69)))
  }
  return TestWrapped(a, b, c, d, e);
}
```