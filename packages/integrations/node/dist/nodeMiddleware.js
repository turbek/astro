import { createOutgoingHttpHeaders } from "./createOutgoingHttpHeaders.js";
import { responseIterator } from "./response-iterator.js";
function nodeMiddleware_default(app, mode) {
  return async function(...args) {
    let error = null;
    let locals;
    let [req, res, next] = args;
    if (mode === "middleware") {
      let { [3]: _locals } = args;
      locals = _locals;
    }
    if (args[0] instanceof Error) {
      [error, req, res, next] = args;
      if (mode === "middleware") {
        let { [4]: _locals } = args;
        locals = _locals;
      }
      if (error) {
        if (next) {
          return next(error);
        } else {
          throw error;
        }
      }
    }
    try {
      const route = app.match(req);
      if (route) {
        try {
          const response = await app.render(req, route, locals);
          await writeWebResponse(app, res, response);
        } catch (err) {
          if (next) {
            next(err);
          } else {
            throw err;
          }
        }
      } else if (next) {
        return next();
      } else {
        const response = await app.render(req);
        await writeWebResponse(app, res, response);
      }
    } catch (err) {
      const logger = app.getAdapterLogger();
      logger.error(`Could not render ${req.url}`);
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, `Server error`);
        res.end();
      }
    }
  };
}
async function writeWebResponse(app, res, webResponse) {
  const { status, headers } = webResponse;
  if (app.setCookieHeaders) {
    const setCookieHeaders = Array.from(app.setCookieHeaders(webResponse));
    if (setCookieHeaders.length) {
      for (const setCookieHeader of setCookieHeaders) {
        webResponse.headers.append("set-cookie", setCookieHeader);
      }
    }
  }
  const nodeHeaders = createOutgoingHttpHeaders(headers);
  res.writeHead(status, nodeHeaders);
  if (webResponse.body) {
    try {
      for await (const chunk of responseIterator(webResponse)) {
        res.write(chunk);
      }
    } catch (err) {
      console.error(err?.stack || err?.message || String(err));
      res.write("Internal server error");
    }
  }
  res.end();
}
export {
  nodeMiddleware_default as default
};
