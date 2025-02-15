import type { Params, SSRElement, SSRLoadedRenderer, SSRResult } from '../../@types/astro.js';
import { AstroCookies } from '../cookies/index.js';
import type { Logger } from '../logger/core.js';
export interface CreateResultArgs {
    /**
     * Used to provide better error messages for `Astro.clientAddress`
     */
    adapterName: string | undefined;
    /**
     * Value of Astro config's `output` option, true if "server" or "hybrid"
     */
    ssr: boolean;
    logger: Logger;
    params: Params;
    pathname: string;
    renderers: SSRLoadedRenderer[];
    clientDirectives: Map<string, string>;
    compressHTML: boolean;
    resolve: (s: string) => Promise<string>;
    /**
     * Used for `Astro.site`
     */
    site: string | undefined;
    links?: Set<SSRElement>;
    scripts?: Set<SSRElement>;
    styles?: Set<SSRElement>;
    componentMetadata?: SSRResult['componentMetadata'];
    request: Request;
    status: number;
    locals: App.Locals;
    cookies?: AstroCookies;
}
export declare function createResult(args: CreateResultArgs): SSRResult;
