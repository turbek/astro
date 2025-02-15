import { getOutputDirectory, isServerLikeOutput } from "../../prerender/utils.js";
import { BEFORE_HYDRATION_SCRIPT_ID } from "../../vite-plugin-scripts/index.js";
import { Logger } from "../logger/core.js";
import { Pipeline } from "../pipeline.js";
import { createEnvironment } from "../render/index.js";
import { createAssetLink } from "../render/ssr-element.js";
import { ASTRO_PAGE_RESOLVED_MODULE_ID } from "./plugins/plugin-pages.js";
import { RESOLVED_SPLIT_MODULE_ID } from "./plugins/plugin-ssr.js";
import { ASTRO_PAGE_EXTENSION_POST_PATTERN } from "./plugins/util.js";
class BuildPipeline extends Pipeline {
  #internals;
  #staticBuildOptions;
  #manifest;
  constructor(staticBuildOptions, internals, manifest) {
    const ssr = isServerLikeOutput(staticBuildOptions.settings.config);
    super(
      createEnvironment({
        adapterName: manifest.adapterName,
        logger: staticBuildOptions.logger,
        mode: staticBuildOptions.mode,
        renderers: manifest.renderers,
        clientDirectives: manifest.clientDirectives,
        compressHTML: manifest.compressHTML,
        async resolve(specifier) {
          const hashedFilePath = manifest.entryModules[specifier];
          if (typeof hashedFilePath !== "string" || hashedFilePath === "") {
            if (specifier === BEFORE_HYDRATION_SCRIPT_ID) {
              return "";
            }
            throw new Error(`Cannot find the built path for ${specifier}`);
          }
          return createAssetLink(hashedFilePath, manifest.base, manifest.assetsPrefix);
        },
        routeCache: staticBuildOptions.routeCache,
        site: manifest.site,
        ssr,
        streaming: true
      })
    );
    this.#internals = internals;
    this.#staticBuildOptions = staticBuildOptions;
    this.#manifest = manifest;
    this.setEndpointHandler(this.#handleEndpointResult);
  }
  getInternals() {
    return this.#internals;
  }
  getSettings() {
    return this.#staticBuildOptions.settings;
  }
  getStaticBuildOptions() {
    return this.#staticBuildOptions;
  }
  getConfig() {
    return this.#staticBuildOptions.settings.config;
  }
  getManifest() {
    return this.#manifest;
  }
  getLogger() {
    return this.getEnvironment().logger;
  }
  /**
   * The SSR build emits two important files:
   * - dist/server/manifest.mjs
   * - dist/renderers.mjs
   *
   * These two files, put together, will be used to generate the pages.
   *
   * ## Errors
   *
   * It will throw errors if the previous files can't be found in the file system.
   *
   * @param staticBuildOptions
   */
  static async retrieveManifest(staticBuildOptions, internals) {
    const config = staticBuildOptions.settings.config;
    const baseDirectory = getOutputDirectory(config);
    const manifestEntryUrl = new URL(
      `${internals.manifestFileName}?time=${Date.now()}`,
      baseDirectory
    );
    const { manifest } = await import(manifestEntryUrl.toString());
    if (!manifest) {
      throw new Error(
        "Astro couldn't find the emitted manifest. This is an internal error, please file an issue."
      );
    }
    const renderersEntryUrl = new URL(`renderers.mjs?time=${Date.now()}`, baseDirectory);
    const renderers = await import(renderersEntryUrl.toString());
    if (!renderers) {
      throw new Error(
        "Astro couldn't find the emitted renderers. This is an internal error, please file an issue."
      );
    }
    return {
      ...manifest,
      renderers: renderers.renderers
    };
  }
  /**
   * It collects the routes to generate during the build.
   *
   * It returns a map of page information and their relative entry point as a string.
   */
  retrieveRoutesToGenerate() {
    const pages = /* @__PURE__ */ new Map();
    for (const [entryPoint, filePath] of this.#internals.entrySpecifierToBundleMap) {
      if (entryPoint.includes(ASTRO_PAGE_RESOLVED_MODULE_ID) || entryPoint.includes(RESOLVED_SPLIT_MODULE_ID)) {
        const [, pageName] = entryPoint.split(":");
        const pageData = this.#internals.pagesByComponent.get(
          `${pageName.replace(ASTRO_PAGE_EXTENSION_POST_PATTERN, ".")}`
        );
        if (!pageData) {
          throw new Error(
            "Build failed. Astro couldn't find the emitted page from " + pageName + " pattern"
          );
        }
        pages.set(pageData, filePath);
      }
    }
    for (const [path, pageData] of this.#internals.pagesByComponent.entries()) {
      if (pageData.route.type === "redirect") {
        pages.set(pageData, path);
      }
    }
    return pages;
  }
  async #handleEndpointResult(_, response) {
    return response;
  }
}
export {
  BuildPipeline
};
