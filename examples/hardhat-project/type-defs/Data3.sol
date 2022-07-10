enum SomeEnum { Abc, Def, Ghi, Jkl}

struct Data3 {
  SomeEnum myEnum;

  uint16 a;
  int16 b;
  int32 c;
  bool d;
  bool x;

  group Abc {
    set;

    a;
    b;
    c;
  }

  group Cba {
    set;

    x;
    b;
    c;
  }
}