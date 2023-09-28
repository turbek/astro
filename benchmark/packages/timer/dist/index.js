function getAdapter() {
  return {
    name: "@benchmark/timer",
    serverEntrypoint: "@benchmark/timer/server.js",
    previewEntrypoint: "@benchmark/timer/preview.js",
    exports: ["handler"]
  };
}
function createIntegration() {
  return {
    name: "@benchmark/timer",
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        updateConfig({
          vite: {
            ssr: {
              noExternal: ["@benchmark/timer"]
            }
          }
        });
      },
      "astro:config:done": ({ setAdapter, config }) => {
        setAdapter(getAdapter());
        if (config.output === "static") {
          console.warn(`[@benchmark/timer] \`output: "server"\` is required to use this adapter.`);
        }
      }
    }
  };
}
export {
  createIntegration as default,
  getAdapter
};
