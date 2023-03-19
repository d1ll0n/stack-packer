import { AbiStruct, AbiType } from "../types";
import { find } from "lodash";
import { parseCode } from "../parser";
import { isDynamicBytes, maxReferenceTypeDepth, setActualSizes } from "./type-check";

const code = `

struct ABC {
  uint256[2] arr;
}

struct DEF {
  ABC abc;
  ABC[] abcArr;
  uint256[][] arr;
  bytes[2] b;
  uint256[2] d;
}
`;

// function canCopyTail(t: AbiType) {
//   if (isDynamicBytes(t)) {}
//   if ()
// }

const { structs } = parseCode(code);
structs.forEach(setActualSizes);
const def = find(structs, { name: "DEF" }) as AbiStruct;

def.fields.forEach(({ type, name }) => {
  const length = type.dynamic ? "" : ` (${type.bytes} bytes)`;
  console.log(`${name}: ${type.dynamicChildrenDepth}${length}`);
  // console.log(
  //   `${name}: ${maxReferenceTypeDepth(type)} | head ${
  //     type.canCopyHead
  //   } | tail ${type.canCopyTail}`
  // );
});
