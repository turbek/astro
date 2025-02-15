import nodeFs from "node:fs";
import { fileURLToPath } from "node:url";
import * as vite from "vite";
import { crawlFrameworkPkgs } from "vitefu";
import astroAssetsPlugin from "../assets/vite-plugin-assets.js";
import {
  astroContentAssetPropagationPlugin,
  astroContentImportPlugin,
  astroContentVirtualModPlugin
} from "../content/index.js";
import astroTransitions from "../transitions/vite-plugin-transitions.js";
import astroPostprocessVitePlugin from "../vite-plugin-astro-postprocess/index.js";
import { vitePluginAstroServer } from "../vite-plugin-astro-server/index.js";
import astroVitePlugin from "../vite-plugin-astro/index.js";
import configAliasVitePlugin from "../vite-plugin-config-alias/index.js";
import envVitePlugin from "../vite-plugin-env/index.js";
import astroHeadPlugin from "../vite-plugin-head/index.js";
import htmlVitePlugin from "../vite-plugin-html/index.js";
import { astroInjectEnvTsPlugin } from "../vite-plugin-inject-env-ts/index.js";
import astroIntegrationsContainerPlugin from "../vite-plugin-integrations-container/index.js";
import astroLoadFallbackPlugin from "../vite-plugin-load-fallback/index.js";
import markdownVitePlugin from "../vite-plugin-markdown/index.js";
import mdxVitePlugin from "../vite-plugin-mdx/index.js";
import astroScannerPlugin from "../vite-plugin-scanner/index.js";
import astroScriptsPlugin from "../vite-plugin-scripts/index.js";
import astroScriptsPageSSRPlugin from "../vite-plugin-scripts/page-ssr.js";
import { vitePluginSSRManifest } from "../vite-plugin-ssr-manifest/index.js";
import { joinPaths } from "./path.js";
const ALWAYS_NOEXTERNAL = [
  // This is only because Vite's native ESM doesn't resolve "exports" correctly.
  "astro",
  // Vite fails on nested `.astro` imports without bundling
  "astro/components",
  // Handle recommended nanostores. Only @nanostores/preact is required from our testing!
  // Full explanation and related bug report: https://github.com/withastro/astro/pull/3667
  "@nanostores/preact",
  // fontsource packages are CSS that need to be processed
  "@fontsource/*"
];
const ONLY_DEV_EXTERNAL = [
  // Imported by `<Code/>` which is processed by Vite
  "shiki",
  // Imported by `@astrojs/prism` which exposes `<Prism/>` that is processed by Vite
  "prismjs/components/index.js",
  // Imported by `astro/assets` -> `packages/astro/src/core/logger/core.ts`
  "string-width"
];
async function createVite(commandConfig, { settings, logger, mode, command, fs = nodeFs }) {
  const astroPkgsConfig = await crawlFrameworkPkgs({
    root: fileURLToPath(settings.config.root),
    isBuild: mode === "build",
    viteUserConfig: settings.config.vite,
    isFrameworkPkgByJson(pkgJson) {
      if (pkgJson?.astro?.external === true) {
        return false;
      }
      return (
        // Attempt: package relies on `astro`. ✅ Definitely an Astro package
        pkgJson.peerDependencies?.astro || pkgJson.dependencies?.astro || // Attempt: package is tagged with `astro` or `astro-component`. ✅ Likely a community package
        pkgJson.keywords?.includes("astro") || pkgJson.keywords?.includes("astro-component") || // Attempt: package is named `astro-something` or `@scope/astro-something`. ✅ Likely a community package
        /^(@[^\/]+\/)?astro\-/.test(pkgJson.name)
      );
    },
    isFrameworkPkgByName(pkgName) {
      const isNotAstroPkg = isCommonNotAstro(pkgName);
      if (isNotAstroPkg) {
        return false;
      } else {
        return void 0;
      }
    }
  });
  const commonConfig = {
    cacheDir: fileURLToPath(new URL("./node_modules/.vite/", settings.config.root)),
    // using local caches allows Astro to be used in monorepos, etc.
    clearScreen: false,
    // we want to control the output, not Vite
    logLevel: "warn",
    // log warnings and errors only
    appType: "custom",
    optimizeDeps: {
      entries: ["src/**/*"],
      exclude: ["astro", "node-fetch"]
    },
    plugins: [
      configAliasVitePlugin({ settings }),
      astroLoadFallbackPlugin({ fs, root: settings.config.root }),
      astroVitePlugin({ settings, logger }),
      astroScriptsPlugin({ settings }),
      // The server plugin is for dev only and having it run during the build causes
      // the build to run very slow as the filewatcher is triggered often.
      mode !== "build" && vitePluginAstroServer({ settings, logger, fs }),
      envVitePlugin({ settings }),
      markdownVitePlugin({ settings, logger }),
      htmlVitePlugin(),
      mdxVitePlugin({ settings, logger }),
      astroPostprocessVitePlugin(),
      astroIntegrationsContainerPlugin({ settings, logger }),
      astroScriptsPageSSRPlugin({ settings }),
      astroHeadPlugin(),
      astroScannerPlugin({ settings, logger }),
      astroInjectEnvTsPlugin({ settings, logger, fs }),
      astroContentVirtualModPlugin({ settings }),
      astroContentImportPlugin({ fs, settings }),
      astroContentAssetPropagationPlugin({ mode, settings }),
      vitePluginSSRManifest(),
      astroAssetsPlugin({ settings, logger, mode }),
      astroTransitions()
    ],
    publicDir: fileURLToPath(settings.config.publicDir),
    root: fileURLToPath(settings.config.root),
    envPrefix: settings.config.vite?.envPrefix ?? "PUBLIC_",
    define: {
      "import.meta.env.SITE": settings.config.site ? JSON.stringify(settings.config.site) : "undefined"
    },
    server: {
      hmr: process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production" ? false : void 0,
      // disable HMR for test
      // handle Vite URLs
      proxy: {
        // add proxies here
      },
      watch: {
        // Prevent watching during the build to speed it up
        ignored: mode === "build" ? ["**"] : void 0
      }
    },
    resolve: {
      alias: [
        {
          // This is needed for Deno compatibility, as the non-browser version
          // of this module depends on Node `crypto`
          find: "randombytes",
          replacement: "randombytes/browser"
        },
        {
          // Typings are imported from 'astro' (e.g. import { Type } from 'astro')
          find: /^astro$/,
          replacement: fileURLToPath(new URL("../@types/astro.js", import.meta.url))
        },
        {
          find: "astro:middleware",
          replacement: "astro/middleware/namespace"
        },
        {
          find: "astro:components",
          replacement: "astro/components"
        }
      ],
      conditions: ["astro"],
      // Astro imports in third-party packages should use the same version as root
      dedupe: ["astro"]
    },
    ssr: {
      noExternal: [...ALWAYS_NOEXTERNAL, ...astroPkgsConfig.ssr.noExternal],
      external: [...mode === "dev" ? ONLY_DEV_EXTERNAL : [], ...astroPkgsConfig.ssr.external]
    }
  };
  const assetsPrefix = settings.config.build.assetsPrefix;
  if (assetsPrefix) {
    commonConfig.experimental = {
      renderBuiltUrl(filename, { type }) {
        if (type === "asset") {
          return joinPaths(assetsPrefix, filename);
        }
      }
    };
  }
  let result = commonConfig;
  if (command && settings.config.vite?.plugins) {
    let { plugins, ...rest } = settings.config.vite;
    const applyToFilter = command === "build" ? "serve" : "build";
    const applyArgs = [
      { ...settings.config.vite, mode },
      { command: command === "dev" ? "serve" : command, mode }
    ];
    plugins = plugins.flat(Infinity).filter((p) => {
      if (!p || p?.apply === applyToFilter) {
        return false;
      }
      if (typeof p.apply === "function") {
        return p.apply(applyArgs[0], applyArgs[1]);
      }
      return true;
    });
    result = vite.mergeConfig(result, { ...rest, plugins });
  } else {
    result = vite.mergeConfig(result, settings.config.vite || {});
  }
  result = vite.mergeConfig(result, commandConfig);
  return result;
}
const COMMON_DEPENDENCIES_NOT_ASTRO = [
  "autoprefixer",
  "react",
  "react-dom",
  "preact",
  "preact-render-to-string",
  "vue",
  "svelte",
  "solid-js",
  "lit",
  "cookie",
  "dotenv",
  "esbuild",
  "eslint",
  "jest",
  "postcss",
  "prettier",
  "astro",
  "tslib",
  "typescript",
  "vite"
];
const COMMON_PREFIXES_NOT_ASTRO = [
  "@webcomponents/",
  "@fontsource/",
  "@postcss-plugins/",
  "@rollup/",
  "@astrojs/renderer-",
  "@types/",
  "@typescript-eslint/",
  "eslint-",
  "jest-",
  "postcss-plugin-",
  "prettier-plugin-",
  "remark-",
  "rehype-",
  "rollup-plugin-",
  "vite-plugin-"
];
function isCommonNotAstro(dep) {
  return COMMON_DEPENDENCIES_NOT_ASTRO.includes(dep) || COMMON_PREFIXES_NOT_ASTRO.some(
    (prefix) => prefix.startsWith("@") ? dep.startsWith(prefix) : dep.substring(dep.lastIndexOf("/") + 1).startsWith(prefix)
    // check prefix omitting @scope/
  );
}
export {
  createVite
};
