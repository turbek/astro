import type { ComponentInstance, Params, Props, RouteData, SSRElement, SSRResult } from '../../@types/astro.js';
import type { Environment } from './environment.js';
/**
 * The RenderContext represents the parts of rendering that are specific to one request.
 */
export interface RenderContext {
    request: Request;
    pathname: string;
    scripts?: Set<SSRElement>;
    links?: Set<SSRElement>;
    styles?: Set<SSRElement>;
    componentMetadata?: SSRResult['componentMetadata'];
    route: RouteData;
    status?: number;
    params: Params;
    props: Props;
    locals?: object;
}
export type CreateRenderContextArgs = Partial<Omit<RenderContext, 'params' | 'props' | 'locals'>> & {
    route: RouteData;
    request: RenderContext['request'];
    mod: ComponentInstance;
    env: Environment;
};
export declare function createRenderContext(options: CreateRenderContextArgs): Promise<RenderContext>;
