module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: [
    "@typescript-eslint",
    "eslint-plugin-sort-imports-es6-autofix"
    // "import"
],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "eslint:recommended",
    // "plugin:import/recommended",
    // "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
    project: "./tsconfig.json",
  },
  rules: {
    // "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    camelcase: [
      "error",
      // { allow: ["Conduit__factory", "EIP1271Wallet__factory"] },
    ],
    // "import/order": [
    //   "error",
    //   {
    //     alphabetize: {
    //       order: "asc",
    //       caseInsensitive: true
    //     },
    //     groups: [
    //       "object",
    //       ["builtin", "external"],
    //       "parent",
    //       "sibling",
    //       "index",
    //       "type",
    //     ],
    //   }
    // ],
    "sort-imports-es6-autofix/sort-imports-es6": ["error", {
      "ignoreCase": true,
      "ignoreMemberSort": false,
      "memberSyntaxSortOrder": ["none", "all", "single", "multiple"],
      // "allowSeparatedGroups": true
    }],
    // "import/order": [
    //   "error",
    //   {
    //     alphabetize: {
    //       order: "asc",
    //     },
    //     // groups: [
    //     //   "object",
    //     //   ["builtin", "external"],
    //     //   "parent",
    //     //   "sibling",
    //     //   "index",
    //     //   "type",
    //     // ],
    //     "newlines-between": "always",
    //   },
    // ],
    "object-shorthand": "error",
    "prefer-const": "error",
    // "sort-imports": ["error", { ignoreDeclarationSort: true }],
  },
  overrides: [{
    files: ["src/**/*.ts"],
    rules: {
      "no-unused-expressions": "off",
      "no-case-declarations": "off",
      "no-use-before-define": "off"
    },
  }, ],
};