import type { HmrContext, ModuleNode } from 'vite';
import type { AstroConfig } from '../@types/astro.js';
import { cachedCompilation } from '../core/compile/index.js';
import type { Logger } from '../core/logger/core.js';
export interface HandleHotUpdateOptions {
    config: AstroConfig;
    logger: Logger;
    compile: () => ReturnType<typeof cachedCompilation>;
    source: string;
}
export declare function handleHotUpdate(ctx: HmrContext, { config, logger, compile, source }: HandleHotUpdateOptions): Promise<ModuleNode[] | undefined>;
