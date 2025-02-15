import { dim } from "kleur/colors";
import fsMod from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createContentTypesGenerator } from "../../content/index.js";
import { globalContentConfigObserver } from "../../content/utils.js";
import { telemetry } from "../../events/index.js";
import { eventCliSession } from "../../events/session.js";
import { runHookConfigSetup } from "../../integrations/index.js";
import { setUpEnvTs } from "../../vite-plugin-inject-env-ts/index.js";
import { getTimeStat } from "../build/util.js";
import { resolveConfig } from "../config/config.js";
import { createNodeLogger } from "../config/logging.js";
import { createSettings } from "../config/settings.js";
import { createVite } from "../create-vite.js";
import { AstroError, AstroErrorData, createSafeError, isAstroError } from "../errors/index.js";
async function sync(inlineConfig, options) {
  const logger = createNodeLogger(inlineConfig);
  const { userConfig, astroConfig } = await resolveConfig(inlineConfig ?? {}, "sync");
  telemetry.record(eventCliSession("sync", userConfig));
  const _settings = createSettings(astroConfig, fileURLToPath(astroConfig.root));
  const settings = await runHookConfigSetup({
    settings: _settings,
    logger,
    command: "build"
  });
  return await syncInternal(settings, { ...options, logger });
}
async function syncInternal(settings, { logger, fs }) {
  const timerStart = performance.now();
  const tempViteServer = await createServer(
    await createVite(
      {
        server: { middlewareMode: true, hmr: false, watch: { ignored: ["**"] } },
        optimizeDeps: { disabled: true },
        ssr: { external: [] },
        logLevel: "silent"
      },
      { settings, logger, mode: "build", command: "build", fs }
    )
  );
  const wsSend = tempViteServer.ws.send;
  tempViteServer.ws.send = (payload) => {
    if (payload.type === "error") {
      throw payload.err;
    }
    return wsSend(payload);
  };
  try {
    const contentTypesGenerator = await createContentTypesGenerator({
      contentConfigObserver: globalContentConfigObserver,
      logger,
      fs: fs ?? fsMod,
      settings,
      viteServer: tempViteServer
    });
    const typesResult = await contentTypesGenerator.init();
    const contentConfig = globalContentConfigObserver.get();
    if (contentConfig.status === "error") {
      throw contentConfig.error;
    }
    if (typesResult.typesGenerated === false) {
      switch (typesResult.reason) {
        case "no-content-dir":
        default:
          logger.info("content", "No content directory found. Skipping type generation.");
          return 0;
      }
    }
  } catch (e) {
    const safeError = createSafeError(e);
    if (isAstroError(e)) {
      throw e;
    }
    throw new AstroError(
      {
        ...AstroErrorData.GenerateContentTypesError,
        message: AstroErrorData.GenerateContentTypesError.message(safeError.message)
      },
      { cause: e }
    );
  } finally {
    await tempViteServer.close();
  }
  logger.info("content", `Types generated ${dim(getTimeStat(timerStart, performance.now()))}`);
  await setUpEnvTs({ settings, logger, fs: fs ?? fsMod });
  return 0;
}
export {
  sync as default,
  syncInternal
};
