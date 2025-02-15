import { bold } from "kleur/colors";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildClientDirectiveEntrypoint } from "../core/client-directive/index.js";
import { mergeConfig } from "../core/config/index.js";
import { AstroIntegrationLogger } from "../core/logger/core.js";
import { isServerLikeOutput } from "../prerender/utils.js";
import { validateSupportedFeatures } from "./astroFeaturesValidation.js";
async function withTakingALongTimeMsg({
  name,
  hookResult,
  timeoutMs = 3e3,
  logger
}) {
  const timeout = setTimeout(() => {
    logger.info("build", `Waiting for the ${bold(name)} integration...`);
  }, timeoutMs);
  const result = await hookResult;
  clearTimeout(timeout);
  return result;
}
const Loggers = /* @__PURE__ */ new WeakMap();
function getLogger(integration, logger) {
  if (Loggers.has(integration)) {
    return Loggers.get(integration);
  }
  const integrationLogger = logger.forkIntegrationLogger(integration.name);
  Loggers.set(integration, integrationLogger);
  return integrationLogger;
}
async function runHookConfigSetup({
  settings,
  command,
  logger,
  isRestart = false
}) {
  if (settings.config.adapter) {
    settings.config.integrations.push(settings.config.adapter);
  }
  let updatedConfig = { ...settings.config };
  let updatedSettings = { ...settings, config: updatedConfig };
  let addedClientDirectives = /* @__PURE__ */ new Map();
  let astroJSXRenderer = null;
  for (let i = 0; i < updatedConfig.integrations.length; i++) {
    const integration = updatedConfig.integrations[i];
    if (integration.hooks?.["astro:config:setup"]) {
      let addPageExtension2 = function(...input) {
        const exts = input.flat(Infinity).map((ext) => `.${ext.replace(/^\./, "")}`);
        updatedSettings.pageExtensions.push(...exts);
      }, addContentEntryType2 = function(contentEntryType) {
        updatedSettings.contentEntryTypes.push(contentEntryType);
      }, addDataEntryType2 = function(dataEntryType) {
        updatedSettings.dataEntryTypes.push(dataEntryType);
      };
      var addPageExtension = addPageExtension2, addContentEntryType = addContentEntryType2, addDataEntryType = addDataEntryType2;
      const integrationLogger = getLogger(integration, logger);
      const hooks = {
        config: updatedConfig,
        command,
        isRestart,
        addRenderer(renderer) {
          if (!renderer.name) {
            throw new Error(`Integration ${bold(integration.name)} has an unnamed renderer.`);
          }
          if (!renderer.serverEntrypoint) {
            throw new Error(`Renderer ${bold(renderer.name)} does not provide a serverEntrypoint.`);
          }
          if (renderer.name === "astro:jsx") {
            astroJSXRenderer = renderer;
          } else {
            updatedSettings.renderers.push(renderer);
          }
        },
        injectScript: (stage, content) => {
          updatedSettings.scripts.push({ stage, content });
        },
        updateConfig: (newConfig) => {
          updatedConfig = mergeConfig(updatedConfig, newConfig);
        },
        injectRoute: (injectRoute) => {
          updatedSettings.injectedRoutes.push(injectRoute);
        },
        addWatchFile: (path) => {
          updatedSettings.watchFiles.push(path instanceof URL ? fileURLToPath(path) : path);
        },
        addClientDirective: ({ name, entrypoint }) => {
          if (updatedSettings.clientDirectives.has(name) || addedClientDirectives.has(name)) {
            throw new Error(
              `The "${integration.name}" integration is trying to add the "${name}" client directive, but it already exists.`
            );
          }
          addedClientDirectives.set(name, buildClientDirectiveEntrypoint(name, entrypoint));
        },
        logger: integrationLogger
      };
      Object.defineProperty(hooks, "addPageExtension", {
        value: addPageExtension2,
        writable: false,
        enumerable: false
      });
      Object.defineProperty(hooks, "addContentEntryType", {
        value: addContentEntryType2,
        writable: false,
        enumerable: false
      });
      Object.defineProperty(hooks, "addDataEntryType", {
        value: addDataEntryType2,
        writable: false,
        enumerable: false
      });
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:config:setup"](hooks),
        logger
      });
      for (const [name, compiled] of addedClientDirectives) {
        updatedSettings.clientDirectives.set(name, await compiled);
      }
    }
  }
  if (astroJSXRenderer) {
    updatedSettings.renderers.push(astroJSXRenderer);
  }
  updatedSettings.config = updatedConfig;
  return updatedSettings;
}
async function runHookConfigDone({
  settings,
  logger
}) {
  for (const integration of settings.config.integrations) {
    if (integration?.hooks?.["astro:config:done"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:config:done"]({
          config: settings.config,
          setAdapter(adapter) {
            if (settings.adapter && settings.adapter.name !== adapter.name) {
              throw new Error(
                `Integration "${integration.name}" conflicts with "${settings.adapter.name}". You can only configure one deployment integration.`
              );
            }
            if (!adapter.supportedAstroFeatures) {
              logger.warn(
                "astro",
                `The adapter ${adapter.name} doesn't provide a feature map. From Astro 3.0, an adapter can provide a feature map. Not providing a feature map will cause an error in Astro 4.0.`
              );
            } else {
              const validationResult = validateSupportedFeatures(
                adapter.name,
                adapter.supportedAstroFeatures,
                settings.config,
                logger
              );
              for (const [featureName, supported] of Object.entries(validationResult)) {
                if (!supported && featureName !== "assets") {
                  logger.error(
                    "astro",
                    `The adapter ${adapter.name} doesn't support the feature ${featureName}. Your project won't be built. You should not use it.`
                  );
                }
              }
              if (!validationResult.assets) {
                logger.warn(
                  "astro",
                  `The selected adapter ${adapter.name} does not support image optimization. To allow your project to build with the original, unoptimized images, the image service has been automatically switched to the 'noop' option. See https://docs.astro.build/en/reference/configuration-reference/#imageservice`
                );
                settings.config.image.service = {
                  entrypoint: "astro/assets/services/noop",
                  config: {}
                };
              }
            }
            settings.adapter = adapter;
          },
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookServerSetup({
  config,
  server,
  logger
}) {
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:server:setup"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:server:setup"]({
          server,
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookServerStart({
  config,
  address,
  logger
}) {
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:server:start"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:server:start"]({
          address,
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookServerDone({
  config,
  logger
}) {
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:server:done"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:server:done"]({
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookBuildStart({
  config,
  logging
}) {
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:build:start"]) {
      const logger = getLogger(integration, logging);
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:build:start"]({ logger }),
        logger: logging
      });
    }
  }
}
async function runHookBuildSetup({
  config,
  vite,
  pages,
  target,
  logger
}) {
  let updatedConfig = vite;
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:build:setup"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:build:setup"]({
          vite,
          pages,
          target,
          updateConfig: (newConfig) => {
            updatedConfig = mergeConfig(updatedConfig, newConfig);
          },
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
  return updatedConfig;
}
async function runHookBuildSsr({
  config,
  manifest,
  logger,
  entryPoints,
  middlewareEntryPoint
}) {
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:build:ssr"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:build:ssr"]({
          manifest,
          entryPoints,
          middlewareEntryPoint,
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookBuildGenerated({
  config,
  logger
}) {
  const dir = isServerLikeOutput(config) ? config.build.client : config.outDir;
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:build:generated"]) {
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:build:generated"]({
          dir,
          logger: getLogger(integration, logger)
        }),
        logger
      });
    }
  }
}
async function runHookBuildDone({ config, pages, routes, logging }) {
  const dir = isServerLikeOutput(config) ? config.build.client : config.outDir;
  await fs.promises.mkdir(dir, { recursive: true });
  for (const integration of config.integrations) {
    if (integration?.hooks?.["astro:build:done"]) {
      const logger = getLogger(integration, logging);
      await withTakingALongTimeMsg({
        name: integration.name,
        hookResult: integration.hooks["astro:build:done"]({
          pages: pages.map((p) => ({ pathname: p })),
          dir,
          routes,
          logger
        }),
        logger: logging
      });
    }
  }
}
function isFunctionPerRouteEnabled(adapter) {
  if (adapter?.adapterFeatures?.functionPerRoute === true) {
    return true;
  } else {
    return false;
  }
}
function isEdgeMiddlewareEnabled(adapter) {
  if (adapter?.adapterFeatures?.edgeMiddleware === true) {
    return true;
  } else {
    return false;
  }
}
export {
  isEdgeMiddlewareEnabled,
  isFunctionPerRouteEnabled,
  runHookBuildDone,
  runHookBuildGenerated,
  runHookBuildSetup,
  runHookBuildSsr,
  runHookBuildStart,
  runHookConfigDone,
  runHookConfigSetup,
  runHookServerDone,
  runHookServerSetup,
  runHookServerStart
};
