import nodeFs from "node:fs";
import { fileURLToPath } from "node:url";
import * as vite from "vite";
import { eventCliSession, telemetry } from "../../events/index.js";
import { createNodeLogger, createSettings, resolveConfig } from "../config/index.js";
import { collectErrorMetadata } from "../errors/dev/utils.js";
import { isAstroConfigZodError } from "../errors/errors.js";
import { createSafeError } from "../errors/index.js";
import { formatErrorMessage } from "../messages.js";
import { createContainer, startContainer } from "./container.js";
async function createRestartedContainer(container, settings) {
  const { logger, fs, inlineConfig } = container;
  const newContainer = await createContainer({
    isRestart: true,
    logger,
    settings,
    inlineConfig,
    fs
  });
  await startContainer(newContainer);
  return newContainer;
}
function shouldRestartContainer({ settings, inlineConfig, restartInFlight }, changedFile) {
  if (restartInFlight)
    return false;
  let shouldRestart = false;
  if (inlineConfig.configFile) {
    shouldRestart = vite.normalizePath(inlineConfig.configFile) === vite.normalizePath(changedFile);
  } else {
    const exp = new RegExp(`.*astro.config.((mjs)|(cjs)|(js)|(ts))$`);
    const normalizedChangedFile = vite.normalizePath(changedFile);
    shouldRestart = exp.test(normalizedChangedFile);
  }
  if (!shouldRestart && settings.watchFiles.length > 0) {
    shouldRestart = settings.watchFiles.some(
      (path) => vite.normalizePath(path) === vite.normalizePath(changedFile)
    );
  }
  return shouldRestart;
}
async function restartContainer(container) {
  const { logger, close, settings: existingSettings } = container;
  container.restartInFlight = true;
  try {
    const { astroConfig } = await resolveConfig(container.inlineConfig, "dev", container.fs);
    const settings = createSettings(astroConfig, fileURLToPath(existingSettings.config.root));
    await close();
    return await createRestartedContainer(container, settings);
  } catch (_err) {
    const error = createSafeError(_err);
    if (!isAstroConfigZodError(_err)) {
      logger.error("config", formatErrorMessage(collectErrorMetadata(error)) + "\n");
    }
    container.viteServer.ws.send({
      type: "error",
      err: {
        message: error.message,
        stack: error.stack || ""
      }
    });
    container.restartInFlight = false;
    logger.error("astro", "Continuing with previous valid configuration\n");
    return error;
  }
}
async function createContainerWithAutomaticRestart({
  inlineConfig,
  fs
}) {
  const logger = createNodeLogger(inlineConfig ?? {});
  const { userConfig, astroConfig } = await resolveConfig(inlineConfig ?? {}, "dev", fs);
  telemetry.record(eventCliSession("dev", userConfig));
  const settings = createSettings(astroConfig, fileURLToPath(astroConfig.root));
  const initialContainer = await createContainer({ settings, logger, inlineConfig, fs });
  let resolveRestart;
  let restartComplete = new Promise((resolve) => {
    resolveRestart = resolve;
  });
  let restart = {
    container: initialContainer,
    restarted() {
      return restartComplete;
    }
  };
  async function handleServerRestart(logMsg) {
    logger.info("astro", logMsg + "\n");
    const container = restart.container;
    const result = await restartContainer(container);
    if (result instanceof Error) {
      resolveRestart(result);
    } else {
      restart.container = result;
      addWatches();
      resolveRestart(null);
    }
    restartComplete = new Promise((resolve) => {
      resolveRestart = resolve;
    });
  }
  function handleChangeRestart(logMsg) {
    return async function(changedFile) {
      if (shouldRestartContainer(restart.container, changedFile)) {
        handleServerRestart(logMsg);
      }
    };
  }
  function addWatches() {
    const watcher = restart.container.viteServer.watcher;
    watcher.on("change", handleChangeRestart("Configuration updated. Restarting..."));
    watcher.on("unlink", handleChangeRestart("Configuration removed. Restarting..."));
    watcher.on("add", handleChangeRestart("Configuration added. Restarting..."));
    restart.container.viteServer.restart = () => handleServerRestart("Restarting...");
  }
  addWatches();
  return restart;
}
export {
  createContainerWithAutomaticRestart,
  restartContainer,
  shouldRestartContainer
};
