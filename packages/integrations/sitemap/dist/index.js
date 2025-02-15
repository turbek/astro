import { fileURLToPath } from "node:url";
import {
  EnumChangefreq,
  simpleSitemapAndIndex
} from "sitemap";
import { ZodError } from "zod";
import { generateSitemap } from "./generate-sitemap.js";
import { Logger } from "./utils/logger.js";
import { validateOptions } from "./validate-options.js";
import { EnumChangefreq as EnumChangefreq2 } from "sitemap";
function formatConfigErrorMessage(err) {
  const errorList = err.issues.map((issue) => ` ${issue.path.join(".")}  ${issue.message + "."}`);
  return errorList.join("\n");
}
const PKG_NAME = "@astrojs/sitemap";
const OUTFILE = "sitemap-index.xml";
const STATUS_CODE_PAGES = /* @__PURE__ */ new Set(["404", "500"]);
function isStatusCodePage(pathname) {
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  const end = pathname.split("/").pop() ?? "";
  return STATUS_CODE_PAGES.has(end);
}
const createPlugin = (options) => {
  let config;
  const logger = new Logger(PKG_NAME);
  return {
    name: PKG_NAME,
    hooks: {
      "astro:config:done": async ({ config: cfg }) => {
        config = cfg;
      },
      "astro:build:done": async ({ dir, routes, pages }) => {
        try {
          if (!config.site) {
            logger.warn(
              "The Sitemap integration requires the `site` astro.config option. Skipping."
            );
            return;
          }
          const opts = validateOptions(config.site, options);
          const { filter, customPages, serialize, entryLimit } = opts;
          let finalSiteUrl;
          if (config.site) {
            finalSiteUrl = new URL(config.base, config.site);
          } else {
            console.warn(
              "The Sitemap integration requires the `site` astro.config option. Skipping."
            );
            return;
          }
          let pageUrls = pages.filter((p) => !isStatusCodePage(p.pathname)).map((p) => {
            if (p.pathname !== "" && !finalSiteUrl.pathname.endsWith("/"))
              finalSiteUrl.pathname += "/";
            const path = finalSiteUrl.pathname + p.pathname;
            return new URL(path, finalSiteUrl).href;
          });
          let routeUrls = routes.reduce((urls, r) => {
            if (r.type !== "page")
              return urls;
            if (r.pathname) {
              if (isStatusCodePage(r.pathname ?? r.route))
                return urls;
              const path = finalSiteUrl.pathname + r.generate(r.pathname).substring(1);
              let newUrl = new URL(path, finalSiteUrl).href;
              if (config.trailingSlash === "never") {
                urls.push(newUrl);
              } else if (config.build.format === "directory" && !newUrl.endsWith("/")) {
                urls.push(newUrl + "/");
              } else {
                urls.push(newUrl);
              }
            }
            return urls;
          }, []);
          pageUrls = Array.from(/* @__PURE__ */ new Set([...pageUrls, ...routeUrls, ...customPages ?? []]));
          try {
            if (filter) {
              pageUrls = pageUrls.filter(filter);
            }
          } catch (err) {
            logger.error(`Error filtering pages
${err.toString()}`);
            return;
          }
          if (pageUrls.length === 0) {
            logger.warn(`No pages found!
\`${OUTFILE}\` not created.`);
            return;
          }
          let urlData = generateSitemap(pageUrls, finalSiteUrl.href, opts);
          if (serialize) {
            try {
              const serializedUrls = [];
              for (const item of urlData) {
                const serialized = await Promise.resolve(serialize(item));
                if (serialized) {
                  serializedUrls.push(serialized);
                }
              }
              if (serializedUrls.length === 0) {
                logger.warn("No pages found!");
                return;
              }
              urlData = serializedUrls;
            } catch (err) {
              logger.error(`Error serializing pages
${err.toString()}`);
              return;
            }
          }
          await simpleSitemapAndIndex({
            hostname: finalSiteUrl.href,
            destinationDir: fileURLToPath(dir),
            sourceData: urlData,
            limit: entryLimit,
            gzip: false
          });
          logger.success(`\`${OUTFILE}\` is created.`);
        } catch (err) {
          if (err instanceof ZodError) {
            logger.warn(formatConfigErrorMessage(err));
          } else {
            throw err;
          }
        }
      }
    }
  };
};
var src_default = createPlugin;
export {
  EnumChangefreq2 as ChangeFreqEnum,
  src_default as default
};
