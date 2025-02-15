import * as colors from "kleur/colors";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { injectImageEndpoint } from "../../assets/internal.js";
import { telemetry } from "../../events/index.js";
import { eventCliSession } from "../../events/session.js";
import {
  runHookBuildDone,
  runHookBuildStart,
  runHookConfigDone,
  runHookConfigSetup
} from "../../integrations/index.js";
import { isServerLikeOutput } from "../../prerender/utils.js";
import { resolveConfig } from "../config/config.js";
import { createNodeLogger } from "../config/logging.js";
import { createSettings } from "../config/settings.js";
import { createVite } from "../create-vite.js";
import { Logger, levels, timerMessage } from "../logger/core.js";
import { apply as applyPolyfill } from "../polyfill.js";
import { RouteCache } from "../render/route-cache.js";
import { createRouteManifest } from "../routing/index.js";
import { collectPagesData } from "./page-data.js";
import { staticBuild, viteBuild } from "./static-build.js";
import { getTimeStat } from "./util.js";
async function build(inlineConfig, options) {
  applyPolyfill();
  const logger = createNodeLogger(inlineConfig);
  const { userConfig, astroConfig } = await resolveConfig(inlineConfig, "build");
  telemetry.record(eventCliSession("build", userConfig));
  const settings = createSettings(astroConfig, fileURLToPath(astroConfig.root));
  const builder = new AstroBuilder(settings, {
    ...options,
    logger,
    mode: inlineConfig.mode
  });
  await builder.run();
}
class AstroBuilder {
  settings;
  logger;
  mode = "production";
  origin;
  routeCache;
  manifest;
  timer;
  teardownCompiler;
  constructor(settings, options) {
    if (options.mode) {
      this.mode = options.mode;
    }
    this.settings = settings;
    this.logger = options.logger;
    this.teardownCompiler = options.teardownCompiler ?? true;
    this.routeCache = new RouteCache(this.logger);
    this.origin = settings.config.site ? new URL(settings.config.site).origin : `http://localhost:${settings.config.server.port}`;
    this.manifest = { routes: [] };
    this.timer = {};
  }
  /** Setup Vite and run any async setup logic that couldn't run inside of the constructor. */
  async setup() {
    this.logger.debug("build", "Initial setup...");
    const { logger } = this;
    this.timer.init = performance.now();
    this.settings = await runHookConfigSetup({
      settings: this.settings,
      command: "build",
      logger
    });
    if (isServerLikeOutput(this.settings.config)) {
      this.settings = injectImageEndpoint(this.settings);
    }
    this.manifest = createRouteManifest({ settings: this.settings }, this.logger);
    const viteConfig = await createVite(
      {
        mode: this.mode,
        server: {
          hmr: false,
          middlewareMode: true
        }
      },
      { settings: this.settings, logger: this.logger, mode: "build", command: "build" }
    );
    await runHookConfigDone({ settings: this.settings, logger });
    const { syncInternal } = await import("../sync/index.js");
    const syncRet = await syncInternal(this.settings, { logger, fs });
    if (syncRet !== 0) {
      return process.exit(syncRet);
    }
    return { viteConfig };
  }
  /** Run the build logic. build() is marked private because usage should go through ".run()" */
  async build({ viteConfig }) {
    await runHookBuildStart({ config: this.settings.config, logging: this.logger });
    this.validateConfig();
    this.logger.info("build", `output target: ${colors.green(this.settings.config.output)}`);
    if (this.settings.adapter) {
      this.logger.info("build", `deploy adapter: ${colors.green(this.settings.adapter.name)}`);
    }
    this.logger.info("build", "Collecting build info...");
    this.timer.loadStart = performance.now();
    const { assets, allPages } = await collectPagesData({
      settings: this.settings,
      logger: this.logger,
      manifest: this.manifest
    });
    this.logger.debug("build", timerMessage("All pages loaded", this.timer.loadStart));
    const pageNames = [];
    this.timer.buildStart = performance.now();
    this.logger.info(
      "build",
      colors.dim(`Completed in ${getTimeStat(this.timer.init, performance.now())}.`)
    );
    const opts = {
      allPages,
      settings: this.settings,
      logger: this.logger,
      manifest: this.manifest,
      mode: this.mode,
      origin: this.origin,
      pageNames,
      routeCache: this.routeCache,
      teardownCompiler: this.teardownCompiler,
      viteConfig
    };
    const { internals } = await viteBuild(opts);
    await staticBuild(opts, internals);
    this.timer.assetsStart = performance.now();
    Object.keys(assets).map((k) => {
      if (!assets[k])
        return;
      const filePath = new URL(`file://${k}`);
      fs.mkdirSync(new URL("./", filePath), { recursive: true });
      fs.writeFileSync(filePath, assets[k], "utf8");
      delete assets[k];
    });
    this.logger.debug("build", timerMessage("Additional assets copied", this.timer.assetsStart));
    await runHookBuildDone({
      config: this.settings.config,
      pages: pageNames,
      routes: Object.values(allPages).map((pd) => pd.route),
      logging: this.logger
    });
    if (this.logger.level && levels[this.logger.level()] <= levels["info"]) {
      await this.printStats({
        logger: this.logger,
        timeStart: this.timer.init,
        pageCount: pageNames.length,
        buildMode: this.settings.config.output
      });
    }
    this.settings.timer.writeStats();
  }
  /** Build the given Astro project.  */
  async run() {
    const setupData = await this.setup();
    try {
      await this.build(setupData);
    } catch (_err) {
      throw _err;
    }
  }
  validateConfig() {
    const { config } = this.settings;
    if (config.outDir.toString() === config.root.toString()) {
      throw new Error(
        `the outDir cannot be the root folder. Please build to a folder such as dist.`
      );
    }
    if (config.build.split === true) {
      if (config.output === "static") {
        this.logger.warn(
          "configuration",
          'The option `build.split` won\'t take effect, because `output` is not `"server"` or `"hybrid"`.'
        );
      }
      this.logger.warn(
        "configuration",
        "The option `build.split` is deprecated. Use the adapter options."
      );
    }
    if (config.build.excludeMiddleware === true) {
      if (config.output === "static") {
        this.logger.warn(
          "configuration",
          'The option `build.excludeMiddleware` won\'t take effect, because `output` is not `"server"` or `"hybrid"`.'
        );
      }
      this.logger.warn(
        "configuration",
        "The option `build.excludeMiddleware` is deprecated. Use the adapter options."
      );
    }
  }
  /** Stats */
  async printStats({
    logger,
    timeStart,
    pageCount,
    buildMode
  }) {
    const total = getTimeStat(timeStart, performance.now());
    let messages = [];
    if (buildMode === "static") {
      messages = [`${pageCount} page(s) built in`, colors.bold(total)];
    } else {
      messages = ["Server built in", colors.bold(total)];
    }
    logger.info("build", messages.join(" "));
    logger.info("build", `${colors.bold("Complete!")}`);
  }
}
export {
  build as default
};
