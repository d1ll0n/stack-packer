/* eslint-disable no-dupe-class-members */
/* eslint-disable no-useless-constructor */
import { arrJoiner } from "../../lib/text";
import { compileSolFunction } from "../../ast-rewriter/compile";
import { getInputGetterFunctionName } from "../../tables/function-io";
import { toHex } from "../../lib/bytes";

import {
  AbiArray,
  AbiEnum,
  AbiFunction,
  AbiStruct,
  AbiType,
  ArrayJoinInput,
  Include,
} from "../../types";
import { cloneDeep, findIndex } from "lodash";
import {
  combineSequentialCopies,
  combineSequentialDynamicCopies,
  PendingCopy,
  PendingDynamicCopy,
  PendingDynamicPointer,
  PendingPointer,
} from "./utils";
import { expressionGte, expressionLt } from "../../ast-rewriter/yul/mathjs";
import {
  extractTypes,
  getHighLevelTypeString,
  getParamDefinition,
  isReferenceType,
  isValueType,
  maxReferenceTypeDepth,
  toTypeName,
} from "../../type-utils";
import {
  isConstant,
  makeYulIdentifier,
  makeYulLiteral,
  resolveConstantValue,
  YulBlock,
  YulExpression,
  YulFunctionDefinition,
  YulIdentifier,
} from "../../ast-rewriter/yul";

export class FixedReferenceTypeProcessor {
  currentCdOffset: number;
  pointers: PendingPointer[] = [];
  copies: PendingCopy[] = [];

  constructor(
    public memoryTailOffset: number,
    public name = "",
    public typeScopeName = ""
  ) {
    this.currentCdOffset = 0;
  }

  addPtr(dst: number, value: number, name?: string) {
    this.pointers.push({ dst, value, name });
  }

  addPtrAuto(type: AbiType, _name: string = toTypeName(type)) {
    const name = [this.name, _name].filter(Boolean).join(".");
    this.addPtr(type.memoryHeadOffset, this.memoryTailOffset, name);
  }

  addCopy(type: AbiType, _name: string = toTypeName(type)) {
    const name = [this.name, _name].filter(Boolean).join(".");
    const writeToTail = isReferenceType(type);
    const dst = writeToTail ? this.memoryTailOffset : type.memoryHeadOffset;
    this.copies.push({
      dst,
      src: type.calldataHeadOffset,
      size: type.calldataHeadSize,
      names: [name],
    });
    if (writeToTail) {
      this.memoryTailOffset += type.calldataHeadSize;
    }
  }

  static process(
    type: AbiStruct | AbiArray,
    name?: string,
    typeScopeName?: string
  ): FixedReferenceTypeProcessor {
    return FixedReferenceTypeProcessor[`process${type.meta.toPascalCase()}`](
      type,
      name,
      typeScopeName
    );
  }

