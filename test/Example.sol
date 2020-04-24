pragma solidity ^0.6.0;

library Example {
  enum ABC { a, b }
  
  struct ExampleWrapped {
    uint32 a;
    bytes32 b;
    bytes32 c;
    uint8 d;
    ABC e;
  }

  struct ExampleWrapper {
    ExampleWrapped a;
    ExampleWrapped b;
    bytes32[3] x;
  }
}