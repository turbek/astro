import * as crypto from "node:crypto";
import * as npath from "node:path";
import {} from "vite";
import { isBuildableCSSRequest } from "../../../vite-plugin-astro-server/util.js";
import { PROPAGATED_ASSET_FLAG } from "../../../content/consts.js";
import * as assetName from "../css-asset-name.js";
import { moduleIsTopLevelPage, walkParentInfos } from "../graph.js";
import {
  eachPageData,
  getPageDataByViteID,
  getPageDatasByClientOnlyID,
  getPageDatasByHoistedScriptId,
  isHoistedScript
} from "../internal.js";
import { extendManualChunks } from "./util.js";
function pluginCSS(options, internals) {
  return {
    build: "both",
    hooks: {
      "build:before": ({ build }) => {
        let plugins = rollupPluginAstroBuildCSS({
          buildOptions: options,
          internals,
          target: build === "ssr" ? "server" : "client"
        });
        return {
          vitePlugin: plugins
        };
      }
    }
  };
}
function rollupPluginAstroBuildCSS(options) {
  const { internals, buildOptions } = options;
  const { settings } = buildOptions;
  let resolvedConfig;
  const pagesToCss = {};
  const pagesToPropagatedCss = {};
  const cssBuildPlugin = {
    name: "astro:rollup-plugin-build-css",
    outputOptions(outputOptions) {
      const assetFileNames = outputOptions.assetFileNames;
      const namingIncludesHash = assetFileNames?.toString().includes("[hash]");
      const createNameForParentPages = namingIncludesHash ? assetName.shortHashedName : assetName.createSlugger(settings);
      extendManualChunks(outputOptions, {
        after(id, meta) {
          if (isBuildableCSSRequest(id)) {
            if (options.target === "client") {
              return internals.cssModuleToChunkIdMap.get(id);
            }
            for (const [pageInfo] of walkParentInfos(id, {
              getModuleInfo: meta.getModuleInfo
            })) {
              if (new URL(pageInfo.id, "file://").searchParams.has(PROPAGATED_ASSET_FLAG)) {
                const chunkId2 = createNameHash(id, [id]);
                internals.cssModuleToChunkIdMap.set(id, chunkId2);
                return chunkId2;
              }
            }
            const chunkId = createNameForParentPages(id, meta);
            internals.cssModuleToChunkIdMap.set(id, chunkId);
            return chunkId;
          }
        }
      });
    },
    async generateBundle(_outputOptions, bundle) {
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk")
          continue;
        if ("viteMetadata" in chunk === false)
          continue;
        const meta = chunk.viteMetadata;
        if (meta.importedCss.size < 1)
          continue;
        if (options.target === "client") {
          for (const id of Object.keys(chunk.modules)) {
            for (const pageData of getParentClientOnlys(id, this, internals)) {
              for (const importedCssImport of meta.importedCss) {
                const cssToInfoRecord = pagesToCss[pageData.moduleSpecifier] ??= {};
                cssToInfoRecord[importedCssImport] = { depth: -1, order: -1 };
              }
            }
          }
        }
        for (const id of Object.keys(chunk.modules)) {
          for (const [pageInfo, depth, order] of walkParentInfos(
            id,
            this,
            function until(importer) {
              return new URL(importer, "file://").searchParams.has(PROPAGATED_ASSET_FLAG);
            }
          )) {
            if (new URL(pageInfo.id, "file://").searchParams.has(PROPAGATED_ASSET_FLAG)) {
              for (const parent of walkParentInfos(id, this)) {
                const parentInfo = parent[0];
                if (moduleIsTopLevelPage(parentInfo) === false)
                  continue;
                const pageViteID = parentInfo.id;
                const pageData = getPageDataByViteID(internals, pageViteID);
                if (pageData === void 0)
                  continue;
                for (const css of meta.importedCss) {
                  const propagatedStyles = pagesToPropagatedCss[pageData.moduleSpecifier] ??= {};
                  const existingCss = propagatedStyles[pageInfo.id] ??= /* @__PURE__ */ new Set();
                  existingCss.add(css);
                }
              }
            } else if (moduleIsTopLevelPage(pageInfo)) {
              const pageViteID = pageInfo.id;
              const pageData = getPageDataByViteID(internals, pageViteID);
              if (pageData) {
                appendCSSToPage(pageData, meta, pagesToCss, depth, order);
              }
            } else if (options.target === "client" && isHoistedScript(internals, pageInfo.id)) {
              for (const pageData of getPageDatasByHoistedScriptId(internals, pageInfo.id)) {
                appendCSSToPage(pageData, meta, pagesToCss, -1, order);
              }
            }
          }
        }
      }
    }
  };
  const singleCssPlugin = {
    name: "astro:rollup-plugin-single-css",
    enforce: "post",
    configResolved(config) {
      resolvedConfig = config;
    },
    generateBundle(_, bundle) {
      if (resolvedConfig.build.cssCodeSplit)
        return;
      const cssChunk = Object.values(bundle).find(
        (chunk) => chunk.type === "asset" && chunk.name === "style.css"
      );
      if (cssChunk === void 0)
        return;
      for (const pageData of eachPageData(internals)) {
        const cssToInfoMap = pagesToCss[pageData.moduleSpecifier] ??= {};
        cssToInfoMap[cssChunk.fileName] = { depth: -1, order: -1 };
      }
    }
  };
  const inlineStylesheetsPlugin = {
    name: "astro:rollup-plugin-inline-stylesheets",
    enforce: "post",
    async generateBundle(_outputOptions, bundle) {
      const inlineConfig = settings.config.build.inlineStylesheets;
      const { assetsInlineLimit = 4096 } = settings.config.vite?.build ?? {};
      Object.entries(bundle).forEach(([_, stylesheet]) => {
        if (stylesheet.type !== "asset" || stylesheet.name?.endsWith(".css") !== true || typeof stylesheet.source !== "string")
          return;
        const assetSize = new TextEncoder().encode(stylesheet.source).byteLength;
        const toBeInlined = inlineConfig === "always" ? true : inlineConfig === "never" ? false : assetSize <= assetsInlineLimit;
        const sheet = toBeInlined ? { type: "inline", content: stylesheet.source } : { type: "external", src: stylesheet.fileName };
        const pages = Array.from(eachPageData(internals));
        pages.forEach((pageData) => {
          const orderingInfo = pagesToCss[pageData.moduleSpecifier]?.[stylesheet.fileName];
          if (orderingInfo !== void 0)
            return pageData.styles.push({ ...orderingInfo, sheet });
          const propagatedPaths = pagesToPropagatedCss[pageData.moduleSpecifier];
          if (propagatedPaths === void 0)
            return;
          Object.entries(propagatedPaths).forEach(([pageInfoId, css]) => {
            if (css.has(stylesheet.fileName) !== true)
              return;
            if (pageData.styles.some((s) => s.sheet === sheet))
              return;
            const propagatedStyles = pageData.propagatedStyles.get(pageInfoId) ?? pageData.propagatedStyles.set(pageInfoId, /* @__PURE__ */ new Set()).get(pageInfoId);
            propagatedStyles.add(sheet);
          });
        });
      });
    }
  };
  return [cssBuildPlugin, singleCssPlugin, inlineStylesheetsPlugin];
}
function createNameHash(baseId, hashIds) {
  const baseName = baseId ? npath.parse(baseId).name : "index";
  const hash = crypto.createHash("sha256");
  for (const id of hashIds) {
    hash.update(id, "utf-8");
  }
  const h = hash.digest("hex").slice(0, 8);
  const proposedName = baseName + "." + h;
  return proposedName;
}
function* getParentClientOnlys(id, ctx, internals) {
  for (const [info] of walkParentInfos(id, ctx)) {
    yield* getPageDatasByClientOnlyID(internals, info.id);
  }
}
function appendCSSToPage(pageData, meta, pagesToCss, depth, order) {
  for (const importedCssImport of meta.importedCss) {
    const cssInfo = pagesToCss[pageData.moduleSpecifier]?.[importedCssImport];
    if (cssInfo !== void 0) {
      if (depth < cssInfo.depth) {
        cssInfo.depth = depth;
      }
      if (cssInfo.order === -1) {
        cssInfo.order = order;
      } else if (order < cssInfo.order && order > -1) {
        cssInfo.order = order;
      }
    } else {
      const cssToInfoRecord = pagesToCss[pageData.moduleSpecifier] ??= {};
      cssToInfoRecord[importedCssImport] = { depth, order };
    }
  }
}
export {
  pluginCSS
};