  static getAST(
    block: YulBlock,
    type: AbiStruct | AbiArray,
    name: string,
    internalFunction: boolean,
    _cdPtr: number | YulExpression,
    _mPtr?: YulExpression,
    returnFn?: boolean
  ) {
    const loadMemoryPointer = _mPtr === undefined;
    const constantCdPtr = isConstant(_cdPtr);
    // const inputMPtr = _mPtr
    // const mPtr = _mPtr ?? makeYulIdentifier(`mPtr`);
    const mPtrId = makeYulIdentifier(`mPtr`);
    // If internal fn, use id and call with input mPtr
    // Otherwise, use input mPtr if given
    const mPtr = internalFunction ? mPtrId : _mPtr ?? mPtrId;
    const cdPtr = constantCdPtr
      ? makeYulLiteral(resolveConstantValue(_cdPtr, false))
      : makeYulIdentifier(`cdPtr`);

    let body = block;
    let fn: YulFunctionDefinition;
    if (internalFunction) {
      fn = block.addFunction(
        `abi_decode_${getHighLevelTypeString(type)}`,
        [],
        []
      );

      body = fn.body;
      if (!constantCdPtr) fn.parameters.push(cdPtr as YulIdentifier);
      if (loadMemoryPointer) fn.returnVariables.push(mPtrId as YulIdentifier);
      else fn.parameters.push(mPtrId as YulIdentifier);
    }
    if (loadMemoryPointer) {
      body.set(mPtrId, makeYulLiteral(64).mload());
    }
    const decoder = this.process(type, name, toTypeName(type));
    const ptrs: PendingDynamicPointer[] = cloneDeep(decoder.pointers)
      .sort((a, b) => a.dst - b.dst)
      .map((ptr) => ({
        dst: mPtr.smartAdd(ptr.dst),
        value: mPtr.smartAdd(ptr.value),
        name: ptr.name,
      }));
    const copies: PendingDynamicCopy[] = combineSequentialDynamicCopies(
      decoder.copies.map((copy) => ({
        dst: mPtr.smartAdd(copy.dst),
        src: cdPtr.smartAdd(copy.src),
        size: makeYulLiteral(copy.size),
        names: [...copy.names],
      }))
    );
    ptrs.forEach((ptr) => {
      const copyThatWouldOverwrite = findIndex(copies, ({ dst, size }) => {
        return (
          expressionGte(ptr.dst, dst) === 1 &&
          expressionLt(ptr.dst, dst.smartAdd(size)) === 1
        );
      });
      if (copyThatWouldOverwrite > -1) {
        const [{ src, dst, size, names }] = copies.splice(
          copyThatWouldOverwrite,
          1
        );
        const copy = dst.calldatacopy(src, size);
        if (names && names.length) {
          copy.documentation = [`Copy data for ${names.join(",")}`];
          if (ptr.name) {
            copy.documentation.push(
              `Copy first because it will write to the same position as the ptr to ${ptr.name}`
            );
          }
        }
        body.appendChild(copy);
      }
      const { dst, value, name } = ptr;
      const expr = dst.mstore(value);
      if (name) {
        expr.documentation = `Write pointer for ${name}`;
      }
      body.appendChild(expr);
    });
    copies.forEach(({ src, dst, size, names }) => {
      const copy = dst.calldatacopy(src, size);
      if (names && names.length) {
        copy.documentation = `// Copy data for ${names.join(",")}`;
      }
      // const ref = dst === 0 ? `ptr` : `add(ptr, ${toHex(dst)})`;
      // outCode.push(`calldatacopy(${ref}, ${toHex(src)}, ${toHex(size)})`);
      body.appendChild(copy);
    });
    if (loadMemoryPointer) {
      body.appendChild(mPtr.mstore(mPtr.smartAdd(decoder.memoryTailOffset)));
    }

    if (internalFunction) {
      if (returnFn) return fn;
      const args = [
        ...(constantCdPtr ? [] : [_cdPtr as YulExpression]),
        ...(loadMemoryPointer ? [] : [_mPtr]),
      ];
      block.appendChild(fn.call(args));
    }
  }

