import { NodeApp, applyPolyfills } from "astro/app/node";
import middleware from "./nodeMiddleware.js";
import startServer from "./standalone.js";
applyPolyfills();
function createExports(manifest, options) {
  const app = new NodeApp(manifest);
  return {
    handler: middleware(app, options.mode),
    startServer: () => startServer(app, options)
  };
}
function start(manifest, options) {
  if (options.mode !== "standalone" || process.env.ASTRO_NODE_AUTOSTART === "disabled") {
    return;
  }
  const app = new NodeApp(manifest);
  startServer(app, options);
}
export {
  createExports,
  start
};
