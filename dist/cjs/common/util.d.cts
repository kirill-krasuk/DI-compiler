import { Nullable } from "helpertypes";
/**
 * Ensures that the given item is an array
 */
declare function ensureArray<T>(item: T[] | T): T[];
/**
 * Converts the given string to a boolean
 */
declare function booleanize(str: string | boolean | undefined): boolean;
declare function isTrueLike(str: Nullable<string | boolean>): boolean;
declare function isFalseLike(str: Nullable<string | boolean>): boolean;
declare const sha1: (data: string) => string;
declare const NOOP: () => void;
export { ensureArray, booleanize, isTrueLike, isFalseLike, sha1, NOOP };
