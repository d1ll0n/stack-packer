module.exports = {
  toUpperCase: function (text) {
    return text.toUpperCase();
  },
  ternary: function(condition, valueIfTrue, valueIfFalse) {
    return condition ? valueIfTrue : valueIfFalse;
  },
  pointersList: function (count, baseTypeSize) {
    const { count, baseTypeSize } = {count: 5, baseTypeSize: 1};
    const tailOffset = 32 * i;
    return new Array(count).fill(null).map((_, i) => ({
      headOffset: i * 32,
      tailOffset: tailOffset + baseTypeSize * i
    }))
  },
  eachitem: function (context, options) {
    var ret = "";

    for (var i = 0, j = context.length; i < j; i++) {
      ret = ret + options.fn(context[i]);
    }
  
    return ret;
  }
}