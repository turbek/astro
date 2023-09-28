import type { Request as CFRequest, ExecutionContext } from '@cloudflare/workers-types';
import type { SSRManifest } from 'astro';
type Env = {
    ASSETS: {
        fetch: (req: Request) => Promise<Response>;
    };
};
export interface AdvancedRuntime<T extends object = object> {
    runtime: {
        waitUntil: (promise: Promise<any>) => void;
        env: Env & T;
        cf: CFRequest['cf'];
        caches: typeof caches;
    };
}
export declare function createExports(manifest: SSRManifest): {
    default: {
        fetch: (request: Request & CFRequest, env: Env, context: ExecutionContext) => Promise<Response>;
    };
};
export {};
