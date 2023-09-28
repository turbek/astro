import { NodeApp, applyPolyfills } from "astro/app/node";
applyPolyfills();
function createExports(manifest) {
  const app = new NodeApp(manifest);
  return {
    handler: async (req, res) => {
      const start = performance.now();
      await app.render(req);
      const end = performance.now();
      res.write(end - start + "");
      res.end();
    }
  };
}
export {
  createExports
};
