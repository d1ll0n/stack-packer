// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '../types/Data1Coder.sol';

// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

contract ExternalData1Coder {
  Data1 internal _data1;

  function encode(
    uint256 a,
    int256 b,
    int256 c,
    bool d
  ) external {
    (_data1) = Data1Coder.encode(a, b, c, d);
  }

  function setAbc(
    uint256 a,
    int256 b,
    int256 c
  ) external {
    (_data1) = Data1Coder.setAbc(_data1, a, b, c);
  }

  function setCba(
    int256 c,
    int256 b,
    uint256 a
  ) external {
    (_data1) = Data1Coder.setCba(_data1, c, b, a);
  }

  function getA()
    external
    view
    returns (uint256 a)
  {
    (a) = Data1Coder.getA(_data1);
  }

  function setA(uint256 a) external {
    (_data1) = Data1Coder.setA(_data1, a);
  }

  function getB()
    external
    view
    returns (int256 b)
  {
    (b) = Data1Coder.getB(_data1);
  }

  function setB(int256 b) external {
    (_data1) = Data1Coder.setB(_data1, b);
  }

  function getC()
    external
    view
    returns (int256 c)
  {
    (c) = Data1Coder.getC(_data1);
  }

  function setC(int256 c) external {
    (_data1) = Data1Coder.setC(_data1, c);
  }

  function getD() external view returns (bool d) {
    (d) = Data1Coder.getD(_data1);
  }

  function setD(bool d) external {
    (_data1) = Data1Coder.setD(_data1, d);
  }
}
