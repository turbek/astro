import { AstroError } from "astro/errors";
import { fileURLToPath } from "node:url";
import { getNetworkAddress } from "./get-network-address.js";
import { createServer } from "./http-server.js";
const preview = async function({
  client,
  serverEntrypoint,
  host,
  port,
  base,
  logger
}) {
  let ssrHandler;
  try {
    process.env.ASTRO_NODE_AUTOSTART = "disabled";
    const ssrModule = await import(serverEntrypoint.toString());
    if (typeof ssrModule.handler === "function") {
      ssrHandler = ssrModule.handler;
    } else {
      throw new AstroError(
        `The server entrypoint doesn't have a handler. Are you sure this is the right file?`
      );
    }
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND") {
      throw new AstroError(
        `The server entrypoint ${fileURLToPath(
          serverEntrypoint
        )} does not exist. Have you ran a build yet?`
      );
    } else {
      throw err;
    }
  }
  const handler = (req, res) => {
    ssrHandler(req, res);
  };
  const baseWithoutTrailingSlash = base.endsWith("/") ? base.slice(0, base.length - 1) : base;
  function removeBase(pathname) {
    if (pathname.startsWith(base)) {
      return pathname.slice(baseWithoutTrailingSlash.length);
    }
    return pathname;
  }
  const server = createServer(
    {
      client,
      port,
      host,
      removeBase
    },
    handler
  );
  const address = getNetworkAddress("http", host, port);
  if (host === void 0) {
    logger.info(
      `Preview server listening on 
  local: ${address.local[0]} 	
  network: ${address.network[0]}
`
    );
  } else {
    logger.info(`Preview server listening on ${address.local[0]}`);
  }
  return server;
};
export {
  preview as default
};
