// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./CoderConstants.sol";


// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

// struct Data2 {
//   uint16 a;
//   int16 b;
//   int32 c;
//   bool d;
// }
type Data2 is uint256;

library Data2Coder {

/*//////////////////////////////////////////////////////////////
                              Data2
//////////////////////////////////////////////////////////////*/

function decode(Data2 encoded) internal pure returns (
	uint256 a,
	int256 b,
	int256 c,
	bool d
) {
	assembly {
		a := shr(Data2_a_bitsAfter, encoded)
		b := signextend(0x01, shr(Data2_b_bitsAfter, encoded))
		c := signextend(0x03, shr(Data2_c_bitsAfter, encoded))
		d := and(MaxUint1, shr(Data2_d_bitsAfter, encoded))
	}
}

/*//////////////////////////////////////////////////////////////
                        Data2 Abc coders
//////////////////////////////////////////////////////////////*/

function setAbc(
	Data2 old,
	uint256 a,
	int256 b,
	int256 c
) internal pure returns (Data2 updated) {
	assembly {
		if or(
			gt(a, MaxUint16),
			or(
				xor(b, signextend(1, b)),
				xor(c, signextend(3, c))
			)
		) {
			mstore(0, Panic_error_signature)
			mstore(Panic_error_offset, Panic_arithmetic)
			revert(0, Panic_error_length)
		}
		updated := or(
			and(old, Data2_Abc_maskOut),
			or(
				shl(Data2_a_bitsAfter, a),
				or(
					shl(Data2_b_bitsAfter, and(b, MaxInt16)),
					shl(Data2_c_bitsAfter, and(c, MaxInt32))
				)
			)
		)
	}
}

/*//////////////////////////////////////////////////////////////
                        Data2 Cba coders
//////////////////////////////////////////////////////////////*/

function setCba(
	Data2 old,
	int256 c,
	int256 b,
	uint256 a
) internal pure returns (Data2 updated) {
	assembly {
		if or(
			xor(c, signextend(3, c)),
			or(
				xor(b, signextend(1, b)),
				gt(a, MaxUint16)
			)
		) {
			mstore(0, Panic_error_signature)
			mstore(Panic_error_offset, Panic_arithmetic)
			revert(0, Panic_error_length)
		}
		updated := or(
			and(old, Data2_Cba_maskOut),
			or(
				shl(Data2_c_bitsAfter, and(c, MaxInt32)),
				or(
					shl(Data2_b_bitsAfter, and(b, MaxInt16)),
					shl(Data2_a_bitsAfter, a)
				)
			)
		)
	}
}

/*//////////////////////////////////////////////////////////////
                         Data2.a coders
//////////////////////////////////////////////////////////////*/

function getA(Data2 encoded) internal pure returns (uint256 a) {
	assembly {
		a := shr(Data2_a_bitsAfter, encoded)
	}
}

function setA(
	Data2 old,
	uint256 a
) internal pure returns (Data2 updated) {
	assembly {
		if gt(a, MaxUint16) {
			mstore(0, Panic_error_signature)
			mstore(Panic_error_offset, Panic_arithmetic)
			revert(0, Panic_error_length)
		}
		updated := or(
			and(old, Data2_a_maskOut),
			shl(Data2_a_bitsAfter, a)
		)
	}
}

/*//////////////////////////////////////////////////////////////
                         Data2.b coders
//////////////////////////////////////////////////////////////*/

function getB(Data2 encoded) internal pure returns (int256 b) {
	assembly {
		b := signextend(0x01, shr(Data2_b_bitsAfter, encoded))
	}
}

function setB(
	Data2 old,
	int256 b
) internal pure returns (Data2 updated) {
	assembly {
		if xor(b, signextend(1, b)) {
			mstore(0, Panic_error_signature)
			mstore(Panic_error_offset, Panic_arithmetic)
			revert(0, Panic_error_length)
		}
		updated := or(
			and(old, Data2_b_maskOut),
			shl(Data2_b_bitsAfter, and(b, MaxInt16))
		)
	}
}

/*//////////////////////////////////////////////////////////////
                         Data2.c coders
//////////////////////////////////////////////////////////////*/

function getC(Data2 encoded) internal pure returns (int256 c) {
	assembly {
		c := signextend(0x03, shr(Data2_c_bitsAfter, encoded))
	}
}

/*//////////////////////////////////////////////////////////////
                         Data2.d coders
//////////////////////////////////////////////////////////////*/

function getD(Data2 encoded) internal pure returns (bool d) {
	assembly {
		d := and(MaxUint1, shr(Data2_d_bitsAfter, encoded))
	}
}

function setD(
	Data2 old,
	bool d
) internal pure returns (Data2 updated) {
	assembly {
		updated := or(
			and(old, Data2_d_maskOut),
			shl(Data2_d_bitsAfter, d)
		)
	}
}
}