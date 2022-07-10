struct Data2 {
  get;

  uint16 a;
  int16 b;
  int32 c { get; };
  bool d;

  group Abc {
    set;

    a;
    b;
    c;
  }

  group Cba {
    set;

    c;
    b;
    a;
  }
}