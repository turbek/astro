import type { TransformResult } from '@astrojs/compiler';
import type { ResolvedConfig } from 'vite';
import type { AstroConfig } from '../../@types/astro.js';
export interface CompileProps {
    astroConfig: AstroConfig;
    viteConfig: ResolvedConfig;
    filename: string;
    source: string;
}
export interface CompileResult extends TransformResult {
    cssDeps: Set<string>;
    source: string;
}
export declare function compile({ astroConfig, viteConfig, filename, source, }: CompileProps): Promise<CompileResult>;
