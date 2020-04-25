pragma solidity ^0.6.0;

library TestOutputVerbose {
	enum ABC { a, b }

	struct TestWrapped {
		uint32 a;
		bytes32 b;
		bytes32 c;
		uint8 d;
		ABC e;
	}

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

	struct TestWrapper {
		TestWrapped a;
		TestWrapped b;
		bytes32[3] x;
	}

	function unpackTestWrapper(bytes memory input)
	internal pure returns (TestWrapper memory) {
		uint32 a_a;
		bytes32 a_b;
		bytes32 a_c;
		uint8 a_d;
		ABC a_e;
		uint32 b_a;
		bytes32 b_b;
		bytes32 b_c;
		uint8 b_d;
		ABC b_e;
		bytes32[3] memory x;
		assembly {
			let ptr := add(input, 32)
			a_a := shr(224, mload(ptr))
			a_b := mload(add(ptr, 4))
			a_c := mload(add(ptr, 36))
			a_d := shr(248, mload(add(ptr, 68)))
			a_e := shr(248, mload(add(ptr, 69)))
			b_a := shr(224, mload(add(ptr, 70)))
			b_b := mload(add(ptr, 74))
			b_c := mload(add(ptr, 106))
			b_d := shr(248, mload(add(ptr, 138)))
			b_e := shr(248, mload(add(ptr, 139)))
			mstore(x, mload(add(ptr, 140)))
			mstore(add(x, 32), mload(add(ptr, 172)))
			mstore(add(x, 64), mload(add(ptr, 204)))
		}
		return TestWrapper(TestWrapped(a_a, a_b, a_c, a_d, a_e), TestWrapped(b_a, b_b, b_c, b_d, b_e), x);
	}
}