// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import './CoderConstants.sol';

// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

// struct Data1 {
//   uint16 a;
//   int16 b;
//   int32 c;
//   bool d;
// }
type Data1 is uint256;

Data1 constant DefaultData1 = Data1.wrap(0);

library Data1Coder {
  /*//////////////////////////////////////////////////////////////
                              Data1
//////////////////////////////////////////////////////////////*/

  function encode(
    uint256 a,
    int256 b,
    int256 c,
    bool d
  ) internal pure returns (Data1 encoded) {
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
      encoded := or(
        shl(Data1_a_bitsAfter, a),
        or(
          shl(
            Data1_b_bitsAfter,
            and(b, MaxInt16)
          ),
          or(
            shl(
              Data1_c_bitsAfter,
              and(c, MaxInt32)
            ),
            shl(Data1_d_bitsAfter, d)
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                        Data1 Abc coders
//////////////////////////////////////////////////////////////*/

  function setAbc(
    Data1 old,
    uint256 a,
    int256 b,
    int256 c
  ) internal pure returns (Data1 updated) {
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
        and(old, Data1_Abc_maskOut),
        or(
          shl(Data1_a_bitsAfter, a),
          or(
            shl(
              Data1_b_bitsAfter,
              and(b, MaxInt16)
            ),
            shl(
              Data1_c_bitsAfter,
              and(c, MaxInt32)
            )
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                        Data1 Cba coders
//////////////////////////////////////////////////////////////*/

  function setCba(
    Data1 old,
    int256 c,
    int256 b,
    uint256 a
  ) internal pure returns (Data1 updated) {
    assembly {
      if or(
        xor(c, signextend(3, c)),
        or(
          xor(b, signextend(1, b)),
          gt(a, MaxUint16)
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
        and(old, Data1_Cba_maskOut),
        or(
          shl(
            Data1_c_bitsAfter,
            and(c, MaxInt32)
          ),
          or(
            shl(
              Data1_b_bitsAfter,
              and(b, MaxInt16)
            ),
            shl(Data1_a_bitsAfter, a)
          )
        )
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data1.a coders
//////////////////////////////////////////////////////////////*/

  function getA(Data1 encoded)
    internal
    pure
    returns (uint256 a)
  {
    assembly {
      a := shr(Data1_a_bitsAfter, encoded)
    }
  }

  function setA(Data1 old, uint256 a)
    internal
    pure
    returns (Data1 updated)
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
        and(old, Data1_a_maskOut),
        shl(Data1_a_bitsAfter, a)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data1.b coders
//////////////////////////////////////////////////////////////*/

  function getB(Data1 encoded)
    internal
    pure
    returns (int256 b)
  {
    assembly {
      b := signextend(
        0x01,
        shr(Data1_b_bitsAfter, encoded)
      )
    }
  }

  function setB(Data1 old, int256 b)
    internal
    pure
    returns (Data1 updated)
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
        and(old, Data1_b_maskOut),
        shl(Data1_b_bitsAfter, and(b, MaxInt16))
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data1.c coders
//////////////////////////////////////////////////////////////*/

  function getC(Data1 encoded)
    internal
    pure
    returns (int256 c)
  {
    assembly {
      c := signextend(
        0x03,
        shr(Data1_c_bitsAfter, encoded)
      )
    }
  }

  function setC(Data1 old, int256 c)
    internal
    pure
    returns (Data1 updated)
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
        and(old, Data1_c_maskOut),
        shl(Data1_c_bitsAfter, and(c, MaxInt32))
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                         Data1.d coders
//////////////////////////////////////////////////////////////*/

  function getD(Data1 encoded)
    internal
    pure
    returns (bool d)
  {
    assembly {
      d := and(
        MaxUint1,
        shr(Data1_d_bitsAfter, encoded)
      )
    }
  }

  function setD(Data1 old, bool d)
    internal
    pure
    returns (Data1 updated)
  {
    assembly {
      updated := or(
        and(old, Data1_d_maskOut),
        shl(Data1_d_bitsAfter, d)
      )
    }
  }

  /*//////////////////////////////////////////////////////////////
                    Data1 comparison methods
//////////////////////////////////////////////////////////////*/

  function equals(Data1 a, Data1 b)
    internal
    pure
    returns (bool _equals)
  {
    assembly {
      _equals := eq(a, b)
    }
  }

  function isNull(Data1 a)
    internal
    pure
    returns (bool _isNull)
  {
    _isNull = equals(a, DefaultData1);
  }
}
