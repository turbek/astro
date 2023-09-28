class MarkdocError extends Error {
  loc;
  title;
  hint;
  frame;
  type = "MarkdocError";
  constructor(props, ...params) {
    super(...params);
    const { title = "MarkdocError", message, stack, location, hint, frame } = props;
    this.title = title;
    if (message)
      this.message = message;
    this.stack = stack ? stack : this.stack;
    this.loc = location;
    this.hint = hint;
    this.frame = frame;
  }
}
function prependForwardSlash(str) {
  return str[0] === "/" ? str : "/" + str;
}
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}
const PROPAGATED_ASSET_FLAG = "astroPropagatedAssets";
function hasContentFlag(viteId, flag) {
  const flags = new URLSearchParams(viteId.split("?")[1] ?? "");
  return flags.has(flag);
}
const componentConfigSymbol = Symbol.for("@astrojs/markdoc/component-config");
function isComponentConfig(value) {
  return typeof value === "object" && value !== null && componentConfigSymbol in value;
}
export {
  MarkdocError,
  PROPAGATED_ASSET_FLAG,
  componentConfigSymbol,
  hasContentFlag,
  isComponentConfig,
  isValidUrl,
  prependForwardSlash
};
