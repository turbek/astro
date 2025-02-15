import type { MiddlewareResponseHandler, Params } from '../../@types/astro.js';
import { sequence } from './sequence.js';
declare function defineMiddleware(fn: MiddlewareResponseHandler): MiddlewareResponseHandler;
/**
 * Payload for creating a context to be passed to Astro middleware
 */
export type CreateContext = {
    /**
     * The incoming request
     */
    request: Request;
    /**
     * Optional parameters
     */
    params?: Params;
};
/**
 * Creates a context to be passed to Astro middleware `onRequest` function.
 */
declare function createContext({ request, params }: CreateContext): import("../../@types/astro.js").APIContext<Record<string, any>, Record<string, string | undefined>>;
/**
 * It attempts to serialize `value` and return it as a string.
 *
 * ## Errors
 *  If the `value` is not serializable if the function will throw a runtime error.
 *
 * Something is **not serializable** when it contains properties/values like functions, `Map`, `Set`, `Date`,
 * and other types that can't be made a string.
 *
 * @param value
 */
declare function trySerializeLocals(value: unknown): string;
export { createContext, defineMiddleware, sequence, trySerializeLocals };
