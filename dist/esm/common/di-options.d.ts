import { MaybeArray } from "helpertypes";
import { TS } from "./type.js";
interface DiOptionsBase {
    typescript?: typeof TS;
}
interface DiProgramOptions extends DiOptionsBase {
    program: TS.Program;
}
interface DiIsolatedModulesOptions extends DiOptionsBase {
    /**
     * The identifier(s) that should be considered instances of DIContainer. When not given, an attempt will be
     * made to evaluate and resolve the value of identifiers to check if they are instances of DIContainer.
     * Providing one or more identifiers up front can be considered an optimization, as this step can be skipped that way
     */
    identifier?: MaybeArray<string>;
    compilerOptions?: TS.CompilerOptions;
}
type DiOptions = DiProgramOptions | DiIsolatedModulesOptions;
export { DiProgramOptions, DiIsolatedModulesOptions, DiOptions };
