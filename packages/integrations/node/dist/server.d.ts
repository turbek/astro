/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import type { SSRManifest } from 'astro';
import type { Options } from './types.js';
export declare function createExports(manifest: SSRManifest, options: Options): {
    handler: (...args: import("./types.js").RequestHandlerParams | [unknown, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, (((err?: unknown) => void) | undefined)?, (object | undefined)?]) => Promise<void>;
    startServer: () => {
        server: {
            host: string | undefined;
            port: number;
            closed(): Promise<void>;
            server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse> | import("https").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
            stop: () => Promise<void>;
        };
        done: Promise<void>;
    };
};
export declare function start(manifest: SSRManifest, options: Options): void;
