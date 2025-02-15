import * as fs from "node:fs";
import notFoundTemplate, { subpathNotUsedTemplate } from "../template/4xx.js";
import { log404 } from "./common.js";
import { writeHtmlResponse } from "./response.js";
function baseMiddleware(settings, logger) {
  const { config } = settings;
  const site = config.site ? new URL(config.base, config.site) : void 0;
  const devRootURL = new URL(config.base, "http://localhost");
  const devRoot = site ? site.pathname : devRootURL.pathname;
  const devRootReplacement = devRoot.endsWith("/") ? "/" : "";
  return function devBaseMiddleware(req, res, next) {
    const url = req.url;
    const pathname = decodeURI(new URL(url, "http://localhost").pathname);
    if (pathname.startsWith(devRoot)) {
      req.url = url.replace(devRoot, devRootReplacement);
      return next();
    }
    if (pathname === "/" || pathname === "/index.html") {
      log404(logger, pathname);
      const html = subpathNotUsedTemplate(devRoot, pathname);
      return writeHtmlResponse(res, 404, html);
    }
    if (req.headers.accept?.includes("text/html")) {
      log404(logger, pathname);
      const html = notFoundTemplate({
        statusCode: 404,
        title: "Not found",
        tabTitle: "404: Not Found",
        pathname
      });
      return writeHtmlResponse(res, 404, html);
    }
    const publicPath = new URL("." + req.url, config.publicDir);
    fs.stat(publicPath, (_err, stats) => {
      if (stats) {
        const expectedLocation = new URL("." + url, devRootURL).pathname;
        logger.warn(
          "dev",
          `Requests for items in your public folder must also include your base. ${url} should be ${expectedLocation}. Omitting the base will break in production.`
        );
        res.writeHead(301, {
          Location: expectedLocation
        });
        res.end();
      } else {
        next();
      }
    });
  };
}
export {
  baseMiddleware
};