  static async processFunctionInput(type: AbiFunction) {
    const fnName = getInputGetterFunctionName(type);
    const outputs = type.input.fields.map((field) =>
      getParamDefinition(field, "calldata")
    );
    const outCode: ArrayJoinInput[] = [`let ptr := mload(0x40)`];
    const offsetPtr = (offset: number) =>
      offset === 0 ? `ptr` : `add(ptr, ${toHex(offset)})`;

    type.input.fields.forEach((field) => {
      if (isReferenceType(field.type)) {
        outCode.push(
          `${field.name} := ${offsetPtr(field.type.memoryHeadOffset)}`
        );
      } else {
        outCode.push(
          `${field.name} := calldataload(${field.type.calldataHeadOffset + 4})`
        );
      }
    });

    const decoder = this.processStruct(type.input, undefined, "", true);
    const ptrs = cloneDeep(decoder.pointers).sort((a, b) => a.dst - b.dst);
    console.log(`Uncombined Copies: ${decoder.copies.length}`);
    const copies = combineSequentialCopies(cloneDeep(decoder.copies));
    console.log(`Combined Copies: ${copies.length}`);
    copies.forEach((copy) => ({ ...copy, src: copy.src + 4 }));

    ptrs.forEach((ptr) => {
      const copyThatWouldOverwrite = findIndex(copies, ({ dst, size }) => {
        return ptr.dst >= dst && ptr.dst <= dst + size;
      });
      if (copyThatWouldOverwrite > -1) {
        const [{ src, dst, size, names }] = copies.splice(
          copyThatWouldOverwrite,
          1
        );
        const ref = dst === 0 ? `ptr` : `add(ptr, ${toHex(dst)})`;
        if (names && names.length) {
          outCode.push(`// Copy data for ${names.join(",")}`);
          if (ptr.name) {
            outCode.push(
              `// Copy first because it will write to the same position as the ptr to ${ptr.name}`
            );
          }
        }
        outCode.push(`calldatacopy(${ref}, ${toHex(src)}, ${toHex(size)})`);
      }
      const { dst, value, name } = ptr;
      const ref = dst === 0 ? `ptr` : `add(ptr, ${toHex(dst)})`;
      const val = value === 0 ? `ptr` : `add(ptr, ${toHex(value)})`;
      if (name) {
        outCode.push(`// Write pointer for ${name}`);
      }
      outCode.push(`mstore(${ref}, ${val})`);
    });
    copies.forEach(({ src, dst, size, names }) => {
      if (names && names.length) {
        outCode.push(`// Copy data for ${names.join(",")}`);
      }
      const ref = dst === 0 ? `ptr` : `add(ptr, ${toHex(dst)})`;
      outCode.push(`calldatacopy(${ref}, ${toHex(src)}, ${toHex(size)})`);
    });
    outCode.push(`mstore(0x40, add(ptr, ${toHex(decoder.memoryTailOffset)}))`);

    const fnCode = arrJoiner([
      `function ${fnName}() pure returns (${outputs}) {`,
      [`assembly {`, outCode, "}"],
      `}`,
    ]);

    const extractTypeDependencies = (type: AbiType<false, false, true>) => {
      const arr: (AbiStruct | AbiEnum)[] = [];
      switch (type.meta) {
        case "array":
          arr.push(...extractTypeDependencies(type.baseType));
          break;
        case "enum":
          arr.push(type);
          break;
        case "struct":
          arr.push(type);
          type.fields.forEach((field) => {
            arr.push(...extractTypeDependencies(field.type));
          });
          break;
        case "function":
          type.input.fields.forEach((field) => {
            arr.push(...extractTypeDependencies(field.type));
          });
      }
      const uniqueTypes = new Set<string>();
      return arr.filter((type) => {
        if (uniqueTypes.has(type.name)) {
          return false;
        }
        uniqueTypes.add(type.name);
        return true;
      });
    };

    const typeDependencies = extractTypeDependencies(type);

    const functionAST = await compileSolFunction(fnCode, typeDependencies);

    return {
      functionAST,
      fnCode,
      decoder,
    };
  }

  protected static processArray(
    array: AbiArray,
    name: string = toTypeName(array),
    typeScopeName = toTypeName(array)
  ) {
    const decoder = new FixedReferenceTypeProcessor(
      array.memberHeadSizeMemory,
      name
    );
    const { baseType } = array;
    if (isValueType(baseType)) {
      decoder.addCopy(array, "");
      return;
    }
    const baseDecoder = FixedReferenceTypeProcessor.process(
      baseType as AbiStruct | AbiArray,
      `${name}[x]`
    );
    if (baseDecoder.memoryTailOffset !== baseType.memoryTailSize) {
      throw Error(
        `Decoder ${toTypeName(
          baseType
        )} Error: offset != baseType tailSize | Decoder ${
          baseDecoder.memoryTailOffset
        } vs baseType ${baseType.memoryTailSize}`
      );
    }
    const headSize = array.memberHeadSizeMemory;
    const consumeIndividually = maxReferenceTypeDepth(baseType) > 1;
    if (!consumeIndividually) {
      baseDecoder.copies = [
        {
          dst: 0,
          src: 0,
          size: baseType.calldataHeadSize * array.length,
          names: [`${name}[0:${array.length}]`],
        },
      ];
      baseDecoder.memoryTailOffset = baseDecoder.copies[0].size;
    }
    for (let i = 0; i < array.length; i++) {
      const replaceIndex = (str: string) =>
        str.replace(`${name}[x]`, `${name}[${i}]`);

      const dstOffset = 32 * i;
      const valueOffset = headSize + i * baseType.memoryTailSize;
      decoder.addPtr(dstOffset, valueOffset, `${name}[${i}]`);
      if (consumeIndividually) {
        decoder.currentCdOffset = i * baseType.calldataHeadSize;
        decoder.consume(baseDecoder, replaceIndex);
      }
    }
    if (!consumeIndividually) {
      decoder.consume(baseDecoder);
    }
    // decoder.combineCopies();
    return decoder;
  }

