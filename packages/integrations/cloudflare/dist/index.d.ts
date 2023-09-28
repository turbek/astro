import type { AstroAdapter, AstroIntegration } from 'astro';
export type { AdvancedRuntime } from './server.advanced.js';
export type { DirectoryRuntime } from './server.directory.js';
type Options = {
    mode?: 'directory' | 'advanced';
    functionPerRoute?: boolean;
    /** Configure automatic `routes.json` generation */
    routes?: {
        /** Strategy for generating `include` and `exclude` patterns
         * - `auto`: Will use the strategy that generates the least amount of entries.
         * - `include`: For each page or endpoint in your application that is not prerendered, an entry in the `include` array will be generated. For each page that is prerendered and whoose path is matched by an `include` entry, an entry in the `exclude` array will be generated.
         * - `exclude`: One `"/*"` entry in the `include` array will be generated. For each page that is prerendered, an entry in the `exclude` array will be generated.
         * */
        strategy?: 'auto' | 'include' | 'exclude';
        /** Additional `include` patterns */
        include?: string[];
        /** Additional `exclude` patterns */
        exclude?: string[];
    };
    /**
     * 'off': current behaviour (wrangler is needed)
     * 'local': use a static req.cf object, and env vars defined in wrangler.toml & .dev.vars (astro dev is enough)
     * 'remote': use a dynamic real-live req.cf object, and env vars defined in wrangler.toml & .dev.vars (astro dev is enough)
     */
    runtime?: 'off' | 'local' | 'remote';
    wasmModuleImports?: boolean;
};
export declare function getAdapter({ isModeDirectory, functionPerRoute, }: {
    isModeDirectory: boolean;
    functionPerRoute: boolean;
}): AstroAdapter;
export default function createIntegration(args?: Options): AstroIntegration;
