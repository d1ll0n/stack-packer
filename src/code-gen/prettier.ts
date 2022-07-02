import fs from 'fs';
import path from 'path';
import * as prettier from 'prettier'
import 'prettier-plugin-solidity'

const mandatoryOptions = {
  plugins: ['prettier-plugin-solidity'],
  // Tells prettier to use the solidity plugin
  filepath: "filepath.sol",
}

const defaultOptions = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 50,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  ...mandatoryOptions
}

const tryGetPrettierOptions = () => {
  try {
    const dir = process.cwd();
    const filePath = path.join(dir, '.prettierrc.js');
    if (fs.existsSync(filePath)) {
      const options = require(filePath);
      return {
        ...options,
        ...mandatoryOptions
      };
    }
  } catch (err) {}

  return defaultOptions
}

const options = tryGetPrettierOptions()

export const prettierFormat = (code: string) => prettier.format(code, options)