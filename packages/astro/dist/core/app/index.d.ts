import type { ManifestData, RouteData, SSRManifest } from '../../@types/astro.js';
import { AstroIntegrationLogger } from '../logger/core.js';
export { deserializeManifest } from './common.js';
export interface MatchOptions {
    matchNotFound?: boolean | undefined;
}
export interface RenderErrorOptions {
    routeData?: RouteData;
    response?: Response;
    status: 404 | 500;
}
export declare class App {
    #private;
    constructor(manifest: SSRManifest, streaming?: boolean);
    getAdapterLogger(): AstroIntegrationLogger;
    set setManifestData(newManifestData: ManifestData);
    removeBase(pathname: string): string;
    match(request: Request, _opts?: MatchOptions): RouteData | undefined;
    render(request: Request, routeData?: RouteData, locals?: object): Promise<Response>;
    setCookieHeaders(response: Response): Generator<string, string[], unknown>;
}
