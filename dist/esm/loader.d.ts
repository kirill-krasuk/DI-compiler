interface LoadContext {
    format: string;
    importAssertions: Record<string, string>;
}
interface LoadResult {
    format: string;
    shortCircuit?: boolean;
    source?: string | ArrayBuffer;
}
type NextLoad = (url: string, context: LoadContext) => Promise<LoadResult>;
type Load = (url: string, context: LoadContext, nextLoad: NextLoad) => Promise<LoadResult>;
declare const load: Load;
export { load };
