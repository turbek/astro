import type { Context } from './context.js';
export declare function typescript(ctx: Pick<Context, 'typescript' | 'yes' | 'prompt' | 'dryRun' | 'cwd' | 'exit'>): Promise<void>;
export declare function setupTypeScript(value: string, { cwd }: {
    cwd: string;
}): Promise<void>;
