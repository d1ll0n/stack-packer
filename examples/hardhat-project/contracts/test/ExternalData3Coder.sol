// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import '../types/Data3Coder.sol';

// ============================== NOTICE ==============================
// This library was automatically generated with stackpacker.
// Be very careful about modifying it, as doing so incorrectly could
// result in corrupted reads/writes.
// ====================================================================

contract ExternalData3Coder {
  Data3 internal _data3;

  function decode()
    external
    view
    returns (
      uint256 myEnum,
      uint256 a,
      int256 b,
      int256 c,
      bool d,
      bool x
    )
  {
    (myEnum, a, b, c, d, x) = Data3Coder.decode(
      _data3
    );
  }

  function encode(
    uint256 myEnum,
    uint256 a,
    int256 b,
    int256 c,
    bool d,
    bool x
  ) external {
    (_data3) = Data3Coder.encode(
      myEnum,
      a,
      b,
      c,
      d,
      x
    );
  }

  function setAbc(
    uint256 a,
    int256 b,
    int256 c
  ) external {
    (_data3) = Data3Coder.setAbc(_data3, a, b, c);
  }

  function setCba(
    bool x,
    int256 b,
    int256 c
  ) external {
    (_data3) = Data3Coder.setCba(_data3, x, b, c);
  }

  function getMyEnum()
    external
    view
    returns (uint256 myEnum)
  {
    (myEnum) = Data3Coder.getMyEnum(_data3);
  }

  function setMyEnum(uint256 myEnum) external {
    (_data3) = Data3Coder.setMyEnum(
      _data3,
      myEnum
    );
  }

  function getA()
    external
    view
    returns (uint256 a)
  {
    (a) = Data3Coder.getA(_data3);
  }

  function setA(uint256 a) external {
    (_data3) = Data3Coder.setA(_data3, a);
  }

  function getB()
    external
    view
    returns (int256 b)
  {
    (b) = Data3Coder.getB(_data3);
  }

  function setB(int256 b) external {
    (_data3) = Data3Coder.setB(_data3, b);
  }

  function getC()
    external
    view
    returns (int256 c)
  {
    (c) = Data3Coder.getC(_data3);
  }

  function setC(int256 c) external {
    (_data3) = Data3Coder.setC(_data3, c);
  }

  function getD() external view returns (bool d) {
    (d) = Data3Coder.getD(_data3);
  }

  function setD(bool d) external {
    (_data3) = Data3Coder.setD(_data3, d);
  }

  function getX() external view returns (bool x) {
    (x) = Data3Coder.getX(_data3);
  }

  function setX(bool x) external {
    (_data3) = Data3Coder.setX(_data3, x);
  }
}
