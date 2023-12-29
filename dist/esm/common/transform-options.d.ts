import { TS } from "./type.js";
import { DiOptions } from "./di-options.js";
interface TransformResult {
    code: string;
    map?: string;
}
type TransformOptions = DiOptions & {
    printer?: TS.Printer;
    cache?: Map<string, TransformResult>;
};
export { TransformResult, TransformOptions };
