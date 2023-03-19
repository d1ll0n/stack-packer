/* eslint-disable no-useless-constructor */
import { toHex } from "../../lib/bytes";

import {
  AbiArray,
  AbiFunction,
  AbiStruct,
  AbiType,
  ArrayJoinInput,
  Include,
} from "../../types";
import { cloneDeep, findIndex } from "lodash";
import { combineSequentialCopies, PendingCopy, PendingPointer } from "./utils";
import {
  extractTypes,
  isReferenceType,
  isValueType,
  toTypeName,
} from "../../type-utils";

export function processStruct(struct: AbiStruct) {
  if (!struct.dynamic) {
  }
}

export class DynamicReferenceTypeProcessor {
  currentCdOffset: number;
  pointers: PendingPointer[] = [];
  copies: PendingCopy[] = [];

  constructor(public memoryTailOffset: number, public name: string = "") {
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

  combineCopies() {
    this.copies = combineSequentialCopies(this.copies);
  }

  static process(type: AbiStruct | AbiArray, name?: string) {
    return DynamicReferenceTypeProcessor[`process${type.meta.toPascalCase()}`](
      type,
      name
    );
  }

  static processFunctionInput(type: AbiFunction) {
    const decoder = this.processStruct(type.input);
    decoder.copies.forEach((copy) => {
      copy.src += 4;
    });
    const ptrs = cloneDeep(decoder.pointers).sort((a, b) => a.dst - b.dst);
    const copies = cloneDeep(decoder.copies);
    const outCode: ArrayJoinInput[] = [];
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

    return outCode;
  }

  protected static processArray(
    array: AbiArray,
    name: string = toTypeName(array)
  ) {
    const decoder = new DynamicReferenceTypeProcessor(
      array.memberHeadSizeMemory,
      name
    );
    const { baseType } = array;
    if (isValueType(baseType)) {
      decoder.addCopy(array, "");
      return;
    }
    const headSize = array.memberHeadSizeMemory;
    for (let i = 0; i < array.length; i++) {
      const baseDecoder = DynamicReferenceTypeProcessor.process(
        baseType as AbiStruct | AbiArray,
        `${name}[${i}]`
      );
      if (baseDecoder.memoryTailOffset !== baseType.memoryTailSize) {
        throw Error(`Decoder offset != baseType tailSize`);
      }
      const dstOffset = 32 * i;
      decoder.currentCdOffset = i * baseType.calldataHeadSize;
      const valueOffset = headSize + i * baseType.memoryTailSize;
      decoder.addPtr(dstOffset, valueOffset, `${name}[${i}]`);
      decoder.consume(baseDecoder);
    }
    decoder.combineCopies();
    return decoder;
  }

  protected static processStruct(
    struct: Include<AbiStruct, ["memberHeadSizeMemory", "fields"]>,
    name: string = toTypeName(struct as AbiType)
  ) {
    const decoder = new DynamicReferenceTypeProcessor(
      struct.memberHeadSizeMemory,
      name
    );
    const types = extractTypes(struct.fields);
    types.forEach((type, i) => {
      if (type.meta === "array" || type.meta === "struct") {
        decoder.addPtrAuto(type, struct.fields[i].name);
        decoder.currentCdOffset = type.calldataHeadOffset;
        decoder.consumeType(type, struct.fields[i].name);
      } else {
        decoder.addCopy(type, struct.fields[i].name);
      }
    });
    decoder.combineCopies();
    return decoder;
  }

  consumeType(type: AbiStruct | AbiArray, name?: string) {
    this.consume(DynamicReferenceTypeProcessor.process(type, name));
  }

  consume(decoder: DynamicReferenceTypeProcessor) {
    for (const ptr of decoder.pointers) {
      this.pointers.push({
        dst: ptr.dst + this.memoryTailOffset,
        value: ptr.value + this.memoryTailOffset,
        name: ptr.name,
      });
    }
    for (const copy of decoder.copies) {
      this.copies.push({
        dst: this.memoryTailOffset + copy.dst,
        src: this.currentCdOffset + copy.src,
        size: copy.size,
        names: copy.names,
      });
    }
    this.memoryTailOffset += decoder.memoryTailOffset;
  }
}
