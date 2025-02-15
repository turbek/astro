import * as fs from "node:fs";
import { IncomingMessage } from "node:http";
import { TLSSocket } from "node:tls";
import { deserializeManifest } from "./common.js";
import { App } from "./index.js";
import { apply } from "../polyfill.js";
const clientAddressSymbol = Symbol.for("astro.clientAddress");
function createRequestFromNodeRequest(req, options) {
  const protocol = req.socket instanceof TLSSocket || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const hostname = req.headers.host || req.headers[":authority"];
  const url = `${protocol}://${hostname}${req.url}`;
  const headers = makeRequestHeaders(req);
  const method = req.method || "GET";
  let bodyProps = {};
  const bodyAllowed = method !== "HEAD" && method !== "GET" && !options?.emptyBody;
  if (bodyAllowed) {
    bodyProps = makeRequestBody(req);
  }
  const request = new Request(url, {
    method,
    headers,
    ...bodyProps
  });
  if (req.socket?.remoteAddress) {
    Reflect.set(request, clientAddressSymbol, req.socket.remoteAddress);
  }
  return request;
}
function makeRequestHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === void 0) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else {
      headers.append(name, value);
    }
  }
  return headers;
}
function makeRequestBody(req) {
  if (req.body !== void 0) {
    if (typeof req.body === "string" && req.body.length > 0) {
      return { body: Buffer.from(req.body) };
    }
    if (typeof req.body === "object" && req.body !== null && Object.keys(req.body).length > 0) {
      return { body: Buffer.from(JSON.stringify(req.body)) };
    }
    if (typeof req.body === "object" && req.body !== null && typeof req.body[Symbol.asyncIterator] !== "undefined") {
      return asyncIterableToBodyProps(req.body);
    }
  }
  return asyncIterableToBodyProps(req);
}
function asyncIterableToBodyProps(iterable) {
  return {
    // Node uses undici for the Request implementation. Undici accepts
    // a non-standard async iterable for the body.
    // @ts-expect-error
    body: iterable,
    // The duplex property is required when using a ReadableStream or async
    // iterable for the body. The type definitions do not include the duplex
    // property because they are not up-to-date.
    // @ts-expect-error
    duplex: "half"
  };
}
class NodeIncomingMessage extends IncomingMessage {
  /**
   * Allow the request body to be explicitly overridden. For example, this
   * is used by the Express JSON middleware.
   */
  body;
}
class NodeApp extends App {
  match(req, opts = {}) {
    if (!(req instanceof Request)) {
      req = createRequestFromNodeRequest(req, {
        emptyBody: true
      });
    }
    return super.match(req, opts);
  }
  render(req, routeData, locals) {
    if (!(req instanceof Request)) {
      req = createRequestFromNodeRequest(req);
    }
    return super.render(req, routeData, locals);
  }
}
async function loadManifest(rootFolder) {
  const manifestFile = new URL("./manifest.json", rootFolder);
  const rawManifest = await fs.promises.readFile(manifestFile, "utf-8");
  const serializedManifest = JSON.parse(rawManifest);
  return deserializeManifest(serializedManifest);
}
async function loadApp(rootFolder) {
  const manifest = await loadManifest(rootFolder);
  return new NodeApp(manifest);
}
export {
  NodeApp,
  apply as applyPolyfills,
  loadApp,
  loadManifest
};
