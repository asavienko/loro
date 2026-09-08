/* tslint:disable */
/* eslint-disable */

/**
 * The same JSON boundary invoked by native Expo modules.
 */
export function core_call(method: string, input: string): string;

/**
 * Merge one row, from the server side. Byte-identical to the client path.
 *
 * # Errors
 * Returns an error if either argument fails to deserialise.
 */
export function merge_row(local: any, remote: any): any;
