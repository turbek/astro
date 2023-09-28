/**
 * This file is a derivative work of wrangler by Cloudflare
 * An upstream request for exposing this API was made here:
 * https://github.com/cloudflare/workers-sdk/issues/3897
 *
 * Until further notice, we will be using this file as a workaround
 * TODO: Tackle this file, once their is an decision on the upstream request
 */
import dotenv from 'dotenv';
export interface DotEnv {
    path: string;
    parsed: dotenv.DotenvParseOutput;
}
/**
 * Loads a dotenv file from <path>, preferring to read <path>.<environment> if
 * <environment> is defined and that file exists.
 */
export declare function loadDotEnv(path: string): DotEnv | undefined;
export declare function getEnvVars(): Promise<any>;
