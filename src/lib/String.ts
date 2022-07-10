interface String {
  toPascalCase() : string;
  toCamelCase() : string;
}

String.prototype.toPascalCase = function () {
  return this[0].toUpperCase().concat(this.slice(1));
};

String.prototype.toCamelCase = function() {
  return this[0].toLowerCase().concat(this.slice(1));
}