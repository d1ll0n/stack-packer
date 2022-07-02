# stack-packer

Perform packed encoding on the stack rather than using `memory` or `storage` struct locations.

Modified from [abi-codegen](https://github.com/d1ll0n/abi-codegen), an in-memory struct packer for L2 calldata on [Tiramisu](https://github.com/dharma-eng/Tiramisu).

### Features

- Generate coder libraries to encode/decode packed structs on the stack
- Full struct encoding and decoding
- Getters and setters for individual parameters and arbitrary groups of parameters - avoids encoding/decoding unused fields
- Cache structs on the stack to avoid memory expansion or excessive storage access

## Table of contents

- [Install](#install)
- [Summary](#summary)
- [stack-packer vs. Solidity structs](#stack-packer-vs-solidity-structs)
  - [Memory structs](#memory-structs)
  - [Storage structs](#storage-structs)
- [Usage](#usage)
  - [Command line](#command-line)
  - [Input file notes](#input-file-notes)
  - [Flags](#flags)
- [Basic example](#basic-example)
  - [Define a struct](#define-a-struct)
  - [Generate a coder](#generate-a-coder)
- [Grouping](#grouping)

## Install
`$ npm install -g abi-gen`

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

## Usage

### Command line
`$ stack-packer <input_path> [output_path] [flags]`

Give an `input_path` pointing to either a Solidity file or a directory with Solidity files.

The `output_path` is optional - if it isn't provided, the output file will be saved to your current working directory.

### Input file notes

**Files should only define one struct**

The solidity file(s) you point to should define a contract with a struct defined in it. For the cleanest generated coders, you should only define one struct per file.

**Struct must fit into a single word**

This package will currently only work with structs that have a total size at or below 32 bytes, so dynamic types are not supported, nor are other structs, even if the packed size would fit. Enums are fine.

The Solidity parser used in this package hasn't been updated in a long time, so it does not support defining structs outside of contracts.

### Flags

**--exact, -e**

Use exact type sizes in function getters and setters, e.g. `uint24` instead of `uint256`. Default false.

If this is false, setters will accept `uint256` inputs but will check inputs for overflow.

**--inline, -l**

Inline all constants rather than defining them separately. Default false.

**--unsafe, -u**

Remove overflow checks from setters while still allowing oversized inputs. Default false.

This can not be used with `--exact`, and it is highly recommended that you never set this flag.

**--noComments, -n**

Removes:
- notice that the contract was made with a generator
- section separation comments
- struct definition comment at the top of the file

## Basic example

### Define a struct

Save this file to `User.sol`

```solidity
contract UserContract {
  struct User {
    uint128 balance;
    uint96 dividendPoints;
    uint32 lastUpdateTimestamp;
  }
}
```

### Generate a coder

Run:
`$ stack-packer ./User.sol`

A file will be generated at `UserCoder.sol` with a `UserCoder` library including coder functions for each field in the `User` struct as well as full encode/decode functions.

For example, the `balance` field will be accessible with the following two functions:

```solidity
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
      mstore(Panic_error_offset, Panic_error_length)
      revert(0, Panic_arithmetic)
    }
    updated := or(
      and(old, User__balance_maskOut),
      shl(User__balance_bitsAfter, _balance)
    )
  }
}
```

## Grouping

stack-packer also allows you to group fields together to generate coders for subsets of the struct. This is useful for functions which will only need to read or write specific fields.

The syntax for grouping is to add `_group_GroupName` after the field name. You can add multiple groups per field.

Create a file `ExchangeConfig.sol` and paste this Solidity code:

```solidity
contract ExchangeConfigContract {
  struct ExchangeConfig {
    uint16 buyFeeBips_group_Fees_group_Buy;
    uint112 totalBuyFees_group_Buy;
    uint16 sellFeeBips_group_Fees_group_Sell;
    uint112 totalSellFees_group_Sell;
  }
}
```

Run:
`$ stack-packer ./ExchangeConfig.sol`

The `ExchangeConfigCoder.sol` file will include grouped functions for `Fees`, `Buy` and `Sell`. Now governance can update the fee bips without needing to decode the total fees, the buy and sell functions can read the appropriate fee bips and the previous total without decoding the parameters for the other side, etc.

```solidity
/*//////////////////////////////////////////////////////////////
                  ExchangeConfig Fees Group
//////////////////////////////////////////////////////////////*/

function setFees(
  ExchangeConfig old,
  uint256 buyFeeBips,
  uint256 sellFeeBips
) internal pure returns (ExchangeConfig updated) {
  assembly {
    if or(gt(buyFeeBips, MaxUint16), gt(sellFeeBips, MaxUint16)) {
      mstore(0, Panic_error_signature)
      mstore(Panic_error_offset, Panic_error_length)
      revert(0, Panic_arithmetic)
    }
    updated := or(
      and(old, ExchangeConfig_Fees_maskOut),
      or(
        shl(ExchangeConfig_buyFeeBips_bitsAfter, buyFeeBips),
        shl(ExchangeConfig_sellFeeBips_bitsAfter, sellFeeBips)
      )
    )
  }
}

function getFees(ExchangeConfig encoded)
  internal
  pure
  returns (uint256 buyFeeBips, uint256 sellFeeBips)
{
  assembly {
    buyFeeBips := shr(ExchangeConfig_buyFeeBips_bitsAfter, encoded)
    sellFeeBips := and(
      MaskOnlyLastTwoBytes,
      shr(ExchangeConfig_sellFeeBips_bitsAfter, encoded)
    )
  }
}
```