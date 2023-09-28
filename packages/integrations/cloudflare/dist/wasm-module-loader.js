import * as fs from "node:fs";
import * as path from "node:path";
import {} from "vite";
function wasmModuleLoader({
  disabled,
  assetsDirectory
}) {
  const postfix = ".wasm?module";
  let isDev = false;
  return {
    name: "vite:wasm-module-loader",
    enforce: "pre",
    configResolved(config) {
      isDev = config.command === "serve";
    },
    config(_, __) {
      return {
        assetsInclude: ["**/*.wasm?module"],
        build: { rollupOptions: { external: /^__WASM_ASSET__.+\.wasm\.mjs$/i } }
      };
    },
    load(id, _) {
      if (!id.endsWith(postfix)) {
        return;
      }
      if (disabled) {
        throw new Error(
          `WASM module's cannot be loaded unless you add \`wasmModuleImports: true\` to your astro config.`
        );
      }
      const filePath = id.slice(0, -1 * "?module".length);
      const data = fs.readFileSync(filePath);
      const base64 = data.toString("base64");
      const base64Module = `
const wasmModule = new WebAssembly.Module(Uint8Array.from(atob("${base64}"), c => c.charCodeAt(0)));
export default wasmModule
`;
      if (isDev) {
        return base64Module;
      } else {
        let hash = hashString(base64);
        const assetName = path.basename(filePath).split(".")[0] + "." + hash + ".wasm";
        this.emitFile({
          type: "asset",
          // put it explicitly in the _astro assets directory with `fileName` rather than `name` so that
          // vite doesn't give it a random id in its name. We need to be able to easily rewrite from
          // the .mjs loader and the actual wasm asset later in the ESbuild for the worker
          fileName: path.join(assetsDirectory, assetName),
          source: fs.readFileSync(filePath)
        });
        const chunkId = this.emitFile({
          type: "prebuilt-chunk",
          fileName: assetName + ".mjs",
          code: base64Module
        });
        return `
import wasmModule from "__WASM_ASSET__${chunkId}.wasm.mjs";
export default wasmModule;
	`;
      }
    },
    // output original wasm file relative to the chunk
    renderChunk(code, chunk, _) {
      if (isDev)
        return;
      if (!/__WASM_ASSET__/g.test(code))
        return;
      const final = code.replaceAll(/__WASM_ASSET__([a-z\d]+).wasm.mjs/g, (s, assetId) => {
        const fileName = this.getFileName(assetId);
        const relativePath = path.relative(path.dirname(chunk.fileName), fileName).replaceAll("\\", "/");
        return `./${relativePath}`;
      });
      return { code: final };
    }
  };
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return new Uint32Array([hash])[0].toString(36);
}
export {
  wasmModuleLoader
};
