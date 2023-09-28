import type { Request as CFRequest, EventContext } from '@cloudflare/workers-types';
import type { SSRManifest } from 'astro';
export interface DirectoryRuntime<T extends object = object> {
    runtime: {
        waitUntil: (promise: Promise<any>) => void;
        env: EventContext<unknown, string, unknown>['env'] & T;
        cf: CFRequest['cf'];
        caches: typeof caches;
    };
}
export declare function createExports(manifest: SSRManifest): {
    onRequest: (context: EventContext<unknown, string, unknown>) => Promise<import("@cloudflare/workers-types").Response | Response>;
    manifest: SSRManifest;
};
