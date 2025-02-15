/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import https from 'https';
import http from 'node:http';
interface CreateServerOptions {
    client: URL;
    port: number;
    host: string | undefined;
    removeBase: (pathname: string) => string;
}
export declare function createServer({ client, port, host, removeBase }: CreateServerOptions, handler: http.RequestListener): {
    host: string | undefined;
    port: number;
    closed(): Promise<void>;
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | https.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    stop: () => Promise<void>;
};
export {};
