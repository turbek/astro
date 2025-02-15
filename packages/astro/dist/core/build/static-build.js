import { teardown } from "@astrojs/compiler";
import * as eslexer from "es-module-lexer";
import glob from "fast-glob";
import { bgGreen, bgMagenta, black, dim } from "kleur/colors";
import fs from "node:fs";
import path, { extname } from "node:path";
import { fileURLToPath } from "node:url";
import * as vite from "vite";
import {
  createBuildInternals,
  eachPageData
} from "../../core/build/internal.js";
import { emptyDir, removeEmptyDirs } from "../../core/fs/index.js";
import { appendForwardSlash, prependForwardSlash } from "../../core/path.js";
import { isModeServerWithNoAdapter } from "../../core/util.js";
import { runHookBuildSetup } from "../../integrations/index.js";
import { getOutputDirectory, isServerLikeOutput } from "../../prerender/utils.js";
import { PAGE_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { AstroError, AstroErrorData } from "../errors/index.js";
import { routeIsRedirect } from "../redirects/index.js";
import { getOutDirWithinCwd } from "./common.js";
import { generatePages } from "./generate.js";
import { trackPageData } from "./internal.js";
import { createPluginContainer } from "./plugin.js";
import { registerAllPlugins } from "./plugins/index.js";
import { RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID } from "./plugins/plugin-manifest.js";
import { ASTRO_PAGE_RESOLVED_MODULE_ID } from "./plugins/plugin-pages.js";
import { RESOLVED_RENDERERS_MODULE_ID } from "./plugins/plugin-renderers.js";
import { RESOLVED_SPLIT_MODULE_ID, RESOLVED_SSR_VIRTUAL_MODULE_ID } from "./plugins/plugin-ssr.js";
import { ASTRO_PAGE_EXTENSION_POST_PATTERN } from "./plugins/util.js";
import { getTimeStat } from "./util.js";
async function viteBuild(opts) {
  const { allPages, settings } = opts;
  if (isModeServerWithNoAdapter(opts.settings)) {
    throw new AstroError(AstroErrorData.NoAdapterInstalled);
  }
  settings.timer.start("SSR build");
  const pageInput = /* @__PURE__ */ new Set();
  const facadeIdToPageDataMap = /* @__PURE__ */ new Map();
  const internals = createBuildInternals();
  for (const [component, pageData] of Object.entries(allPages)) {
    const astroModuleURL = new URL("./" + component, settings.config.root);
    const astroModuleId = prependForwardSlash(component);
    trackPageData(internals, component, pageData, astroModuleId, astroModuleURL);
    if (!routeIsRedirect(pageData.route)) {
      pageInput.add(astroModuleId);
      facadeIdToPageDataMap.set(fileURLToPath(astroModuleURL), pageData);
    }
  }
  if (settings.config?.vite?.build?.emptyOutDir !== false) {
    emptyDir(settings.config.outDir, new Set(".git"));
  }
  const container = createPluginContainer(opts, internals);
  registerAllPlugins(container);
  const ssrTime = performance.now();
  opts.logger.info("build", `Building ${settings.config.output} entrypoints...`);
  const ssrOutput = await ssrBuild(opts, internals, pageInput, container);
  opts.logger.info("build", dim(`Completed in ${getTimeStat(ssrTime, performance.now())}.`));
  settings.timer.end("SSR build");
  settings.timer.start("Client build");
  const rendererClientEntrypoints = settings.renderers.map((r) => r.clientEntrypoint).filter((a) => typeof a === "string");
  const clientInput = /* @__PURE__ */ new Set([
    ...internals.discoveredHydratedComponents.keys(),
    ...internals.discoveredClientOnlyComponents.keys(),
    ...rendererClientEntrypoints,
    ...internals.discoveredScripts
  ]);
  if (settings.scripts.some((script) => script.stage === "page")) {
    clientInput.add(PAGE_SCRIPT_ID);
  }
  const clientOutput = await clientBuild(opts, internals, clientInput, container);
  await runPostBuildHooks(container, ssrOutput, clientOutput);
  settings.timer.end("Client build");
  internals.ssrEntryChunk = void 0;
  if (opts.teardownCompiler) {
    teardown();
  }
  return { internals };
}
async function staticBuild(opts, internals) {
  const { settings } = opts;
  switch (true) {
    case settings.config.output === "static": {
      settings.timer.start("Static generate");
      await generatePages(opts, internals);
      await cleanServerOutput(opts);
      settings.timer.end("Static generate");
      return;
    }
    case isServerLikeOutput(settings.config): {
      settings.timer.start("Server generate");
      await generatePages(opts, internals);
      await cleanStaticOutput(opts, internals);
      opts.logger.info(null, `
${bgMagenta(black(" finalizing server assets "))}
`);
      await ssrMoveAssets(opts);
      settings.timer.end("Server generate");
      return;
    }
  }
}
async function ssrBuild(opts, internals, input, container) {
  const { allPages, settings, viteConfig } = opts;
  const ssr = isServerLikeOutput(settings.config);
  const out = getOutputDirectory(settings.config);
  const routes = Object.values(allPages).map((pd) => pd.route);
  const { lastVitePlugins, vitePlugins } = container.runBeforeHook("ssr", input);
  const viteBuildConfig = {
    ...viteConfig,
    mode: viteConfig.mode || "production",
    // Check using `settings...` as `viteConfig` always defaults to `warn` by Astro
    logLevel: settings.config.vite.logLevel ?? "error",
    build: {
      target: "esnext",
      // Vite defaults cssMinify to false in SSR by default, but we want to minify it
      // as the CSS generated are used and served to the client.
      cssMinify: viteConfig.build?.minify == null ? true : !!viteConfig.build?.minify,
      ...viteConfig.build,
      emptyOutDir: false,
      manifest: false,
      outDir: fileURLToPath(out),
      copyPublicDir: !ssr,
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        input: [],
        output: {
          format: "esm",
          // Server chunks can't go in the assets (_astro) folder
          // We need to keep these separate
          chunkFileNames(chunkInfo) {
            const { name } = chunkInfo;
            if (name.includes(ASTRO_PAGE_EXTENSION_POST_PATTERN)) {
              const [sanitizedName] = name.split(ASTRO_PAGE_EXTENSION_POST_PATTERN);
              return `chunks/${sanitizedName}_[hash].mjs`;
            }
            if (name.startsWith("pages/")) {
              const sanitizedName = name.split(".")[0];
              return `chunks/${sanitizedName}_[hash].mjs`;
            }
            return `chunks/[name]_[hash].mjs`;
          },
          assetFileNames: `${settings.config.build.assets}/[name].[hash][extname]`,
          ...viteConfig.build?.rollupOptions?.output,
          entryFileNames(chunkInfo) {
            if (chunkInfo.facadeModuleId?.startsWith(ASTRO_PAGE_RESOLVED_MODULE_ID)) {
              return makeAstroPageEntryPointFileName(
                ASTRO_PAGE_RESOLVED_MODULE_ID,
                chunkInfo.facadeModuleId,
                routes
              );
            } else if (chunkInfo.facadeModuleId?.startsWith(RESOLVED_SPLIT_MODULE_ID)) {
              return makeSplitEntryPointFileName(chunkInfo.facadeModuleId, routes);
            } else if (chunkInfo.facadeModuleId === RESOLVED_SSR_VIRTUAL_MODULE_ID) {
              return opts.settings.config.build.serverEntry;
            } else if (chunkInfo.facadeModuleId === RESOLVED_RENDERERS_MODULE_ID) {
              return "renderers.mjs";
            } else if (chunkInfo.facadeModuleId === RESOLVED_SSR_MANIFEST_VIRTUAL_MODULE_ID) {
              return "manifest_[hash].mjs";
            } else {
              return "[name].mjs";
            }
          }
        }
      },
      ssr: true,
      ssrEmitAssets: true,
      // improve build performance
      minify: false,
      modulePreload: { polyfill: false },
      reportCompressedSize: false
    },
    plugins: [...vitePlugins, ...viteConfig.plugins || [], ...lastVitePlugins],
    envPrefix: viteConfig.envPrefix ?? "PUBLIC_",
    base: settings.config.base
  };
  const updatedViteBuildConfig = await runHookBuildSetup({
    config: settings.config,
    pages: internals.pagesByComponent,
    vite: viteBuildConfig,
    target: "server",
    logger: opts.logger
  });
  return await vite.build(updatedViteBuildConfig);
}
async function clientBuild(opts, internals, input, container) {
  const { settings, viteConfig } = opts;
  const timer = performance.now();
  const ssr = isServerLikeOutput(settings.config);
  const out = ssr ? settings.config.build.client : getOutDirWithinCwd(settings.config.outDir);
  if (!input.size) {
    if (ssr) {
      await copyFiles(settings.config.publicDir, out, true);
    }
    return null;
  }
  const { lastVitePlugins, vitePlugins } = container.runBeforeHook("client", input);
  opts.logger.info(null, `
${bgGreen(black(" building client "))}`);
  const viteBuildConfig = {
    ...viteConfig,
    mode: viteConfig.mode || "production",
    // Check using `settings...` as `viteConfig` always defaults to `warn` by Astro
    logLevel: settings.config.vite.logLevel ?? "info",
    build: {
      target: "esnext",
      ...viteConfig.build,
      emptyOutDir: false,
      outDir: fileURLToPath(out),
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        input: Array.from(input),
        output: {
          format: "esm",
          entryFileNames: `${settings.config.build.assets}/[name].[hash].js`,
          chunkFileNames: `${settings.config.build.assets}/[name].[hash].js`,
          assetFileNames: `${settings.config.build.assets}/[name].[hash][extname]`,
          ...viteConfig.build?.rollupOptions?.output
        },
        preserveEntrySignatures: "exports-only"
      }
    },
    plugins: [...vitePlugins, ...viteConfig.plugins || [], ...lastVitePlugins],
    envPrefix: viteConfig.envPrefix ?? "PUBLIC_",
    base: settings.config.base
  };
  await runHookBuildSetup({
    config: settings.config,
    pages: internals.pagesByComponent,
    vite: viteBuildConfig,
    target: "client",
    logger: opts.logger
  });
  const buildResult = await vite.build(viteBuildConfig);
  opts.logger.info(null, dim(`Completed in ${getTimeStat(timer, performance.now())}.
`));
  return buildResult;
}
async function runPostBuildHooks(container, ssrReturn, clientReturn) {
  const mutations = await container.runPostHook(ssrReturn, clientReturn);
  const config = container.options.settings.config;
  const build = container.options.settings.config.build;
  for (const [fileName, mutation] of mutations) {
    const root = isServerLikeOutput(config) ? mutation.build === "server" ? build.server : build.client : config.outDir;
    const fileURL = new URL(fileName, root);
    await fs.promises.mkdir(new URL("./", fileURL), { recursive: true });
    await fs.promises.writeFile(fileURL, mutation.code, "utf-8");
  }
}
async function cleanStaticOutput(opts, internals) {
  const allStaticFiles = /* @__PURE__ */ new Set();
  for (const pageData of eachPageData(internals)) {
    if (pageData.route.prerender) {
      const { moduleSpecifier } = pageData;
      const pageBundleId = internals.pageToBundleMap.get(moduleSpecifier);
      const entryBundleId = internals.entrySpecifierToBundleMap.get(moduleSpecifier);
      allStaticFiles.add(pageBundleId ?? entryBundleId);
    }
  }
  const ssr = isServerLikeOutput(opts.settings.config);
  const out = ssr ? opts.settings.config.build.server : getOutDirWithinCwd(opts.settings.config.outDir);
  const files = await glob("**/*.mjs", {
    cwd: fileURLToPath(out)
  });
  if (files.length) {
    await eslexer.init;
    await Promise.all(
      files.map(async (filename) => {
        if (!allStaticFiles.has(filename)) {
          return;
        }
        const url = new URL(filename, out);
        const text = await fs.promises.readFile(url, { encoding: "utf8" });
        const [, exports] = eslexer.parse(text);
        let value = "const noop = () => {};";
        for (const e of exports) {
          if (e.n === "default")
            value += `
 export default noop;`;
          else
            value += `
export const ${e.n} = noop;`;
        }
        await fs.promises.writeFile(url, value, { encoding: "utf8" });
      })
    );
    removeEmptyDirs(out);
  }
}
async function cleanServerOutput(opts) {
  const out = getOutDirWithinCwd(opts.settings.config.outDir);
  const files = await glob("**/*.mjs", {
    cwd: fileURLToPath(out),
    // Important! Also cleanup dotfiles like `node_modules/.pnpm/**`
    dot: true
  });
  if (files.length) {
    await Promise.all(
      files.map(async (filename) => {
        const url = new URL(filename, out);
        await fs.promises.rm(url);
      })
    );
    removeEmptyDirs(out);
  }
  if (out.toString() !== opts.settings.config.outDir.toString()) {
    await copyFiles(out, opts.settings.config.outDir);
    await fs.promises.rm(out, { recursive: true });
    return;
  }
}
async function copyFiles(fromFolder, toFolder, includeDotfiles = false) {
  const files = await glob("**/*", {
    cwd: fileURLToPath(fromFolder),
    dot: includeDotfiles
  });
  await Promise.all(
    files.map(async (filename) => {
      const from = new URL(filename, fromFolder);
      const to = new URL(filename, toFolder);
      const lastFolder = new URL("./", to);
      return fs.promises.mkdir(lastFolder, { recursive: true }).then(() => fs.promises.copyFile(from, to));
    })
  );
}
async function ssrMoveAssets(opts) {
  opts.logger.info("build", "Rearranging server assets...");
  const serverRoot = opts.settings.config.output === "static" ? opts.settings.config.build.client : opts.settings.config.build.server;
  const clientRoot = opts.settings.config.build.client;
  const assets = opts.settings.config.build.assets;
  const serverAssets = new URL(`./${assets}/`, appendForwardSlash(serverRoot.toString()));
  const clientAssets = new URL(`./${assets}/`, appendForwardSlash(clientRoot.toString()));
  const files = await glob(`**/*`, {
    cwd: fileURLToPath(serverAssets)
  });
  if (files.length > 0) {
    await Promise.all(
      files.map(async (filename) => {
        const currentUrl = new URL(filename, appendForwardSlash(serverAssets.toString()));
        const clientUrl = new URL(filename, appendForwardSlash(clientAssets.toString()));
        const dir = new URL(path.parse(clientUrl.href).dir);
        if (!fs.existsSync(dir))
          await fs.promises.mkdir(dir, { recursive: true });
        return fs.promises.rename(currentUrl, clientUrl);
      })
    );
    removeEmptyDirs(serverAssets);
  }
}
function makeAstroPageEntryPointFileName(prefix, facadeModuleId, routes) {
  const pageModuleId = facadeModuleId.replace(prefix, "").replace(ASTRO_PAGE_EXTENSION_POST_PATTERN, ".");
  const route = routes.find((routeData) => routeData.component === pageModuleId);
  const name = route?.route ?? pageModuleId;
  return `pages${name.replace(/\/$/, "/index").replaceAll(/[\[\]]/g, "_").replaceAll("...", "---")}.astro.mjs`;
}
function makeSplitEntryPointFileName(facadeModuleId, routes) {
  const filePath = `${makeAstroPageEntryPointFileName(
    RESOLVED_SPLIT_MODULE_ID,
    facadeModuleId,
    routes
  )}`;
  const pathComponents = filePath.split(path.sep);
  const lastPathComponent = pathComponents.pop();
  if (lastPathComponent) {
    const extension = extname(lastPathComponent);
    if (extension.length > 0) {
      const newFileName = `entry.${lastPathComponent}`;
      return [...pathComponents, newFileName].join(path.sep);
    }
  }
  return filePath;
}
export {
  makeAstroPageEntryPointFileName,
  makeSplitEntryPointFileName,
  staticBuild,
  viteBuild
};
