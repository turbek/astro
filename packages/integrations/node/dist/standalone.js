import https from "https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNetworkAddress } from "./get-network-address.js";
import { createServer } from "./http-server.js";
import middleware from "./nodeMiddleware.js";
function resolvePaths(options) {
  const clientURLRaw = new URL(options.client);
  const serverURLRaw = new URL(options.server);
  const rel = path.relative(fileURLToPath(serverURLRaw), fileURLToPath(clientURLRaw));
  const serverEntryURL = new URL(import.meta.url);
  const clientURL = new URL(appendForwardSlash(rel), serverEntryURL);
  return {
    client: clientURL
  };
}
function appendForwardSlash(pth) {
  return pth.endsWith("/") ? pth : pth + "/";
}
function getResolvedHostForHttpServer(host) {
  if (host === false) {
    return "127.0.0.1";
  } else if (host === true) {
    return void 0;
  } else {
    return host;
  }
}
function startServer(app, options) {
  const logger = app.getAdapterLogger();
  const port = process.env.PORT ? Number(process.env.PORT) : options.port ?? 8080;
  const { client } = resolvePaths(options);
  const handler = middleware(app, options.mode);
  const host = getResolvedHostForHttpServer(
    process.env.HOST !== void 0 && process.env.HOST !== "" ? process.env.HOST : options.host
  );
  const server = createServer(
    {
      client,
      port,
      host,
      removeBase: app.removeBase.bind(app)
    },
    handler
  );
  const protocol = server.server instanceof https.Server ? "https" : "http";
  const address = getNetworkAddress(protocol, host, port);
  if (host === void 0) {
    logger.info(
      `Server listening on 
  local: ${address.local[0]} 	
  network: ${address.network[0]}
`
    );
  } else {
    logger.info(`Server listening on ${address.local[0]}`);
  }
  return {
    server,
    done: server.closed()
  };
}
export {
  startServer as default,
  getResolvedHostForHttpServer
};
