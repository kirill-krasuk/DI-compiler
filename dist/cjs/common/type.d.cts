import * as TS from "typescript";
interface TSTextWriter {
    rawWrite(text: string): void;
    isAtStartOfLine(): boolean;
    getText(): string;
    writeComment(comment: string): void;
}
interface TSSourceMapGenerator {
}
interface TSSourceMapGeneratorOptions {
    sourceMap: boolean;
    sourceRoot: string;
    mapRoot: string;
    extendedDiagnostics: boolean;
}
interface TSEmitHost {
    getCanonicalFileName(input: string): string;
    getCompilerOptions(): TS.CompilerOptions;
    getCurrentDirectory(): string;
}
type TSExtended = typeof TS & {
    nullTransformationContext: TS.TransformationContext;
    createGetCanonicalFileName(useCaseSensitiveFileNames: boolean): (input: string) => string;
    createSourceMapGenerator(emitHost: TSEmitHost, file: string, sourceRoot: string, sourcesDirectoryPath: string, mapOptions: TSSourceMapGeneratorOptions): TSSourceMapGenerator;
    createTextWriter(newLine: string): TSTextWriter;
};
type TSExtendedPrinter = TS.Printer & {
    writeFile(file: TS.SourceFile, writer: TSTextWriter, sourceMapGenerator: TSSourceMapGenerator): void;
};
export { TS, TSTextWriter, TSSourceMapGenerator, TSSourceMapGeneratorOptions, TSEmitHost, TSExtended, TSExtendedPrinter };