  protected static processStruct(
    struct: AbiStruct | AbiFunction["input"],
    name: string = toTypeName(struct as AbiType),
    typeScopeName = toTypeName(struct as AbiType),
    skipPointers = false
  ) {
    const decoder = new FixedReferenceTypeProcessor(
      skipPointers ? 0 : struct.memberHeadSizeMemory,
      name
    );
    const types = extractTypes(struct.fields);
    if (!types.some(isReferenceType)) {
      // Copy entire struct
      decoder.copies.push({
        dst: 0,
        src: 0,
        size: struct.calldataHeadSize,
        names: [name],
      });
      return decoder;
    } else {
      types.forEach((type, i) => {
        if (type.meta === "array" || type.meta === "struct") {
          if (!skipPointers) {
            decoder.addPtrAuto(type, struct.fields[i].name);
          }
          decoder.currentCdOffset = type.calldataHeadOffset;
          decoder.consumeType(
            type,
            struct.fields[i].name,
            [typeScopeName, struct.fields[i].name].join("_")
          );
        } else {
          decoder.addCopy(type, struct.fields[i].name);
        }
      });
    }
    // decoder.combineCopies();
    return decoder;
  }

  consumeType(
    type: AbiStruct | AbiArray,
    name?: string,
    typeScopeName?: string
  ) {
    this.consume(
      FixedReferenceTypeProcessor.process(type, name, typeScopeName)
    );
  }

  consume(
    decoder: Include<
      FixedReferenceTypeProcessor,
      ["copies", "memoryTailOffset", "pointers"]
    >,
    nameChangeFn: (str: string) => string = (str: string) => str
  ) {
    const changeNames = (str: string | string[] | undefined) => {
      if (str === undefined) return undefined;
      if (Array.isArray(str)) {
        return str.map(changeNames);
      }
      return nameChangeFn(str);
    };
    for (const ptr of decoder.pointers) {
      this.pointers.push({
        dst: ptr.dst + this.memoryTailOffset,
        value: ptr.value + this.memoryTailOffset,
        name: changeNames(ptr.name),
      });
    }
    for (const copy of decoder.copies) {
      this.copies.push({
        dst: this.memoryTailOffset + copy.dst,
        src: this.currentCdOffset + copy.src,
        size: copy.size,
        names: changeNames(copy.names),
      });
    }
    this.memoryTailOffset += decoder.memoryTailOffset;
  }
}

// type DecoderASTOptions = (
//   | { loadMemoryPointer: true }
//   | { loadMemoryPointer?: undefined | false; mPtr: YulExpression }
// ) & {
  
//   cdPtr: number | YulExpression;
//   /**
//    * Whether to add a decoder function to the current block.
//    * If false, adds the decoding logic to the current block.
//    */
//   addFunction?: boolean;
// };

