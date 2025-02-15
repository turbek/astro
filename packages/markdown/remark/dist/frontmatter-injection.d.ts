import type { VFileData as Data, VFile } from 'vfile';
import type { MarkdownAstroData } from './types.js';
export declare class InvalidAstroDataError extends TypeError {
}
export declare function safelyGetAstroData(vfileData: Data): MarkdownAstroData | InvalidAstroDataError;
export declare function setVfileFrontmatter(vfile: VFile, frontmatter: Record<string, any>): void;
/**
 * @deprecated Use `setVfileFrontmatter` instead
 */
export declare function toRemarkInitializeAstroData({ userFrontmatter, }: {
    userFrontmatter: Record<string, any>;
}): () => (tree: any, vfile: VFile) => void;
