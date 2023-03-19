import fs from "fs";
import path from "path";
import * as prettier from "prettier";
import "prettier-plugin-solidity";

const mandatoryOptions = {
  plugins: ["prettier-plugin-solidity"],
  // Tells prettier to use the solidity plugin
  filepath: "filepath.sol",
};

const defaultOptions = {
  semi: true,
  trailingComma: "all",
  singleQuote: true,
  printWidth: 70,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  // ...mandatoryOptions
};

const tryGetPrettierOptions = () => {
  try {
    const dir = process.cwd();
    const filePath = path.join(dir, ".prettierrc.js");
    if (fs.existsSync(filePath)) {
      const options = require(filePath);
      if (typeof options === "object") {
        return options;
      }
      // return {
      //   ...options,
      //   ...mandatoryOptions
      // };
    }
  } catch (err) {
    return {};
  }
  return {};
  // return defaultOptions;
};

let options = {
  ...defaultOptions,
  ...tryGetPrettierOptions(),
  ...mandatoryOptions,
};
/* 
const options = {
  ...defaultOptions,
  ...(tryGetPrettierOptions())
}
 */
export const prettierFormat = (code: string) => {
  try {
    return prettier.format(code, options);
  } catch {
    options = { ...defaultOptions, ...mandatoryOptions };
    return prettier.format(code, options);
  }
};
