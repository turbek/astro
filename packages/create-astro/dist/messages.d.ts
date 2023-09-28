/** @internal Used to mock `process.stdout.write` for testing purposes */
export declare function setStdout(writable: typeof process.stdout): void;
export declare function say(messages: string | string[], { clear, hat }?: {
    clear?: boolean | undefined;
    hat?: string | undefined;
}): Promise<void>;
export declare function spinner(args: {
    start: string;
    end: string;
    while: (...args: any) => Promise<any>;
}): Promise<void>;
export declare const title: (text: string) => string;
export declare const welcome: string[];
export declare const getName: () => Promise<string>;
export declare const getVersion: (packageManager: string) => Promise<string>;
export declare const log: (message: string) => boolean;
export declare const banner: () => void;
export declare const bannerAbort: () => boolean;
export declare const info: (prefix: string, text: string) => Promise<void>;
export declare const error: (prefix: string, text: string) => Promise<void>;
export declare const typescriptByDefault: () => Promise<void>;
export declare const nextSteps: ({ projectDir, devCmd }: {
    projectDir: string;
    devCmd: string;
}) => Promise<void>;
export declare function printHelp({ commandName, headline, usage, tables, description, }: {
    commandName: string;
    headline?: string;
    usage?: string;
    tables?: Record<string, [command: string, help: string][]>;
    description?: string;
}): void;
