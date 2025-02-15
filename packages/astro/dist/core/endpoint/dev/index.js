import { createRenderContext } from "../../render/index.js";
import { callEndpoint } from "../index.js";
async function call(options) {
  const { env, preload, middleware } = options;
  const endpointHandler = preload;
  const ctx = await createRenderContext({
    request: options.request,
    pathname: options.pathname,
    route: options.route,
    env,
    mod: preload
  });
  return await callEndpoint(endpointHandler, env, ctx, middleware?.onRequest);
}
export {
  call
};
