# stack-packer

## Summary

This package will take an input Solidity file (or directory of Solidity files) which defines packed structs, and generate a coder library for each struct. This library will define a `uint256` type alias with the same name as the struct and define getter and setter functions for each field in the type, as well as full-type encode/decode functions and getters and setters for defined groups.

The advantage of this is that you can define packed structs without the overhead caused by loading structs into memory and without the risk of a function unintentionally executing multiple storage writes by setting fields in a `storage` struct more than a few lines apart.

It is **highly recommended** that you use this library alongside a high number of optimization runs, with `viaIR` set to true and without disabling yul inlining.

## Install
`$ npm install -g abi-gen`

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

**--inline, -in**

Inline all constants rather than defining them separately. Default false.

**--unsafe, -u**

Remove overflow checks from setters while still allowing oversized inputs. Default false.

This can not be used with `--exact`, and it is highly recommended that you never set this flag.

## Basic Example

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

### Generate a coder for it

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