import { AstroError } from "astro/errors";
function getAdapter(options) {
  return {
    name: "@astrojs/node",
    serverEntrypoint: "@astrojs/node/server.js",
    previewEntrypoint: "@astrojs/node/preview.js",
    exports: ["handler", "startServer"],
    args: options,
    supportedAstroFeatures: {
      hybridOutput: "stable",
      staticOutput: "stable",
      serverOutput: "stable",
      assets: {
        supportKind: "stable",
        isSharpCompatible: true,
        isSquooshCompatible: true
      }
    }
  };
}
function createIntegration(userOptions) {
  if (!userOptions?.mode) {
    throw new AstroError(`Setting the 'mode' option is required.`);
  }
  let _options;
  return {
    name: "@astrojs/node",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            ssr: {
              noExternal: ["@astrojs/node"]
            }
          }
        });
      },
      "astro:config:done": ({ setAdapter, config }) => {
        _options = {
          ...userOptions,
          client: config.build.client?.toString(),
          server: config.build.server?.toString(),
          host: config.server.host,
          port: config.server.port
        };
        setAdapter(getAdapter(_options));
        if (config.output === "static") {
          console.warn(
            `[@astrojs/node] \`output: "server"\` or  \`output: "hybrid"\` is required to use this adapter.`
          );
        }
      }
    }
  };
}
export {
  createIntegration as default,
  getAdapter
};
