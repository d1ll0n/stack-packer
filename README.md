# abi-codegen
Typescript library for generating solidity and typescript code to handle tightly packed ABI structures.

# Install
> npm install -g abi-gen

# Command Line
## Solidity
> abi-gen sol --input <input_file> --output <output_file> [flags]

### Flags
**--verbose**
Tells the code generator to explicitly define variables and construct the output rather than assigning directly to memory.

## TypeScript
> abi-gen ts -i <input_file> -o <output_directory>


# Examples
**Input Struct**
```
enum ABC { a, b }
struct TestWrapped {
  uint32 a;
  bytes32 b;
  bytes32 c;
  uint8 d;
  ABC e;
}
```

Save the above in `./input`.

## Solidity
> abi-gen sol -i ./input -o ./output.sol

*I still need to add handling to use the right library name instead of making one up.*
**Output**
```cs
pragma solidity ^0.6.0;

library OutputCode {
  enum ABC { a, b }

  struct TestWrapped {
    uint32 a;
    bytes32 b;
    bytes32 c;
    uint8 d;
    ABC e;
  }

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
}
```

## TypeScript
> abi-gen ts -i ./input -o ./output-dir
A number of files will be created, but the main output will be:
```ts
import {defineProperties} from 'ts-abi-utils';
import { ABC } from './ABC';
const TestWrappedABI = require('./TestWrappedABI.json');

export interface TestWrappedData {
	a: number;
	b: string;
	c: string;
	d: number;
	e: ABC;
}

export interface TestWrapped extends TestWrappedData {
	/* Encode as ABI. */
	toAbi: () => Buffer;
	/* Encode as packed ABI - all fields will have minimal length for their type. */
	toAbiPacked: () => Buffer;
	/* Encode as JSON object. */
	toJson: () => any;
}

export class TestWrapped {
	constructor(input: TestWrappedData) { Object.assign(this, input); }
	/* Decode a TestWrapped from an ABI string or buffer. */
	static fromAbi: (input: string | Buffer) => TestWrapped;
	/* Decode a TestWrapped from a packed ABI string or buffer */
	static fromAbiPacked: (input: string | Buffer) => TestWrapped;
	/* Decode a TestWrapped from an arbitrary object with BufferLike fields of the same names (works for JSON). */
	static fromObject: (input: any) => TestWrapped;
}
defineProperties(TestWrapped, TestWrappedABI);
```