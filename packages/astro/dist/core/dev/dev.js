import fs from "node:fs";
import { performance } from "perf_hooks";
import { attachContentServerListeners } from "../../content/index.js";
import { telemetry } from "../../events/index.js";
import * as msg from "../messages.js";
import { startContainer } from "./container.js";
import { createContainerWithAutomaticRestart } from "./restart.js";
async function dev(inlineConfig) {
  const devStart = performance.now();
  await telemetry.record([]);
  const restart = await createContainerWithAutomaticRestart({ inlineConfig, fs });
  const logger = restart.container.logger;
  const devServerAddressInfo = await startContainer(restart.container);
  logger.info(
    null,
    msg.serverStart({
      startupTime: performance.now() - devStart,
      resolvedUrls: restart.container.viteServer.resolvedUrls || { local: [], network: [] },
      host: restart.container.settings.config.server.host,
      base: restart.container.settings.config.base
    })
  );
  const currentVersion = "3.1.4";
  if (currentVersion.includes("-")) {
    logger.warn(null, msg.prerelease({ currentVersion }));
  }
  if (restart.container.viteServer.config.server?.fs?.strict === false) {
    logger.warn(null, msg.fsStrictWarning());
  }
  await attachContentServerListeners(restart.container);
  return {
    address: devServerAddressInfo,
    get watcher() {
      return restart.container.viteServer.watcher;
    },
    handle(req, res) {
      return restart.container.handle(req, res);
    },
    async stop() {
      await restart.container.close();
    }
  };
}
export {
  dev as default
};
