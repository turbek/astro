import { preact } from "@preact/preset-vite";
import { fileURLToPath } from "node:url";
const babelCwd = new URL("../", import.meta.url);
function getRenderer(development) {
  return {
    name: "@astrojs/preact",
    clientEntrypoint: development ? "@astrojs/preact/client-dev.js" : "@astrojs/preact/client.js",
    serverEntrypoint: "@astrojs/preact/server.js"
  };
}
function src_default({ include, exclude, compat } = {}) {
  return {
    name: "@astrojs/preact",
    hooks: {
      "astro:config:setup": ({ addRenderer, updateConfig, command }) => {
        const preactPlugin = preact({
          include,
          exclude,
          babel: {
            cwd: fileURLToPath(babelCwd)
          }
        });
        const viteConfig = {
          optimizeDeps: {
            include: ["@astrojs/preact/client.js", "preact", "preact/jsx-runtime"],
            exclude: ["@astrojs/preact/server.js"]
          }
        };
        if (!compat) {
          const pIndex = preactPlugin.findIndex((p) => p.name == "preact:config");
          if (pIndex >= 0) {
            preactPlugin.splice(pIndex, 1);
          }
        } else {
          viteConfig.optimizeDeps.include.push(
            "preact/compat",
            "preact/test-utils",
            "preact/compat/jsx-runtime"
          );
          viteConfig.resolve = {
            alias: [{ find: "react/jsx-runtime", replacement: "preact/jsx-runtime" }],
            dedupe: ["preact/compat", "preact"]
          };
          viteConfig.ssr = {
            noExternal: ["react", "react-dom", "react-dom/test-utils", "react/jsx-runtime"]
          };
        }
        viteConfig.plugins = [preactPlugin];
        addRenderer(getRenderer(command === "dev"));
        updateConfig({
          vite: viteConfig
        });
      }
    }
  };
}
export {
  src_default as default
};
