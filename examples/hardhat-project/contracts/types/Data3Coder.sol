// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import './CoderConstants.sol';

// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

// struct Data3 {
//   SomeEnum myEnum;
//   uint16 a;
//   int16 b;
//   int32 c;
//   bool d;
//   bool x;
// }
type Data3 is uint256;

Data3 constant DefaultData3 = Data3.wrap(0);

library Data3Coder {
  /*//////////////////////////////////////////////////////////////
                              Data3
//////////////////////////////////////////////////////////////*/

  function decode(Data3 encoded)
    internal
    pure
    returns (
      uint256 myEnum,
      uint256 a,
      int256 b,
      int256 c,
      bool d,
      bool x
    )
  {
    assembly {
      myEnum := shr(
        Data3_myEnum_bitsAfter,
        encoded
      )
      a := and(
        MaxUint16,
        shr(Data3_a_bitsAfter, encoded)
      )
      b := signextend(
        0x01,
        shr(Data3_b_bitsAfter, encoded)
      )
      c := signextend(
        0x03,
        shr(Data3_c_bitsAfter, encoded)
      )
      d := and(
        MaxUint1,
        shr(Data3_d_bitsAfter, encoded)
      )
      x := and(
        MaxUint1,
        shr(Data3_x_bitsAfter, encoded)
      )
    }
  }

  function encode(
    uint256 myEnum,
    uint256 a,
    int256 b,
    int256 c,
    bool d,
    bool x
  ) internal pure returns (Data3 encoded) {
    assembly {
      if or(
        gt(myEnum, MaxUint3),
        or(
          gt(a, MaxUint16),
          or(
            xor(b, signextend(1, b)),
            xor(c, signextend(3, c))
          )
        )
      ) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      encoded := or(
        shl(Data3_myEnum_bitsAfter, myEnum),
        or(
          shl(Data3_a_bitsAfter, a),
          or(
            shl(
              Data3_b_bitsAfter,
              and(b, MaxInt16)
            ),
            or(
              shl(
                Data3_c_bitsAfter,
                and(c, MaxInt32)
              ),
              or(
                shl(Data3_d_bitsAfter, d),
                shl(Data3_x_bitsAfter, x)
              )
            )
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                        Data3 Abc coders
//////////////////////////////////////////////////////////////*/

  function setAbc(
    Data3 old,
    uint256 a,
    int256 b,
    int256 c
  ) internal pure returns (Data3 updated) {
    assembly {
      if or(
        gt(a, MaxUint16),
        or(
          xor(b, signextend(1, b)),
          xor(c, signextend(3, c))
        )
      ) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_Abc_maskOut),
        or(
          shl(Data3_a_bitsAfter, a),
          or(
            shl(
              Data3_b_bitsAfter,
              and(b, MaxInt16)
            ),
            shl(
              Data3_c_bitsAfter,
              and(c, MaxInt32)
            )
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                        Data3 Cba coders
//////////////////////////////////////////////////////////////*/

  function setCba(
    Data3 old,
    bool x,
    int256 b,
    int256 c
  ) internal pure returns (Data3 updated) {
    assembly {
      if or(
        xor(b, signextend(1, b)),
        xor(c, signextend(3, c))
      ) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_Cba_maskOut),
        or(
          shl(Data3_x_bitsAfter, x),
          or(
            shl(
              Data3_b_bitsAfter,
              and(b, MaxInt16)
            ),
            shl(
              Data3_c_bitsAfter,
              and(c, MaxInt32)
            )
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                       Data3.myEnum coders
//////////////////////////////////////////////////////////////*/

  function getMyEnum(Data3 encoded)
    internal
    pure
    returns (uint256 myEnum)
  {
    assembly {
      myEnum := shr(
        Data3_myEnum_bitsAfter,
        encoded
      )
    }
  }

  function setMyEnum(Data3 old, uint256 myEnum)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      if gt(myEnum, MaxUint3) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_myEnum_maskOut),
        shl(Data3_myEnum_bitsAfter, myEnum)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data3.a coders
//////////////////////////////////////////////////////////////*/

  function getA(Data3 encoded)
    internal
    pure
    returns (uint256 a)
  {
    assembly {
      a := and(
        MaxUint16,
        shr(Data3_a_bitsAfter, encoded)
      )
    }
  }

  function setA(Data3 old, uint256 a)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      if gt(a, MaxUint16) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_a_maskOut),
        shl(Data3_a_bitsAfter, a)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data3.b coders
//////////////////////////////////////////////////////////////*/

  function getB(Data3 encoded)
    internal
    pure
    returns (int256 b)
  {
    assembly {
      b := signextend(
        0x01,
        shr(Data3_b_bitsAfter, encoded)
      )
    }
  }

  function setB(Data3 old, int256 b)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      if xor(b, signextend(1, b)) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_b_maskOut),
        shl(Data3_b_bitsAfter, and(b, MaxInt16))
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data3.c coders
//////////////////////////////////////////////////////////////*/

  function getC(Data3 encoded)
    internal
    pure
    returns (int256 c)
  {
    assembly {
      c := signextend(
        0x03,
        shr(Data3_c_bitsAfter, encoded)
      )
    }
  }

  function setC(Data3 old, int256 c)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      if xor(c, signextend(3, c)) {
        mstore(0, Panic_error_signature)
        mstore(
          Panic_error_offset,
          Panic_arithmetic
        )
        revert(0, Panic_error_length)
      }
      updated := or(
        and(old, Data3_c_maskOut),
        shl(Data3_c_bitsAfter, and(c, MaxInt32))
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data3.d coders
//////////////////////////////////////////////////////////////*/

  function getD(Data3 encoded)
    internal
    pure
    returns (bool d)
  {
    assembly {
      d := and(
        MaxUint1,
        shr(Data3_d_bitsAfter, encoded)
      )
    }
  }

  function setD(Data3 old, bool d)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      updated := or(
        and(old, Data3_d_maskOut),
        shl(Data3_d_bitsAfter, d)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data3.x coders
//////////////////////////////////////////////////////////////*/

  function getX(Data3 encoded)
    internal
    pure
    returns (bool x)
  {
    assembly {
      x := and(
        MaxUint1,
        shr(Data3_x_bitsAfter, encoded)
      )
    }
  }

  function setX(Data3 old, bool x)
    internal
    pure
    returns (Data3 updated)
  {
    assembly {
      updated := or(
        and(old, Data3_x_maskOut),
        shl(Data3_x_bitsAfter, x)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                    Data3 comparison methods
//////////////////////////////////////////////////////////////*/

  function equals(Data3 a, Data3 b)
    internal
    pure
    returns (bool _equals)
  {
    assembly {
      _equals := eq(a, b)
    }
  }

  function isNull(Data3 a)
    internal
    pure
    returns (bool _isNull)
  {
    _isNull = equals(a, DefaultData3);
  }
}

enum SomeEnum {
  Abc,
  Def,
  Ghi,
  Jkl
}
