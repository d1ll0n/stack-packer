import { getMaxUint } from "../../lib/bytes";
import { arrJoiner, removeTrailingNewLines } from "../../lib/text";
import {
  ArrayJoinInput,
  CodeGenFunction,
  ProcessedField,
  ProcessedStruct,
} from "../../types";
import { shouldCheckForOverflow } from "../stack-packer/rules";

import {
  TestValueKind,
  ElementaryValuesGetter,
  TestEnvironment,
} from "./generic";

const HardhatElementaryValues: ElementaryValuesGetter = {
  address: {
    min: (size: number) => `"0x${"00".repeat(20)}"`,
    max: (size: number) => `"0x${"ff".repeat(20)}"`,
    overflow: (size: number) => `"0x${"ff".repeat(21)}"`,
    underflow: (size: number) => undefined,
    // nonZero: (index: number) => `0x${toHex(index).padStart(40, '0')}`
  },
  uint: {
    min: (size: number) => `"0x00"`,
    max: (size: number) => `"${getMaxUint(size)}"`,
    overflow: (size: number) => `"${getMaxUint(size + 1)}"`,
    underflow: (size: number) => undefined,
    // underflow: (size: number) => undefined,
  },
  int: {
    min: (size: number) => `"-0x${`80${"00".repeat(size / 8 - 1)}`}"`,
    max: (size: number) => `"0x7f${"ff".repeat(size / 8 - 1)}"`,
    overflow: (size: number) => HardhatElementaryValues.int.max(size + 8),
    underflow: (size: number) => HardhatElementaryValues.int.min(size + 8),
  },
  bool: {
    min: (size: number) => "false",
    max: (size: number) => "true",
    overflow: (size: number) => undefined,
    underflow: (size: number) => undefined,
  },
  /*   bytes: {
    min: (size: number) => `0x${}`
  } */
};

class FoundryTestEnvironment extends TestEnvironment {
  constructor() {
    super(HardhatElementaryValues);
  }

  public getCallWithAssignment(
    contactName: string,
    fn: string,
    inputs: string[],
    outputs: string[]
  ): ArrayJoinInput<string> {
    const leftHandSide = outputs.length
      ? outputs.length === 1
        ? `const ${outputs[0]} = `
        : `const { ${outputs.join(", ")} } = `
      : "";
    return `${leftHandSide}await ${contactName}.${fn}(${inputs.join(", ")});`;
  }
}

const _env = new FoundryTestEnvironment();
const getFieldValue = (field: ProcessedField, kind: TestValueKind) =>
  _env.getFieldValue(field, kind);

// type TestGetSet = {
//   nameOrSummary: string;
//   setCalls: { fn: string; inputs: string[] }[];
//   getCalls: { fn: string; outputs: string[] }[];
//   expectValues: Record<string, string>;
// };

const _generateCall = (
  contractName: string,
  fn: { name: string },
  args: string[]
) => `${contractName}.${fn.name}(${args.join(", ")})`;
const generateIt = (name: string, code: ArrayJoinInput<string>[]) => [
  `it('${name}', async () => {`,
  code,
  "});",
];
const _getOverflowTest = (
  contractName: string,
  fn: { name: string },
  args: string[],
  field: ProcessedField
) =>
  generateIt(`Reverts when ${field.name} overflows`, [
    `await expect(`,
    _generateCall(contractName, fn, args),
    ').to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");',
  ]);

const _getUnderflowTest = (
  contractName: string,
  fn: { name: string },
  args: string[],
  field: ProcessedField
) =>
  generateIt(`Reverts when ${field.name} underflows`, [
    `await expect(`,
    _generateCall(contractName, fn, args),
    ').to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");',
  ]);

const getMinMaxValues = (fields: ProcessedField[]) => {
  const minValues = fields.map((field) => getFieldValue(field, "min"));
  const maxValues = fields.map((field) => getFieldValue(field, "max"));
  return {
    minValues,
    maxValues,
  };
};

const getSetterTest = (
  testName: string,
  fields: ProcessedField[],
  setterCode: ArrayJoinInput<string>,
  getterCode: ArrayJoinInput<string>,
  values: string[]
) =>
  generateIt(testName, [
    // `await ${getSetter(values)};`,
    ...setterCode,
    ...getterCode,
    ...fields.map((field, i) => `expect(${field.name}).to.eq(${values[i]});`),
  ]);

