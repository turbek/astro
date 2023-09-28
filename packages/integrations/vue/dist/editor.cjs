"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var editor_exports = {};
__export(editor_exports, {
  toTSX: () => toTSX
});
module.exports = __toCommonJS(editor_exports);
var import_compiler_sfc = require("@vue/compiler-sfc");
function toTSX(code, className) {
  let result = `export default function ${className}__AstroComponent_(_props: Record<string, any>): any {}`;
  try {
    const parsedResult = (0, import_compiler_sfc.parse)(code);
    if (parsedResult.errors.length > 0) {
      return `
				let ${className}__AstroComponent_: Error
				export default ${className}__AstroComponent_
			`;
    }
    if (parsedResult.descriptor.scriptSetup) {
      const definePropsType = parsedResult.descriptor.scriptSetup.content.match(/defineProps<([\s\S]+)>/m);
      if (definePropsType) {
        result = `
						${parsedResult.descriptor.scriptSetup.content}

						export default function ${className}__AstroComponent_(_props: ${definePropsType[1]}): any {
							<div></div>
						}
				`;
      } else {
        const defineProps = parsedResult.descriptor.scriptSetup.content.match(/defineProps\([\s\S]+\)/m);
        if (defineProps) {
          result = `
					import { defineProps } from '@vue/runtime-core';

					const Props = ${defineProps[0]}

					export default function ${className}__AstroComponent_(_props: typeof Props): any {
						<div></div>
					}
				`;
        }
      }
    }
  } catch (e) {
    return result;
  }
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  toTSX
});