// function decoderToAST(
//   block: YulBlock,
//   type: AbiStruct | AbiArray,
//   name: string,
//   internalFunction: boolean,
//   _cdPtr: number | YulExpression,
//   _mPtr?: YulExpression,
//   returnFn?: boolean
// ) {
//   const loadMemoryPointer = _mPtr === undefined;
//   const constantCdPtr = isConstant(_cdPtr);
//   // const inputMPtr = _mPtr
//   // const mPtr = _mPtr ?? makeYulIdentifier(`mPtr`);
//   const mPtrId = makeYulIdentifier(`mPtr`);
//   // If internal fn, use id and call with input mPtr
//   // Otherwise, use input mPtr if given
//   const mPtr = internalFunction ? mPtrId : _mPtr ?? mPtrId;
//   const cdPtr = constantCdPtr
//     ? makeYulLiteral(resolveConstantValue(_cdPtr, false))
//     : makeYulIdentifier(`cdPtr`);

//   let body = block;
//   let fn: YulFunctionDefinition;
//   if (internalFunction) {
//     fn = block.addFunction(
//       `abi_decode_${getHighLevelTypeString(type)}`,
//       [],
//       []
//     );

//     body = fn.body;
//     if (!constantCdPtr) fn.parameters.push(cdPtr as YulIdentifier);
//     if (loadMemoryPointer) fn.returnVariables.push(mPtrId as YulIdentifier);
//     else fn.parameters.push(mPtrId as YulIdentifier);
//   }
//   if (loadMemoryPointer) {
//     body.set(mPtrId, makeYulLiteral(64).mload());
//   }
//   const decoder = this.process(type, name, toTypeName(type));
//   const ptrs: PendingDynamicPointer[] = cloneDeep(decoder.pointers)
//     .sort((a, b) => a.dst - b.dst)
//     .map((ptr) => ({
//       dst: mPtr.smartAdd(ptr.dst),
//       value: mPtr.smartAdd(ptr.value),
//       name: ptr.name,
//     }));
//   const copies: PendingDynamicCopy[] = combineSequentialDynamicCopies(
//     decoder.copies.map((copy) => ({
//       dst: mPtr.smartAdd(copy.dst),
//       src: cdPtr.smartAdd(copy.src),
//       size: makeYulLiteral(copy.size),
//       names: [...copy.names],
//     }))
//   );
//   addSortedAndDocumentedPointersAndCopies(body, ptrs, copies);
//   if (loadMemoryPointer) {
//     body.appendChild(mPtr.mstore(mPtr.smartAdd(decoder.memoryTailOffset)));
//   }

//   if (internalFunction) {
//     if (returnFn) return fn;
//     const args = [
//       ...(constantCdPtr ? [] : [_cdPtr as YulExpression]),
//       ...(loadMemoryPointer ? [] : [_mPtr]),
//     ];
//     block.appendChild(fn.call(args));
//   }
// }

// function addSortedAndDocumentedPointersAndCopies(
//   body: YulBlock,
//   ptrs: PendingDynamicPointer[],
//   copies: PendingDynamicCopy[]
// ) {
//   ptrs.forEach((ptr) => {
//     const copyThatWouldOverwrite = findIndex(copies, ({ dst, size }) => {
//       return (
//         expressionGte(ptr.dst, dst) === 1 &&
//         expressionLt(ptr.dst, dst.smartAdd(size)) === 1
//       );
//     });
//     if (copyThatWouldOverwrite > -1) {
//       const [{ src, dst, size, names }] = copies.splice(
//         copyThatWouldOverwrite,
//         1
//       );
//       const copy = dst.calldatacopy(src, size);
//       if (names && names.length) {
//         copy.documentation = [`Copy data for ${names.join(",")}`];
//         if (ptr.name) {
//           copy.documentation.push(
//             `Copy first because it will write to the same position as the ptr to ${ptr.name}`
//           );
//         }
//       }
//       body.appendChild(copy);
//     }
//     const { dst, value, name } = ptr;
//     const expr = dst.mstore(value);
//     if (name) {
//       expr.documentation = `Write pointer for ${name}`;
//     }
//     body.appendChild(expr);
//   });
//   copies.forEach(({ src, dst, size, names }) => {
//     const copy = dst.calldatacopy(src, size);
//     if (names && names.length) {
//       copy.documentation = `// Copy data for ${names.join(",")}`;
//     }
//     body.appendChild(copy);
//   });
// }
