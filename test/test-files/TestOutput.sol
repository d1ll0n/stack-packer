pragma solidity ^0.6.0;

library TestOutput {
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

	struct TestWrapper {
		TestWrapped a;
		TestWrapped b;
		bytes32[3] x;
	}

	function unpackTestWrapper(bytes memory input)
	internal pure returns (TestWrapper memory ret) {
		assembly {
			let ptr := add(input, 32)
			mstore(ret, shr(224, mload(ptr)))
			mstore(add(ret, 32), mload(add(ptr, 4)))
			mstore(add(ret, 64), mload(add(ptr, 36)))
			mstore(add(ret, 96), shr(248, mload(add(ptr, 68))))
			mstore(add(ret, 128), shr(248, mload(add(ptr, 69))))
			mstore(add(ret, 160), shr(224, mload(add(ptr, 70))))
			mstore(add(ret, 192), mload(add(ptr, 74)))
			mstore(add(ret, 224), mload(add(ptr, 106)))
			mstore(add(ret, 256), shr(248, mload(add(ptr, 138))))
			mstore(add(ret, 288), shr(248, mload(add(ptr, 139))))
			mstore(add(ret, 320), mload(add(ptr, 140)))
			mstore(add(ret, 352), mload(add(ptr, 172)))
			mstore(add(ret, 384), mload(add(ptr, 204)))
		}
	}
}