import type { RendererContext } from './types.js';
declare function check(this: RendererContext, Component: any, props: Record<string, any>, children: any): boolean;
declare function renderToStaticMarkup(this: RendererContext, Component: any, props: Record<string, any>, { default: children, ...slotted }: any, metadata?: undefined | Record<string, any>): {
    attrs: {
        'data-solid-render-id': string;
    };
    html: string;
};
declare const _default: {
    check: typeof check;
    renderToStaticMarkup: typeof renderToStaticMarkup;
    supportsAstroStaticSlot: boolean;
};
export default _default;
