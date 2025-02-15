import type { RuntimeMode } from '../@types/astro.js';
import type { ModuleLoader } from '../core/module-loader/index.js';
/** Given a filePath URL, crawl Vite’s module graph to find all style imports. */
export declare function getStylesForURL(filePath: URL, loader: ModuleLoader, mode: RuntimeMode): Promise<{
    urls: Set<string>;
    stylesMap: Map<string, string>;
}>;
