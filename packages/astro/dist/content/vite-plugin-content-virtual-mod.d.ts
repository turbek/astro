/// <reference types="node" resolution-mode="require"/>
import fsMod from 'node:fs';
import type { Plugin } from 'vite';
import type { AstroSettings, ContentEntryType } from '../@types/astro.js';
import { type ContentPaths } from './utils.js';
interface AstroContentVirtualModPluginParams {
    settings: AstroSettings;
}
export declare function astroContentVirtualModPlugin({ settings, }: AstroContentVirtualModPluginParams): Plugin;
/**
 * Generate a map from a collection + slug to the local file path.
 * This is used internally to resolve entry imports when using `getEntry()`.
 * @see `content-module.template.mjs`
 */
export declare function getStringifiedLookupMap({ contentPaths, contentEntryConfigByExt, dataEntryExts, root, fs, }: {
    contentEntryConfigByExt: Map<string, ContentEntryType>;
    dataEntryExts: string[];
    contentPaths: Pick<ContentPaths, 'contentDir' | 'config'>;
    root: URL;
    fs: typeof fsMod;
}): Promise<string>;
export {};
