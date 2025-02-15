import type { AstroComponentMetadata } from 'astro';
import type { AstroPreactAttrs, RendererContext } from './types.js';
declare function check(this: RendererContext, Component: any, props: Record<string, any>, children: any): boolean;
declare function renderToStaticMarkup(this: RendererContext, Component: any, props: Record<string, any>, { default: children, ...slotted }: Record<string, any>, metadata: AstroComponentMetadata | undefined): {
    attrs: AstroPreactAttrs;
    html: string;
};
declare const _default: {
    check: typeof check;
    renderToStaticMarkup: typeof renderToStaticMarkup;
    supportsAstroStaticSlot: boolean;
};
export default _default;
