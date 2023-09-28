import type { TransformOptions } from '@astrojs/compiler';
import { type ResolvedConfig } from 'vite';
export declare function createStylePreprocessor({ filename, viteConfig, cssDeps, cssTransformErrors, }: {
    filename: string;
    viteConfig: ResolvedConfig;
    cssDeps: Set<string>;
    cssTransformErrors: Error[];
}): TransformOptions['preprocessStyle'];
