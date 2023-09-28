import { App } from "astro/app";
import { getProcessEnvProxy, isNode } from "./util.js";
if (!isNode) {
  process.env = getProcessEnvProxy();
}
function createExports(manifest) {
  const app = new App(manifest);
  const onRequest = async (context) => {
    const request = context.request;
    const { env } = context;
    process.env = env;
    const { pathname } = new URL(request.url);
    if (manifest.assets.has(pathname)) {
      return env.ASSETS.fetch(request);
    }
    let routeData = app.match(request, { matchNotFound: true });
    if (routeData) {
      Reflect.set(
        request,
        Symbol.for("astro.clientAddress"),
        request.headers.get("cf-connecting-ip")
      );
      const locals = {
        runtime: {
          waitUntil: (promise) => {
            context.waitUntil(promise);
          },
          env: context.env,
          cf: request.cf,
          caches
        }
      };
      let response = await app.render(request, routeData, locals);
      if (app.setCookieHeaders) {
        for (const setCookieHeader of app.setCookieHeaders(response)) {
          response.headers.append("Set-Cookie", setCookieHeader);
        }
      }
      return response;
    }
    return new Response(null, {
      status: 404,
      statusText: "Not found"
    });
  };
  return { onRequest, manifest };
}
export {
  createExports
};
