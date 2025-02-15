import glob from "fast-glob";
import { fileURLToPath } from "node:url";
import {} from "vite";
import { runHookBuildSsr } from "../../../integrations/index.js";
import { BEFORE_HYDRATION_SCRIPT_ID, PAGE_SCRIPT_ID } from "../../../vite-plugin-scripts/index.js";
import { joinPaths, prependForwardSlash } from "../../path.js";
import { serializeRouteData } from "../../routing/index.js";
import { addRollupInput } from "../add-rollup-input.js";
import { getOutFile, getOutFolder } from "../common.js";
import { cssOrder, mergeInlineCss } from "../internal.js";
const manifestReplace = "@@ASTRO_MANIFEST_REPLACE@@";
const replaceExp = new RegExp(`['"](${manifestReplace})['"]`, "g");
const SSR_MANIFEST_VIRTUAL_MODULE_ID = "@astrojs-manifest";
const RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID = "\0" + SSR_MANIFEST_VIRTUAL_MODULE_ID;
function vitePluginManifest(options, internals) {
  return {
    name: "@astro/plugin-build-manifest",
    enforce: "post",
    options(opts) {
      return addRollupInput(opts, [SSR_MANIFEST_VIRTUAL_MODULE_ID]);
    },
    resolveId(id) {
      if (id === SSR_MANIFEST_VIRTUAL_MODULE_ID) {
        return RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID;
      }
    },
    augmentChunkHash(chunkInfo) {
      if (chunkInfo.facadeModuleId === RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID) {
        return Date.now().toString();
      }
    },
    async load(id) {
      if (id === RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID) {
        const imports = [];
        const contents = [];
        const exports = [];
        imports.push(
          `import { deserializeManifest as _deserializeManifest } from 'astro/app'`,
          `import { _privateSetManifestDontUseThis } from 'astro:ssr-manifest'`
        );
        contents.push(`
const manifest = _deserializeManifest('${manifestReplace}');
_privateSetManifestDontUseThis(manifest);
`);
        exports.push("export { manifest }");
        return `${imports.join("\n")}${contents.join("\n")}${exports.join("\n")}`;
      }
    },
    async generateBundle(_opts, bundle) {
      for (const [chunkName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "asset") {
          continue;
        }
        if (chunk.modules[RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID]) {
          internals.manifestEntryChunk = chunk;
          delete bundle[chunkName];
        }
        if (chunkName.startsWith("manifest")) {
          internals.manifestFileName = chunkName;
        }
      }
    }
  };
}
function pluginManifest(options, internals) {
  return {
    build: "ssr",
    hooks: {
      "build:before": () => {
        return {
          vitePlugin: vitePluginManifest(options, internals)
        };
      },
      "build:post": async ({ mutate }) => {
        if (!internals.manifestEntryChunk) {
          throw new Error(`Did not generate an entry chunk for SSR`);
        }
        const manifest = await createManifest(options, internals);
        const shouldPassMiddlewareEntryPoint = (
          // TODO: remove in Astro 4.0
          options.settings.config.build.excludeMiddleware || options.settings.adapter?.adapterFeatures?.edgeMiddleware
        );
        await runHookBuildSsr({
          config: options.settings.config,
          manifest,
          logger: options.logger,
          entryPoints: internals.entryPoints,
          middlewareEntryPoint: shouldPassMiddlewareEntryPoint ? internals.middlewareEntryPoint : void 0
        });
        const code = injectManifest(manifest, internals.manifestEntryChunk);
        mutate(internals.manifestEntryChunk, "server", code);
      }
    }
  };
}
async function createManifest(buildOpts, internals) {
  if (!internals.manifestEntryChunk) {
    throw new Error(`Did not generate an entry chunk for SSR`);
  }
  const clientStatics = new Set(
    await glob("**/*", {
      cwd: fileURLToPath(buildOpts.settings.config.build.client)
    })
  );
  for (const file of clientStatics) {
    internals.staticFiles.add(file);
  }
  const staticFiles = internals.staticFiles;
  return buildManifest(buildOpts, internals, Array.from(staticFiles));
}
function injectManifest(manifest, chunk) {
  const code = chunk.code;
  return code.replace(replaceExp, () => {
    return JSON.stringify(manifest);
  });
}
function buildManifest(opts, internals, staticFiles) {
  const { settings } = opts;
  const routes = [];
  const entryModules = Object.fromEntries(internals.entrySpecifierToBundleMap.entries());
  if (settings.scripts.some((script) => script.stage === "page")) {
    staticFiles.push(entryModules[PAGE_SCRIPT_ID]);
  }
  const prefixAssetPath = (pth) => {
    if (settings.config.build.assetsPrefix) {
      return joinPaths(settings.config.build.assetsPrefix, pth);
    } else {
      return prependForwardSlash(joinPaths(settings.config.base, pth));
    }
  };
  for (const route of opts.manifest.routes) {
    if (!route.prerender)
      continue;
    if (!route.pathname)
      continue;
    const outFolder = getOutFolder(opts.settings.config, route.pathname, route.type);
    const outFile = getOutFile(opts.settings.config, outFolder, route.pathname, route.type);
    const file = outFile.toString().replace(opts.settings.config.build.client.toString(), "");
    routes.push({
      file,
      links: [],
      scripts: [],
      styles: [],
      routeData: serializeRouteData(route, settings.config.trailingSlash)
    });
    staticFiles.push(file);
  }
  for (const route of opts.manifest.routes) {
    const pageData = internals.pagesByComponent.get(route.component);
    if (route.prerender || !pageData)
      continue;
    const scripts = [];
    if (pageData.hoistedScript) {
      const hoistedValue = pageData.hoistedScript.value;
      const value = hoistedValue.endsWith(".js") ? prefixAssetPath(hoistedValue) : hoistedValue;
      scripts.unshift(
        Object.assign({}, pageData.hoistedScript, {
          value
        })
      );
    }
    if (settings.scripts.some((script) => script.stage === "page")) {
      const src = entryModules[PAGE_SCRIPT_ID];
      scripts.push({
        type: "external",
        value: prefixAssetPath(src)
      });
    }
    const links = [];
    const styles = pageData.styles.sort(cssOrder).map(({ sheet }) => sheet).map((s) => s.type === "external" ? { ...s, src: prefixAssetPath(s.src) } : s).reduce(mergeInlineCss, []);
    routes.push({
      file: "",
      links,
      scripts: [
        ...scripts,
        ...settings.scripts.filter((script) => script.stage === "head-inline").map(({ stage, content }) => ({ stage, children: content }))
      ],
      styles,
      routeData: serializeRouteData(route, settings.config.trailingSlash)
    });
  }
  if (!(BEFORE_HYDRATION_SCRIPT_ID in entryModules)) {
    entryModules[BEFORE_HYDRATION_SCRIPT_ID] = "";
  }
  const ssrManifest = {
    adapterName: opts.settings.adapter?.name ?? "",
    routes,
    site: settings.config.site,
    base: settings.config.base,
    compressHTML: settings.config.compressHTML,
    assetsPrefix: settings.config.build.assetsPrefix,
    componentMetadata: Array.from(internals.componentMetadata),
    renderers: [],
    clientDirectives: Array.from(settings.clientDirectives),
    entryModules,
    assets: staticFiles.map(prefixAssetPath)
  };
  return ssrManifest;
}
export {
  RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID,
  SSR_MANIFEST_VIRTUAL_MODULE_ID,
  createManifest,
  injectManifest,
  pluginManifest
};
