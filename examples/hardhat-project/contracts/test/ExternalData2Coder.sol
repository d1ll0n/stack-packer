// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../types/Data2Coder.sol";


// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

contract ExternalData2Coder {
	Data2 internal _data2;

	function decode(
	) external view returns (
		uint256 a,
		int256 b,
		int256 c,
		bool d
	) {
		(
			a,
			b,
			c,
			d
		) = Data2Coder.decode(_data2);
	}

	function setAbc(
		uint256 a,
		int256 b,
		int256 c
	) external {
		(_data2) = Data2Coder.setAbc(
			_data2,
			a,
			b,
			c
		);
	}

	function setCba(
		int256 c,
		int256 b,
		uint256 a
	) external {
		(_data2) = Data2Coder.setCba(
			_data2,
			c,
			b,
			a
		);
	}

	function getA(
	) external view returns (uint256 a) {
		(a) = Data2Coder.getA(_data2);
	}

	function setA(uint256 a) external {
		(_data2) = Data2Coder.setA(
			_data2,
			a
		);
	}

	function getB(
	) external view returns (int256 b) {
		(b) = Data2Coder.getB(_data2);
	}

	function setB(int256 b) external {
		(_data2) = Data2Coder.setB(
			_data2,
			b
		);
	}

	function getC(
	) external view returns (int256 c) {
		(c) = Data2Coder.getC(_data2);
	}

	function getD(
	) external view returns (bool d) {
		(d) = Data2Coder.getD(_data2);
	}

	function setD(bool d) external {
		(_data2) = Data2Coder.setD(
			_data2,
			d
		);
	}
}