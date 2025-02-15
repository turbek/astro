/// <reference types="node" resolution-mode="require"/>
import matter from 'gray-matter';
import fsMod from 'node:fs';
import type { PluginContext } from 'rollup';
import { type ViteDevServer } from 'vite';
import { z } from 'zod';
import type { AstroConfig, AstroSettings, ContentEntryType, DataEntryType } from '../@types/astro.js';
import { CONTENT_FLAGS } from './consts.js';
/**
 * Amap from a collection + slug to the local file path.
 * This is used internally to resolve entry imports when using `getEntry()`.
 * @see `content-module.template.mjs`
 */
export type ContentLookupMap = {
    [collectionName: string]: {
        type: 'content' | 'data';
        entries: {
            [lookupId: string]: string;
        };
    };
};
export declare const collectionConfigParser: z.ZodUnion<[z.ZodObject<{
    type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"content">>>;
    schema: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    schema?: any;
    type: "content";
}, {
    type?: "content" | undefined;
    schema?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"data">;
    schema: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    schema?: any;
    type: "data";
}, {
    schema?: any;
    type: "data";
}>]>;
export declare function getDotAstroTypeReference({ root, srcDir }: {
    root: URL;
    srcDir: URL;
}): string;
export declare const contentConfigParser: z.ZodObject<{
    collections: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodObject<{
        type: z.ZodDefault<z.ZodOptional<z.ZodLiteral<"content">>>;
        schema: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        schema?: any;
        type: "content";
    }, {
        type?: "content" | undefined;
        schema?: any;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"data">;
        schema: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        schema?: any;
        type: "data";
    }, {
        schema?: any;
        type: "data";
    }>]>>;
}, "strip", z.ZodTypeAny, {
    collections: Record<string, {
        schema?: any;
        type: "content";
    } | {
        schema?: any;
        type: "data";
    }>;
}, {
    collections: Record<string, {
        type?: "content" | undefined;
        schema?: any;
    } | {
        schema?: any;
        type: "data";
    }>;
}>;
export type CollectionConfig = z.infer<typeof collectionConfigParser>;
export type ContentConfig = z.infer<typeof contentConfigParser>;
type EntryInternal = {
    rawData: string | undefined;
    filePath: string;
};
export declare const msg: {
    collectionConfigMissing: (collection: string) => string;
};
export declare function parseEntrySlug({ id, collection, generatedSlug, frontmatterSlug, }: {
    id: string;
    collection: string;
    generatedSlug: string;
    frontmatterSlug?: unknown;
}): string;
export declare function getEntryData(entry: {
    id: string;
    collection: string;
    unvalidatedData: Record<string, unknown>;
    _internal: EntryInternal;
}, collectionConfig: CollectionConfig, pluginContext: PluginContext): Promise<any>;
export declare function getContentEntryExts(settings: Pick<AstroSettings, 'contentEntryTypes'>): string[];
export declare function getDataEntryExts(settings: Pick<AstroSettings, 'dataEntryTypes'>): string[];
export declare function getEntryConfigByExtMap<TEntryType extends ContentEntryType | DataEntryType>(entryTypes: TEntryType[]): Map<string, TEntryType>;
export declare function getEntryCollectionName({ contentDir, entry, }: Pick<ContentPaths, 'contentDir'> & {
    entry: string | URL;
}): string | undefined;
export declare function getDataEntryId({ entry, contentDir, collection, }: Pick<ContentPaths, 'contentDir'> & {
    entry: URL;
    collection: string;
}): string;
export declare function getContentEntryIdAndSlug({ entry, contentDir, collection, }: Pick<ContentPaths, 'contentDir'> & {
    entry: URL;
    collection: string;
}): {
    id: string;
    slug: string;
};
export declare function getEntryType(entryPath: string, paths: Pick<ContentPaths, 'config' | 'contentDir'>, contentFileExts: string[], dataFileExts: string[]): 'content' | 'data' | 'config' | 'ignored' | 'unsupported';
export declare function hasUnderscoreBelowContentDirectoryPath(fileUrl: URL, contentDir: ContentPaths['contentDir']): boolean;
export declare function parseFrontmatter(fileContents: string): matter.GrayMatterFile<string>;
/**
 * The content config is loaded separately from other `src/` files.
 * This global observable lets dependent plugins (like the content flag plugin)
 * subscribe to changes during dev server updates.
 */
export declare const globalContentConfigObserver: ContentObservable;
export declare function hasContentFlag(viteId: string, flag: (typeof CONTENT_FLAGS)[number]): boolean;
export declare function loadContentConfig({ fs, settings, viteServer, }: {
    fs: typeof fsMod;
    settings: AstroSettings;
    viteServer: ViteDevServer;
}): Promise<ContentConfig | undefined>;
export declare function reloadContentConfigObserver({ observer, ...loadContentConfigOpts }: {
    fs: typeof fsMod;
    settings: AstroSettings;
    viteServer: ViteDevServer;
    observer?: ContentObservable;
}): Promise<void>;
type ContentCtx = {
    status: 'init';
} | {
    status: 'loading';
} | {
    status: 'does-not-exist';
} | {
    status: 'loaded';
    config: ContentConfig;
} | {
    status: 'error';
    error: Error;
};
type Observable<C> = {
    get: () => C;
    set: (ctx: C) => void;
    subscribe: (fn: (ctx: C) => void) => () => void;
};
export type ContentObservable = Observable<ContentCtx>;
export declare function contentObservable(initialCtx: ContentCtx): ContentObservable;
export type ContentPaths = {
    contentDir: URL;
    assetsDir: URL;
    cacheDir: URL;
    typesTemplate: URL;
    virtualModTemplate: URL;
    config: {
        exists: boolean;
        url: URL;
    };
};
export declare function getContentPaths({ srcDir, root }: Pick<AstroConfig, 'root' | 'srcDir'>, fs?: typeof fsMod): ContentPaths;
/**
 * Check for slug in content entry frontmatter and validate the type,
 * falling back to the `generatedSlug` if none is found.
 */
export declare function getEntrySlug({ id, collection, generatedSlug, contentEntryType, fileUrl, fs, }: {
    fs: typeof fsMod;
    id: string;
    collection: string;
    generatedSlug: string;
    fileUrl: URL;
    contentEntryType: Pick<ContentEntryType, 'getEntryInfo'>;
}): Promise<string>;
export declare function getExtGlob(exts: string[]): string;
export {};
