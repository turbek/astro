import Markdoc from "@markdoc/markdoc";
import { parseInlineCSSToReactLikeObject } from "../css/parse-inline-css-to-react.js";
const htmlTag = {
  attributes: {
    name: { type: String, required: true },
    attrs: { type: Object }
  },
  transform(node, config) {
    const { name, attrs: unsafeAttributes } = node.attributes;
    const children = node.transformChildren(config);
    const { style, ...safeAttributes } = unsafeAttributes;
    if (typeof style === "string") {
      const styleObject = parseInlineCSSToReactLikeObject(style);
      safeAttributes.style = styleObject;
    }
    return new Markdoc.Tag(name, safeAttributes, children);
  }
};
export {
  htmlTag
};
