import type { SSRManifest } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare function createExports(manifest: SSRManifest): {
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
};
