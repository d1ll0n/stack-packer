import { ArrayJoinInput, CodeGenFunction } from "../../types";
import { generateFunctionCode, generateInternalLibraryCall } from "../codegen-helpers";

const copyFnDef = (fn: CodeGenFunction) => ({
  ...fn,
  inputs: [...fn.inputs.map(i => ({ ...i }))],
  outputs: [...fn.outputs.map(i => ({ ...i }))],
})

function generateExternalFunction(fn: CodeGenFunction, structStorageName: string, libraryName: string) {
  // const functionName = `test${fn.name.toPascalCase()}`;
  const copyForExternalFunction: CodeGenFunction = {
    ...copyFnDef(fn),
    location: 'external',
    body: []
    // name: functionName
  };
  const copyForLibraryCall: CodeGenFunction = copyFnDef(fn);
  // let structTypeName: string;
  if (fn.internalType === 'setter') {
    copyForExternalFunction.visibility = undefined
  } else if (fn.internalType === 'getter') {
    copyForExternalFunction.visibility = 'view'
  } else {
    return undefined;
  }

  const hasStructInput = fn.inputs[0]?.type.meta === 'struct';
  if (hasStructInput) {
    const { name, definition, type } = copyForLibraryCall.inputs[0]
    // Change library call's struct name to name of storage variable
    copyForLibraryCall.inputs[0].name = structStorageName;
    copyForLibraryCall.inputs[0].definition = definition.replace(name, structStorageName);
    // Remove struct from external function inputs
    copyForExternalFunction.inputs.shift();
  }
  const hasStructOutput = fn.outputs[0]?.type.meta === 'struct';
  if (hasStructOutput) {
    const { name, definition, type } = copyForLibraryCall.inputs[0]
    // structTypeName = (type as AbiStruct).name;
    // Change library call's struct name to name of storage variable
    copyForLibraryCall.outputs[0].name = structStorageName;
    copyForLibraryCall.outputs[0].definition = definition.replace(name, structStorageName);
    // Remove struct from external function outputs
    copyForExternalFunction.outputs.shift();
  }
  // const externalFunctionCode = generateFunctionCode()
  copyForExternalFunction.body = generateInternalLibraryCall(copyForLibraryCall, libraryName);
  return copyForExternalFunction;
}

export function generateExternalCoder(
  functions: CodeGenFunction[],
  structTypeName: string,
  structStorageName: string,
  libraryName: string,
) {
  const code: ArrayJoinInput<string>[] = [];
  const externalFunctions: CodeGenFunction[] = []
  for (const fn of functions) {
    const externalFn = generateExternalFunction(fn, structStorageName, libraryName)
    if (!externalFn) continue;
    code.push('', ...generateFunctionCode(externalFn))
    externalFunctions.push(externalFn)
  }
  const externalCode = [
    // ...generateFileHeader(true, false, [`import "./${libraryName}.sol";`]),
    // '',
    `contract External${libraryName} {`,
    [
      `${structTypeName} internal ${structStorageName};`,
      ...code
    ],
    '}'
  ]
  return {
    externalCode,
    externalFunctions
  }
}
