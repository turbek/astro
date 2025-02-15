import type { OutgoingHttpHeaders } from 'node:http';
/**
 * Takes in a nullable WebAPI Headers object and produces a NodeJS OutgoingHttpHeaders object suitable for usage
 * with ServerResponse.writeHead(..) or ServerResponse.setHeader(..)
 *
 * @param webHeaders WebAPI Headers object
 * @returns NodeJS OutgoingHttpHeaders object with multiple set-cookie handled as an array of values
 */
export declare const createOutgoingHttpHeaders: (webHeaders: Headers | undefined | null) => OutgoingHttpHeaders | undefined;
