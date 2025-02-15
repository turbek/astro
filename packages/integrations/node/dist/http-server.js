import https from "https";
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import send from "send";
import enableDestroy from "server-destroy";
function parsePathname(pathname, host, port) {
  try {
    const urlPathname = new URL(pathname, `http://${host}:${port}`).pathname;
    return decodeURI(encodeURI(urlPathname));
  } catch (err) {
    return void 0;
  }
}
function createServer({ client, port, host, removeBase }, handler) {
  const listener = (req, res) => {
    if (req.url) {
      let pathname = removeBase(req.url);
      pathname = pathname[0] === "/" ? pathname : "/" + pathname;
      const encodedURI = parsePathname(pathname, host, port);
      if (!encodedURI) {
        res.writeHead(400);
        res.end("Bad request.");
        return res;
      }
      const stream = send(req, encodedURI, {
        root: fileURLToPath(client),
        dotfiles: pathname.startsWith("/.well-known/") ? "allow" : "deny"
      });
      let forwardError = false;
      stream.on("error", (err) => {
        if (forwardError) {
          console.error(err.toString());
          res.writeHead(500);
          res.end("Internal server error");
          return;
        }
        handler(req, res);
      });
      stream.on("directory", () => {
        let location;
        if (req.url.includes("?")) {
          const [url = "", search] = req.url.split("?");
          location = `${url}/?${search}`;
        } else {
          location = req.url + "/";
        }
        res.statusCode = 301;
        res.setHeader("Location", location);
        res.end(location);
      });
      stream.on("file", () => {
        forwardError = true;
      });
      stream.pipe(res);
    } else {
      handler(req, res);
    }
  };
  let httpServer;
  if (process.env.SERVER_CERT_PATH && process.env.SERVER_KEY_PATH) {
    httpServer = https.createServer(
      {
        key: fs.readFileSync(process.env.SERVER_KEY_PATH),
        cert: fs.readFileSync(process.env.SERVER_CERT_PATH)
      },
      listener
    );
  } else {
    httpServer = http.createServer(listener);
  }
  httpServer.listen(port, host);
  enableDestroy(httpServer);
  const closed = new Promise((resolve, reject) => {
    httpServer.addListener("close", resolve);
    httpServer.addListener("error", reject);
  });
  return {
    host,
    port,
    closed() {
      return closed;
    },
    server: httpServer,
    stop: async () => {
      await new Promise((resolve, reject) => {
        httpServer.destroy((err) => err ? reject(err) : resolve(void 0));
      });
    }
  };
}
export {
  createServer
};
