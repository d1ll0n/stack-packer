interface String {
  toPascalCase() : string;
}

String.prototype.toPascalCase = function () {
  return this[0].toUpperCase().concat(this.slice(1));
};