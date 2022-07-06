# stack-packer

Perform packed encoding on the stack rather than using `memory` or `storage` struct locations.

Modified from [abi-codegen](https://github.com/d1ll0n/abi-codegen), an in-memory struct packer for L2 calldata on [Tiramisu](https://github.com/dharma-eng/Tiramisu).

### Features

- Generate coder libraries to encode/decode packed structs on the stack
- Full struct encoding and decoding
- Getters and setters for individual parameters and arbitrary groups of parameters - avoids encoding/decoding unused fields
- Cache structs on the stack to avoid memory expansion or excessive storage access
- Use one bit for booleans
# Table of contents

- [Install](#install)
- [Summary](#summary)
  - [stack-packer vs. Solidity structs](#stack-packer-vs-solidity-structs)
- [Command line](#command-line)
- [Features Overview](#features-overview)
  - [Groups](#groups)
  - [Coder Types](#coder-types)
  - [Accessors](#accessors)
- [Coders in depth](#coders-in-depth)
  - [Coder Type Resolution](#coder-type-resolution)
- [Examples](#examples)
  - [Basic example](#basic-example)
  - [Grouping](#grouping)

## Install
`$ npm install -g stack-packer`

## Summary

This package will take an input Solidity file (or directory of Solidity files) which defines packed structs, and generate a coder library for each struct. This library will define a `uint256` type alias with the same name as the struct and define getter and setter functions for each field in the type, as well as full-type encode/decode functions and getters and setters for defined groups.

It is **highly recommended** that you use this library alongside a high number of optimization runs, with `viaIR` set to true and without disabling yul inlining.


## stack-packer vs. Solidity structs

**Note:** This comparison is based on preliminary testing and my experience with Solidity structs. I have not thoroughly verified the claims about when each is cheaper overall.

### Memory structs
stack-packer vs. `memory` location structs:
- Does not decode or encode any unused values, saving gas on mask, shift and stack operations.
- Does not expand memory.
- Does not re-pack the data to write to storage, since structs are kept in their packed encoding.
- Can potentially cost more for contracts with a high number of reads/writes to the same parameters.

Reading a struct from storage to memory will decode the entire struct and place it in memory. This both expands memory by the full size of the unpacked struct (one word per value) and involves numerous operations to isolate each parameter and write it to memory. If you do not use all of these values, those decode operations are wasted.

Similarly, when you write a memory struct to storage, Solidity will have to re-pack the parameters, which again will add overhead if any of those values are unchanged.

On the other hand, each individual read or write of a single parameter should be less expensive than stack-packer, since this package will have to individually encode or decode a value when it is read or set. Contracts which do a large number of reads and writes to the same memory struct would likely spend more gas on stack-packer's access overhead than they would save on the setup costs.

### Storage structs
stack-packer vs. `storage` location structs:
- Does not write directly to storage - structs are updated in place and must be written to storage, similar to `memory` location structs. 
- Both will keep the struct in the packed format, so ignoring `sload` and `sstore` operations, the direct access cost should be identical (assuming the optimizer inlines the coder functions)

Solidity `storage` location structs will usually combine reads/writes that are very close to each other, but if you do multiple reads and writes to a struct in different locations, Solidity will perform multiple storage interactions, whereas stack-packer will only require one read and one write for a full update cycle.

This requires further testing to verify, but a singular read or write (or a closely grouped set of them) on a `storage` location struct should have an identical cost to stack-packer.

# Command line
`$ stack-packer <input_path> [output_path] [flags]`

Give an `input_path` pointing to either a Solidity file or a directory with Solidity files.

The `output_path` is optional - if it isn't provided, the output file will be saved to your current working directory.

## Command Line Flags

**--inline, -l**

Inline all constants rather than defining them separately. Default false.

**--noComments, -n**

Removes:
- notice that the contract was made with a generator
- section separation comments
- struct definition comment at the top of the file

### Input file notes

**Files should only define one struct**

The solidity file(s) you point to should define a contract with a struct defined in it. For the cleanest generated coders, you should only define one struct per file.

**Struct must fit into a single word**

This package will currently only work with structs that have a total size at or below 32 bytes, so dynamic types are not supported, nor are other structs, even if the packed size would fit. Enums are fine.

# Features Overview
Structs can be defined using normal Solidity syntax and can set configuration options with some added syntax.

Parameters can use any type size so long as the whole struct fits into a single word - uints do not need to be multiples of 8, e.g. `uint2 a;` and `uint6 b;` are valid.

stack-packer has three changes to normal `struct` declaration syntax:
- groups
- coder types
- accessors

## Groups

Structs can define groups of related fields to generate encode/decode functions for a subsets of the fields in a struct. This saves some gas you would otherwise spend decoding or updating fields that you aren't using in a particular function.

The syntax to define a group is:
```solidity
struct Data {
  uint64 amountA;
  uint64 amountB;
  uint64 amountC;

  group AB {
    amountA;
    amountB;
  }
}
```

## Coder Types

Structs, fields and groups can specify a "coder type" to tell the library what kind of code to generate to encode or decode parameters. There are currently three supported types:

- `checked` (default): Use `uint256` as the parameter type (for uint and enum parameters) with overflow checks in the setter.
- `unchecked`: Use `uint256` as the parameter type (for uint and enum parameters) without overflow checks in the setter. This is not recommended.
- `exact`: Use the exact type of a field as the parameter type. If the size is not a multiple of 8, it will be rounded up to the next multiple of 8 and checked for overflow.

Coder types can be specified after the declaration of a field, struct, group or accessor.

Structs: `struct ABC exact {}`

Groups: `group AB exact {}`

Fields: `uint64 a exact;`

Accessor: `get exact;`

### Examples

`uint22 a unchecked;`: `uint256` will be used as the input/output parameter in the coder for `a`.

`uint31 a checked;`: `uint256` will be used as the input/output parameter in the coder for `a`. The struct's `encode` function and the setter for `a` will both check `a` to check that it fits in a uint31.

`uint69 a exact`: `uint72` will be used as the input/output parameter in the coder for `a`.

## Accessors

Accessors can be defined to override the behavior of encode/decode functions and can be set for fields, structs and groups.

### Field accessors
```solidity
struct ABC {
  uint64 a {
    get [checked|unchecked|exact];
    set [checked|unchecked|exact];
  }
}
```

Fields can define accessors to override the behavior of, or remove, their specific getters or setters.

If no accessor block is given, both a getter and a setter will be generated.

If an empty accessor block is given (empty brackets), the coder will not include a `get` or `set` function for the field.

If `get` is defined without `set`, the setter will not be generated, and vice versa.

If a coder type is provided, it will override the behavior of the getter or setter for that field.

Example:

`uint64 a checked { get exact; }` - `getA()` will return a `uint64`. `setA()` will not be generated.

### Struct accessors
```solidity
struct ABC {
  get [checked|unchecked|exact];
  set [checked|unchecked|exact];
}
```

Structs can define accessors to override the behavior of, or remove, their encode/decode functions.

If a `get` accessor is defined without a `set` accessor, `decode()` will be generated and `encode()` will not be, and vice versa.

Currently struct accessors do not override the coder types of the encode/decode functions, but that will be added in a future release.

### Group accessors

Groups can define accessors to override the behavior of, or remove, their encode/decode functions.

If a `get` accessor is defined without a `set` accessor, `getGroup()` function will be generated and `setGroup()` will not be, and vice versa.

Group accessors may also specify coder types to override the group's coder type for the get/set functions, meaning they will be used on any parameters that do not have their own coder type specified.

**Example**

```solidity
struct Data {
  uint64 a;
  uint64 b;
  uint64 c;
  uint64 d;

  group AB {
    set unchecked;
    a checked;
    b;
    // results in function setAB(Data old, uint256 a, uint256 b)
    // `a` checked for overflow, `b` is not
  }
}
```

# Coders in depth
## Coder Type Resolution

### Coder Type for `getField` / `setField`

For field-level functions, the coder type will be the first coder type in this list which is defined:

1. field's accessor coder type, e.g. `uint64 a unchecked { get exact; }` will resolve to `exact` when generating the field's getter
2. field's coder type, e.g. `uint256 a unchecked`
3. parent struct's coder type, e.g. `struct ABC checked`
4. default `checked`

Examples:
```solidity
struct ABCD unchecked {
  uint64 a;
  // Resulting coders
  // getA(ABCD) returns (uint256)
  // setA(ABCD, uint256) returns (ABCD)

  uint64 b exact;
  // Resulting coders
  // getB(ABCD) returns (uint64)
  // setB(ABCD, uint64) returns (ABCD)

  uint64 c checked {
    get;
    set exact;
  }
  // Resulting coders
  // getC(ABCD) returns (uint256)
  // setC(ABCD, uint64) returns (ABCD)
}
```

### Coder Type for `encode` / `decode`

In a struct's `encode` or `decode` function, the coder type of a given parameter will be the coder type in the parameter declaration if one is given, otherwise it will be the struct's.
If a parameter's size is not a multiple of 8, it will be checked for overflow even if its coder type is `exact`
In a future release, the coder type of a group's accessors will be applied before the group's.

Examples:
```solidity
struct ABCD unchecked {
  uint64 a;
  uint64 b exact;
  uint64 c checked;
  uint60 d exact;

  // Resulting coders
  // encode(uint256 a, uint64 b, uint256 c, uint64 d) returns (ABCD)
  // `c` and `d` checked for overflow (since `d` marked `exact`)


  uint64 c checked {
    get;
    set exact;
  }
  // Resulting coders
  // getC(ABCD) returns (uint256)
  // setC(ABCD, uint64) returns (ABCD)
}
```

### Coder Type for `getGroup` / `setGroup`

For group-level functions, the coder type will be the first coder type in this list which is defined:

1. coder type given in the parameter declaration in the group, e.g. `group AB { a unchecked; }` will use `unchecked` for `a`
2. group's accessor coder type, e.g. `group AB { get exact; a; }` will resolve to `exact` when generating the group's getter
3. group's coder type, e.g. `group AB unchecked { a; }` will resolve to `unchecked`
4. original parameter's coder type, e.g. `struct A { uint64 exact a; group A1 { a; } }` will resolve to `exact`
5. parent struct's coder type, e.g. `struct ABC checked { uint64 a; uint64 b; group A1 { a; } }` will resolve to `checked`

# Examples

## Basic example

### Define a struct

Save this file to `User.sol`

```solidity
struct User {
  uint128 balance;
  uint96 dividendPoints;
  uint32 lastUpdateTimestamp;
}
```

### Generate a coder

Run:
`$ stack-packer ./User.sol`

A file will be generated at `UserCoder.sol` with a `UserCoder` library including coder functions for each field in the `User` struct as well as full encode/decode functions.

For example, the `balance` field will be accessible with the following two functions:

```solidity
type User is uint256;
...

library UserCoder {
  ...

  /*//////////////////////////////////////////////////////////////
                        User.balance coders
  //////////////////////////////////////////////////////////////*/

  function getBalance(User encoded)
    internal
    pure
    returns (uint256 _balance)
  {
    assembly {
      _balance := shr(User__balance_bitsAfter, encoded)
    }
  }

  function setBalance(User old, uint256 _balance)
    internal
    pure
    returns (User updated)
  {
    assembly {
      if gt(_balance, MaxUint128) {
        mstore(0, Panic_error_signature)
        mstore(Panic_error_offset, Panic_arithmetic)
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, User__balance_maskOut),
        shl(User__balance_bitsAfter, _balance)
      )
    }
  }

  ...
}
```

## Grouping

stack-packer also allows you to group fields together to generate coders for subsets of the struct. This is useful for functions which will only need to read or write specific fields.

Create a file `ExchangeConfig.sol` and paste this Solidity code:

```solidity
struct ExchangeConfig {
  uint16 buyFeeBips;
  uint112 totalBuyFees;
  uint16 sellFeeBips;
  uint112 totalSellFees;

  group Fees {
    buyFeeBips;
    sellFeeBips;
  }

  group Sell {
    sellFeeBips;
    totalSellFees;
  }

  group Buy {
    buyFeeBips;
    totalBuyFees;
  }
}
```

Run:
`$ stack-packer ./ExchangeConfig.sol`

The `ExchangeConfigCoder.sol` file will include grouped functions for `Fees`, `Buy` and `Sell`. Now governance can update the fee bips without needing to decode the total fees, the buy and sell functions can read the appropriate fee bips and the previous total without decoding the parameters for the other side, etc.

```solidity
type User is uint256;

...

// Code and param names removed for readability

library UserCoder {
  function decode(ExchangeConfig)
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    );

  function encode(
    uint256,
    uint256,
    uint256,
    uint256
  ) returns (ExchangeConfig);

  function getBuyFeeBips(ExchangeConfig) returns (uint256);

  function setBuyFeeBips(ExchangeConfig, uint256) returns (ExchangeConfig);

  function getTotalBuyFees(ExchangeConfig) returns (uint256 totalBuyFees);

  function setTotalBuyFees(ExchangeConfig, uint256 totalBuyFees)
    returns (ExchangeConfig);

  function getSellFeeBips(ExchangeConfig) returns (uint256);

  function setSellFeeBips(ExchangeConfig, uint256) returns (ExchangeConfig);

  function getTotalSellFees(ExchangeConfig) returns (uint256 totalSellFees);

  function setTotalSellFees(ExchangeConfig, uint256 totalSellFees)
    returns (ExchangeConfig);

  function setFees(
    ExchangeConfig,
    uint256,
    uint256
  ) returns (ExchangeConfig);

  function getFees(ExchangeConfig) returns (uint256, uint256);

  function setSell(
    ExchangeConfig,
    uint256,
    uint256 totalSellFees
  ) returns (ExchangeConfig);

  function getSell(ExchangeConfig) returns (uint256, uint256 totalSellFees);

  function setBuy(
    ExchangeConfig,
    uint256,
    uint256 totalBuyFees
  ) returns (ExchangeConfig);

  function getBuy(ExchangeConfig) returns (uint256, uint256 totalBuyFees);
}
```