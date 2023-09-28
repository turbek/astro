import { prompt } from '@astrojs/cli-kit';
export interface Context {
    help: boolean;
    prompt: typeof prompt;
    cwd: string;
    packageManager: string;
    username: Promise<string>;
    version: Promise<string>;
    skipHouston: boolean;
    fancy?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    projectName?: string;
    template?: string;
    ref: string;
    install?: boolean;
    git?: boolean;
    typescript?: string;
    stdin?: typeof process.stdin;
    stdout?: typeof process.stdout;
    exit(code: number): never;
    hat?: string;
}
export declare function getContext(argv: string[]): Promise<Context>;
