import { createRequire } from "module";
import nodeFs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrerenderDefault } from "../../../prerender/utils.js";
import { SUPPORTED_MARKDOWN_FILE_EXTENSIONS } from "../../constants.js";
import { removeLeadingForwardSlash, slash } from "../../path.js";
import { resolvePages } from "../../util.js";
import { getRouteGenerator } from "./generator.js";
const require2 = createRequire(import.meta.url);
function countOccurrences(needle, haystack) {
  let count = 0;
  for (const hay of haystack) {
    if (hay === needle)
      count += 1;
  }
  return count;
}
function getParts(part, file) {
  const result = [];
  part.split(/\[(.+?\(.+?\)|.+?)\]/).map((str, i) => {
    if (!str)
      return;
    const dynamic = i % 2 === 1;
    const [, content] = dynamic ? /([^(]+)$/.exec(str) || [null, null] : [null, str];
    if (!content || dynamic && !/^(\.\.\.)?[a-zA-Z0-9_$]+$/.test(content)) {
      throw new Error(`Invalid route ${file} \u2014 parameter name must match /^[a-zA-Z0-9_$]+$/`);
    }
    result.push({
      content,
      dynamic,
      spread: dynamic && /^\.{3}.+$/.test(content)
    });
  });
  return result;
}
function getPattern(segments, base, addTrailingSlash) {
  const pathname = segments.map((segment) => {
    if (segment.length === 1 && segment[0].spread) {
      return "(?:\\/(.*?))?";
    } else {
      return "\\/" + segment.map((part) => {
        if (part.spread) {
          return "(.*?)";
        } else if (part.dynamic) {
          return "([^/]+?)";
        } else {
          return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
      }).join("");
    }
  }).join("");
  const trailing = addTrailingSlash && segments.length ? getTrailingSlashPattern(addTrailingSlash) : "$";
  let initial = "\\/";
  if (addTrailingSlash === "never" && base !== "/") {
    initial = "";
  }
  return new RegExp(`^${pathname || initial}${trailing}`);
}
function getTrailingSlashPattern(addTrailingSlash) {
  if (addTrailingSlash === "always") {
    return "\\/$";
  }
  if (addTrailingSlash === "never") {
    return "$";
  }
  return "\\/?$";
}
function isSpread(str) {
  const spreadPattern = /\[\.{3}/g;
  return spreadPattern.test(str);
}
function validateSegment(segment, file = "") {
  if (!file)
    file = segment;
  if (/\]\[/.test(segment)) {
    throw new Error(`Invalid route ${file} \u2014 parameters must be separated`);
  }
  if (countOccurrences("[", segment) !== countOccurrences("]", segment)) {
    throw new Error(`Invalid route ${file} \u2014 brackets are unbalanced`);
  }
  if ((/.+\[\.\.\.[^\]]+\]/.test(segment) || /\[\.\.\.[^\]]+\].+/.test(segment)) && file.endsWith(".astro")) {
    throw new Error(`Invalid route ${file} \u2014 rest parameter must be a standalone segment`);
  }
}
function comparator(a, b) {
  if (a.isIndex !== b.isIndex) {
    if (a.isIndex)
      return isSpread(a.file) ? 1 : -1;
    return isSpread(b.file) ? -1 : 1;
  }
  const max = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < max; i += 1) {
    const aSubPart = a.parts[i];
    const bSubPart = b.parts[i];
    if (!aSubPart)
      return 1;
    if (!bSubPart)
      return -1;
    if (aSubPart.spread && bSubPart.spread) {
      return a.isIndex ? 1 : -1;
    }
    if (aSubPart.spread !== bSubPart.spread)
      return aSubPart.spread ? 1 : -1;
    if (aSubPart.dynamic !== bSubPart.dynamic) {
      return aSubPart.dynamic ? 1 : -1;
    }
    if (!aSubPart.dynamic && aSubPart.content !== bSubPart.content) {
      return bSubPart.content.length - aSubPart.content.length || (aSubPart.content < bSubPart.content ? -1 : 1);
    }
  }
  if (a.isPage !== b.isPage) {
    return a.isPage ? 1 : -1;
  }
  return a.file < b.file ? -1 : 1;
}
function injectedRouteToItem({ config, cwd }, { pattern, entryPoint }) {
  let resolved;
  try {
    resolved = require2.resolve(entryPoint, { paths: [cwd || fileURLToPath(config.root)] });
  } catch (e) {
    resolved = fileURLToPath(new URL(entryPoint, config.root));
  }
  const ext = path.extname(pattern);
  const type = resolved.endsWith(".astro") ? "page" : "endpoint";
  const isPage = type === "page";
  return {
    basename: pattern,
    ext,
    parts: getParts(pattern, resolved),
    file: resolved,
    isDir: false,
    isIndex: true,
    isPage,
    routeSuffix: pattern.slice(pattern.indexOf("."), -ext.length)
  };
}
function createRouteManifest({ settings, cwd, fsMod }, logger) {
  const components = [];
  const routes = [];
  const validPageExtensions = /* @__PURE__ */ new Set([
    ".astro",
    ...SUPPORTED_MARKDOWN_FILE_EXTENSIONS,
    ...settings.pageExtensions
  ]);
  const validEndpointExtensions = /* @__PURE__ */ new Set([".js", ".ts"]);
  const localFs = fsMod ?? nodeFs;
  const prerender = getPrerenderDefault(settings.config);
  const foundInvalidFileExtensions = /* @__PURE__ */ new Set();
  function walk(fs, dir, parentSegments, parentParams) {
    let items = [];
    fs.readdirSync(dir).forEach((basename) => {
      const resolved = path.join(dir, basename);
      const file = slash(path.relative(cwd || fileURLToPath(settings.config.root), resolved));
      const isDir = fs.statSync(resolved).isDirectory();
      const ext = path.extname(basename);
      const name = ext ? basename.slice(0, -ext.length) : basename;
      if (name[0] === "_") {
        return;
      }
      if (basename[0] === "." && basename !== ".well-known") {
        return;
      }
      if (!isDir && !validPageExtensions.has(ext) && !validEndpointExtensions.has(ext)) {
        if (!foundInvalidFileExtensions.has(ext)) {
          foundInvalidFileExtensions.add(ext);
          logger.warn("astro", `Invalid file extension for Pages: ${ext}`);
        }
        return;
      }
      const segment = isDir ? basename : name;
      validateSegment(segment, file);
      const parts = getParts(segment, file);
      const isIndex = isDir ? false : basename.startsWith("index.");
      const routeSuffix = basename.slice(basename.indexOf("."), -ext.length);
      const isPage = validPageExtensions.has(ext);
      items.push({
        basename,
        ext,
        parts,
        file: file.replace(/\\/g, "/"),
        isDir,
        isIndex,
        isPage,
        routeSuffix
      });
    });
    items = items.sort(comparator);
    items.forEach((item) => {
      const segments = parentSegments.slice();
      if (item.isIndex) {
        if (item.routeSuffix) {
          if (segments.length > 0) {
            const lastSegment = segments[segments.length - 1].slice();
            const lastPart = lastSegment[lastSegment.length - 1];
            if (lastPart.dynamic) {
              lastSegment.push({
                dynamic: false,
                spread: false,
                content: item.routeSuffix
              });
            } else {
              lastSegment[lastSegment.length - 1] = {
                dynamic: false,
                spread: false,
                content: `${lastPart.content}${item.routeSuffix}`
              };
            }
            segments[segments.length - 1] = lastSegment;
          } else {
            segments.push(item.parts);
          }
        }
      } else {
        segments.push(item.parts);
      }
      const params = parentParams.slice();
      params.push(...item.parts.filter((p) => p.dynamic).map((p) => p.content));
      if (item.isDir) {
        walk(fsMod ?? fs, path.join(dir, item.basename), segments, params);
      } else {
        components.push(item.file);
        const component = item.file;
        const trailingSlash = item.isPage ? settings.config.trailingSlash : "never";
        const pattern = getPattern(segments, settings.config.base, trailingSlash);
        const generate = getRouteGenerator(segments, trailingSlash);
        const pathname = segments.every((segment) => segment.length === 1 && !segment[0].dynamic) ? `/${segments.map((segment) => segment[0].content).join("/")}` : null;
        const route = `/${segments.map(([{ dynamic, content }]) => dynamic ? `[${content}]` : content).join("/")}`.toLowerCase();
        routes.push({
          route,
          type: item.isPage ? "page" : "endpoint",
          pattern,
          segments,
          params,
          component,
          generate,
          pathname: pathname || void 0,
          prerender
        });
      }
    });
  }
  const { config } = settings;
  const pages = resolvePages(config);
  if (localFs.existsSync(pages)) {
    walk(localFs, fileURLToPath(pages), [], []);
  } else if (settings.injectedRoutes.length === 0) {
    const pagesDirRootRelative = pages.href.slice(settings.config.root.href.length);
    logger.warn("astro", `Missing pages directory: ${pagesDirRootRelative}`);
  }
  settings.injectedRoutes?.sort(
    (a, b) => (
      // sort injected routes in the same way as user-defined routes
      comparator(injectedRouteToItem({ config, cwd }, a), injectedRouteToItem({ config, cwd }, b))
    )
  ).reverse().forEach(({ pattern: name, entryPoint, prerender: prerenderInjected }) => {
    let resolved;
    try {
      resolved = require2.resolve(entryPoint, { paths: [cwd || fileURLToPath(config.root)] });
    } catch (e) {
      resolved = fileURLToPath(new URL(entryPoint, config.root));
    }
    const component = slash(path.relative(cwd || fileURLToPath(config.root), resolved));
    const segments = removeLeadingForwardSlash(name).split(path.posix.sep).filter(Boolean).map((s) => {
      validateSegment(s);
      return getParts(s, component);
    });
    const type = resolved.endsWith(".astro") ? "page" : "endpoint";
    const isPage = type === "page";
    const trailingSlash = isPage ? config.trailingSlash : "never";
    const pattern = getPattern(segments, settings.config.base, trailingSlash);
    const generate = getRouteGenerator(segments, trailingSlash);
    const pathname = segments.every((segment) => segment.length === 1 && !segment[0].dynamic) ? `/${segments.map((segment) => segment[0].content).join("/")}` : null;
    const params = segments.flat().filter((p) => p.dynamic).map((p) => p.content);
    const route = `/${segments.map(([{ dynamic, content }]) => dynamic ? `[${content}]` : content).join("/")}`.toLowerCase();
    const collision = routes.find(({ route: r }) => r === route);
    if (collision) {
      throw new Error(
        `An integration attempted to inject a route that is already used in your project: "${route}" at "${component}". 
This route collides with: "${collision.component}".`
      );
    }
    routes.unshift({
      type,
      route,
      pattern,
      segments,
      params,
      component,
      generate,
      pathname: pathname || void 0,
      prerender: prerenderInjected ?? prerender
    });
  });
  Object.entries(settings.config.redirects).forEach(([from, to]) => {
    const trailingSlash = config.trailingSlash;
    const segments = removeLeadingForwardSlash(from).split(path.posix.sep).filter(Boolean).map((s) => {
      validateSegment(s);
      return getParts(s, from);
    });
    const pattern = getPattern(segments, settings.config.base, trailingSlash);
    const generate = getRouteGenerator(segments, trailingSlash);
    const pathname = segments.every((segment) => segment.length === 1 && !segment[0].dynamic) ? `/${segments.map((segment) => segment[0].content).join("/")}` : null;
    const params = segments.flat().filter((p) => p.dynamic).map((p) => p.content);
    const route = `/${segments.map(([{ dynamic, content }]) => dynamic ? `[${content}]` : content).join("/")}`.toLowerCase();
    const routeData = {
      type: "redirect",
      route,
      pattern,
      segments,
      params,
      component: from,
      generate,
      pathname: pathname || void 0,
      prerender: false,
      redirect: to,
      redirectRoute: routes.find((r) => r.route === to)
    };
    const lastSegmentIsDynamic = (r) => !!r.segments.at(-1)?.at(-1)?.dynamic;
    const redirBase = path.posix.dirname(route);
    const dynamicRedir = lastSegmentIsDynamic(routeData);
    let i = 0;
    for (const existingRoute of routes) {
      if (existingRoute.route === route) {
        routes.splice(i + 1, 0, routeData);
        return;
      }
      const base = path.posix.dirname(existingRoute.route);
      if (base === redirBase && !dynamicRedir && lastSegmentIsDynamic(existingRoute)) {
        routes.splice(i, 0, routeData);
        return;
      }
      i++;
    }
    routes.push(routeData);
  });
  return {
    routes
  };
}
export {
  createRouteManifest
};
