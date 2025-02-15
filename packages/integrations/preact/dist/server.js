import { Component as BaseComponent, h } from "preact";
import { render } from "preact-render-to-string";
import { getContext } from "./context.js";
import { restoreSignalsOnProps, serializeSignals } from "./signals.js";
import StaticHtml from "./static-html.js";
const slotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
let originalConsoleError;
let consoleFilterRefs = 0;
function check(Component, props, children) {
  if (typeof Component !== "function")
    return false;
  if (Component.prototype != null && typeof Component.prototype.render === "function") {
    return BaseComponent.isPrototypeOf(Component);
  }
  useConsoleFilter();
  try {
    try {
      const { html } = renderToStaticMarkup.call(this, Component, props, children, void 0);
      if (typeof html !== "string") {
        return false;
      }
      return html == "" ? false : !/\<undefined\>/.test(html);
    } catch (err) {
      return false;
    }
  } finally {
    finishUsingConsoleFilter();
  }
}
function shouldHydrate(metadata) {
  return metadata?.astroStaticSlot ? !!metadata.hydrate : true;
}
function renderToStaticMarkup(Component, props, { default: children, ...slotted }, metadata) {
  const ctx = getContext(this.result);
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = h(StaticHtml, {
      hydrate: shouldHydrate(metadata),
      value,
      name
    });
  }
  let propsMap = restoreSignalsOnProps(ctx, props);
  const newProps = { ...props, ...slots };
  const attrs = {};
  serializeSignals(ctx, props, attrs, propsMap);
  const html = render(
    h(
      Component,
      newProps,
      children != null ? h(StaticHtml, {
        hydrate: shouldHydrate(metadata),
        value: children
      }) : children
    )
  );
  return {
    attrs,
    html
  };
}
function useConsoleFilter() {
  consoleFilterRefs++;
  if (!originalConsoleError) {
    originalConsoleError = console.error;
    try {
      console.error = filteredConsoleError;
    } catch (error) {
    }
  }
}
function finishUsingConsoleFilter() {
  consoleFilterRefs--;
}
function filteredConsoleError(msg, ...rest) {
  if (consoleFilterRefs > 0 && typeof msg === "string") {
    const isKnownReactHookError = msg.includes("Warning: Invalid hook call.") && msg.includes("https://reactjs.org/link/invalid-hook-call");
    if (isKnownReactHookError)
      return;
  }
  originalConsoleError(msg, ...rest);
}
var server_default = {
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true
};
export {
  server_default as default
};
