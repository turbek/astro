import { type Plugin } from 'vite';
/**
 * Loads '*.wasm?module' imports as WebAssembly modules, which is the only way to load WASM in cloudflare workers.
 * Current proposal for WASM modules: https://github.com/WebAssembly/esm-integration/tree/main/proposals/esm-integration
 * Cloudflare worker WASM from javascript support: https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/
 * @param disabled - if true throws a helpful error message if wasm is encountered and wasm imports are not enabled,
 * 								otherwise it will error obscurely in the esbuild and vite builds
 * @param assetsDirectory - the folder name for the assets directory in the build directory. Usually '_astro'
 * @returns Vite plugin to load WASM tagged with '?module' as a WASM modules
 */
export declare function wasmModuleLoader({ disabled, assetsDirectory, }: {
    disabled: boolean;
    assetsDirectory: string;
}): Plugin;
