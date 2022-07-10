struct Data1 {
  set;

  uint16 a;
  int16 b;
  int32 c;
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