export function generateFoundryTestForFunction(
  struct: ProcessedStruct,
  fn: CodeGenFunction,
  libraryName: string
) {
  const contractName = `external${libraryName}`;
  const testCode: ArrayJoinInput<string>[] = [];
  const generateCall = (args: string[]) =>
    _generateCall(contractName, fn, args);
  const getOverflowTest = (args: string[], field: ProcessedField) =>
    _getOverflowTest(contractName, fn, args, field);
  const getUnderflowTest = (args: string[], field: ProcessedField) =>
    _getUnderflowTest(contractName, fn, args, field);

  const fields =
    fn.internalType === "getter" ? fn.outputFields : fn.inputFields;
  const { minValues, maxValues } = getMinMaxValues(fields);

  const minMax = minValues.map((f, i) => (i % 2 ? minValues[i] : maxValues[i]));
  const maxMin = minValues.map((f, i) => (i % 2 ? maxValues[i] : minValues[i]));
  if (fn.internalType === "setter") {
    for (let i = 0; i < fields.length; i++) {
      const inputs = [...minValues];
      const field = fields[i];
      if (shouldCheckForOverflow(field)) {
        inputs[i] = getFieldValue(field, "overflow");
        testCode.push(getOverflowTest(inputs, field), "");
        if (field.type.meta === "elementary" && field.type.type === "int") {
          inputs[i] = getFieldValue(field, "underflow");
          testCode.push(getUnderflowTest(inputs, field), "");
        }
      }
    }
    const getGetter = _env.findGetterOrSetterForFields(
      struct,
      fields,
      fn,
      contractName,
      "getter"
    );
    if (!getGetter) {
      console.log(
        `Could not find a way to get all fields updated by ${fn.name}`
      );
      return undefined;
    }
    const getterCode = getGetter([], "max");
    const testSetMinMax = getSetterTest(
      `Should be able to set ${
        fields.length === 1 ? "min value" : "min/max values"
      }`,
      fields,
      [generateCall(minMax)],
      getterCode,
      minMax
    );
    testCode.push(testSetMinMax, "");
    const testSetMaxMin = getSetterTest(
      `Should be able to set ${
        fields.length === 1 ? "max value" : "max/min values"
      }`,
      fields,
      [generateCall(maxMin)],
      getterCode,
      maxMin
    );
    testCode.push(testSetMaxMin, "");
  } else {
    const destructuredDecodeParams =
      fn.outputFields.length > 1
        ? `{ ${fn.outputFields.map((f) => f.name).join(", ")} }`
        : `${fn.outputFields[0].name}`;
    const getterCode = [
      `const ${destructuredDecodeParams} = await ${contractName}.${fn.name}()`,
    ];

    const getSetter = _env.findGetterOrSetterForFields(
      struct,
      fields,
      fn,
      contractName,
      "setter"
    );
    if (!getSetter) {
      console.log(`Could not find way to set all fields queried by ${fn.name}`);
      return undefined;
    }

    const testGetMinMax = getSetterTest(
      `Should be able to get ${
        fields.length === 1 ? "min value" : "min/max values"
      }`,
      fields,
      getSetter(minMax, "min"),
      getterCode,
      minMax
    );
    testCode.push(testGetMinMax, "");
    const testGetMaxMin = getSetterTest(
      `Should be able to get ${
        fields.length === 1 ? "max value" : "max/min values"
      }`,
      fields,
      getSetter(maxMin, "max"),
      getterCode,
      maxMin
    );
    testCode.push(testGetMaxMin, "");
  }

  if (!testCode.length) return;
  removeTrailingNewLines(testCode);
  return [`describe('${fn.name}', () => {`, ...testCode, "})"];
}

export function generateFoundryTest(
  struct: ProcessedStruct,
  functions: CodeGenFunction[],
  libraryName: string
) {
  const fnTests: ArrayJoinInput<string>[] = [];
  for (const fn of functions) {
    const code = generateFoundryTestForFunction(struct, fn, libraryName);
    if (code) fnTests.push(...code, "");
  }
  removeTrailingNewLines(fnTests);
  // const fnTests = functions.map(fn => generateFoundryTestForFunction(fn, libraryName)).filter(Boolean);
  const contractName = `external${libraryName}`;
  const testFile = [
    `import { ethers } from 'hardhat';`,
    `import { expect } from "chai";`,
    "",
    `describe('${libraryName}Coder.sol', () => {`,
    [
      `let ${contractName}: any;`,
      "",
      `before(async () => {`,
      [
        `const Factory = await ethers.getContractFactory('External${libraryName}Coder');`,
        `${contractName} = await Factory.deploy();`,
      ],
      "})",
      "",
      ...fnTests,
    ],
    "})",
  ];
  return arrJoiner(testFile);
}
