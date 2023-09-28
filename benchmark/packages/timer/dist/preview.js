import { createServer } from "node:http";
import enableDestroy from "server-destroy";
const preview = async function({ serverEntrypoint, host, port }) {
  const ssrModule = await import(serverEntrypoint.toString());
  const ssrHandler = ssrModule.handler;
  const server = createServer(ssrHandler);
  server.listen(port, host);
  enableDestroy(server);
  console.log(`Preview server listening on http://${host}:${port}`);
  const closed = new Promise((resolve, reject) => {
    server.addListener("close", resolve);
    server.addListener("error", reject);
  });
  return {
    host,
    port,
    closed() {
      return closed;
    },
    server,
    stop: async () => {
      await new Promise((resolve, reject) => {
        server.destroy((err) => err ? reject(err) : resolve(void 0));
      });
    }
  };
};
export {
  preview as default
};
