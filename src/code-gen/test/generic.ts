import { ArrayJoinInput, CodeGenFunction, ProcessedField, ProcessedStruct } from "../../types"

export type TestValueKind = 'overflow' | 'underflow' | 'max' | 'min'

export type SupportedElementaryTypes = 'address' | 'uint' | 'int' | 'bool'

export type ElementaryValuesGetter = {
  [key in SupportedElementaryTypes]: {
    [key in TestValueKind]: (size: number) => string
  }
}

export type LanguageExpressions = {
  getCallWithAssignment: (
    fn: CodeGenFunction,
    inputs: string[],
    outputs: string[]
  ) => ArrayJoinInput<string>;
}

export type GetterFn = () => ArrayJoinInput<string>
export type SetterFn = (values: string[], defaultValueKind: TestValueKind) => ArrayJoinInput<string>;

// function findGetterOrSetterForFields(
//   struct: ProcessedStruct,
//   fields: ProcessedField[],
//   fn: CodeGenFunction,
//   contractName: string,
//   type: 'getter'
// ): GetterFn;
// function findGetterOrSetterForFields(
//   struct: ProcessedStruct,
//   fields: ProcessedField[],
//   fn: CodeGenFunction,
//   contractName: string,
//   type: 'setter'
// ): SetterFn;
// function findGetterOrSetterForFields(
//   struct: ProcessedStruct,
//   fields: ProcessedField[],
//   fn: CodeGenFunction,
//   contractName: string,
//   type: 'getter' | 'setter'
// ): GetterFn | SetterFn;
type getter = 'getter'
type setter = 'setter'
export type GetterOrSetter = getter | setter


export class TestEnvironment {
  public elementaryValuesGetter: ElementaryValuesGetter;
  protected getCallWithAssignment?(
    contactName: string,
    fn: string,
    inputs: string[],
    outputs: string[]
  ): ArrayJoinInput<string>;

  constructor(
    elementaryValuesGetter: ElementaryValuesGetter,
    // getCallWithAssignment: (
    //   contactName: string,
    //   fn: string,
    //   inputs: string[],
    //   outputs: string[]
    // ) => ArrayJoinInput<string>
  ) {
    this.elementaryValuesGetter = elementaryValuesGetter
    // this.getCallWithAssignment = getCallWithAssignment.bind(this)
  }

  getFieldValue = (field: ProcessedField, kind: TestValueKind) => {
    if (field.type.meta === 'elementary') {
      if (field.type.type === 'byte' || field.type.type === 'bytes') {
        throw Error('bytes not supported for automatic testing yet')
      }
      return this.elementaryValuesGetter[field.type.type][kind](field.type.size);
    }
    if (field.type.meta === 'enum') {
      return this.elementaryValuesGetter.uint[kind](field.type.size);
    }
  }

  findGetterOrSetterForFields(
    struct: ProcessedStruct,
    fields: ProcessedField[],
    fn: CodeGenFunction,
    contractName: string,
    type: getter
  ): GetterFn;
  findGetterOrSetterForFields(
    struct: ProcessedStruct,
    fields: ProcessedField[],
    fn: CodeGenFunction,
    contractName: string,
    type: setter
  ): SetterFn;
  findGetterOrSetterForFields(
    struct: ProcessedStruct,
    fields: ProcessedField[],
    fn: CodeGenFunction,
    contractName: string,
    type: GetterOrSetter
  ): GetterFn | SetterFn {
    const group = struct.groups.find(g => `${type === 'getter' ? 'get' : 'set'}${g.name.toPascalCase()}` === fn.name);
    const generateParamName = `generate${type.toPascalCase()}`
    const usableStruct = struct[generateParamName] && struct;
    const usableGroup = group ? (group[generateParamName] && group) : (
      struct.groups.find(g => {
        const groupFields = g.fields.map(f => f.name);
        return g[generateParamName] && !(fields.some(f => !groupFields.includes(f.name)))
      })
    );
    const canUseFields = !(fields.some((f) => !f[generateParamName]));
    if (!(usableStruct || usableGroup || canUseFields)) {
      return undefined
    }
  
    const refObj = usableStruct || usableGroup;
    const getCallWithAssignment = this.getCallWithAssignment;
    const _getCallWithAssignment = (_fn: string, inputs: string[], outputs: string[]) => getCallWithAssignment(contractName, _fn, inputs, outputs)
    if (!refObj) {
      // Global/group functions won't help us get/set the values we need
      // Must use field setters
      if (type === 'getter') {
        return () => {
          return fields.map((field, i) => _getCallWithAssignment(field.getterName, [], [field.name]))
          //`const ${field.name} = await ${contractName}.${field.getterName}()`);
        }
      } else {
        return (values: string[], defaultValueKind: TestValueKind) => {
          return fields.map((field, i) => _getCallWithAssignment(field.setterName, [values[i]], []))
          // return fields.map((field, i) => `await ${contractName}.${field.setterName}(${values[i]})`);
        }
      }
    }
    if (type === 'getter') {
      return () => {
        return _getCallWithAssignment(refObj.getterName, [], fields.map(f => f.name))
        // return [`const { ${fields.map(f => f.name).join(", ")} } = await ${contractName}.${refObj.getterName}()`]
      }
    } else {
      return (values: string[], defaultValueKind: TestValueKind) => {
        const fieldsToValues = fields.reduce(
          (obj, field, i) => ({ ...obj, [field.name]: values[i] }),
          {}
        );
        const allValues = refObj.fields.map((field) => {
          return fieldsToValues[field.name] || this.getFieldValue(field, defaultValueKind)
        });
        return _getCallWithAssignment(refObj.setterName, allValues, [])
        // return [`await ${contractName}.${refObj.setterName}(${allValues.join(", ")})`];
      }
    }
  }
}