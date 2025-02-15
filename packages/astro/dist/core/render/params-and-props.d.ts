import type { ComponentInstance, Params, Props, RouteData } from '../../@types/astro.js';
import type { Logger } from '../logger/core.js';
import { RouteCache } from './route-cache.js';
interface GetParamsAndPropsOptions {
    mod: ComponentInstance;
    route?: RouteData | undefined;
    routeCache: RouteCache;
    pathname: string;
    logger: Logger;
    ssr: boolean;
}
export declare function getParamsAndProps(opts: GetParamsAndPropsOptions): Promise<[Params, Props]>;
export {};
