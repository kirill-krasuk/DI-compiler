import { TransformOptions, TransformResult } from "./transform-options.js";
import { TS } from "./type.js";
import { DiOptions, DiProgramOptions, DiIsolatedModulesOptions } from "./di-options.js";
import { EvaluateResult } from "ts-evaluator";
/**
 * CustomTransformer that associates constructor arguments with any given class declaration
 */
declare function transform(source: string, options?: TransformOptions): TransformResult;
declare function transform(source: string, filename: string, options?: TransformOptions): TransformResult;
/**
 * CustomTransformer that associates constructor arguments with any given class declaration
 */
declare function di(options: DiOptions): TS.CustomTransformers;
interface ImportedSymbolBase {
    moduleSpecifier: string;
}
interface NamedImportedSymbol extends ImportedSymbolBase {
    isDefaultImport: boolean;
    name: string;
    propertyName: string;
}
interface NamespaceImportedSymbol extends ImportedSymbolBase {
    isNamespaceImport: true;
    name: string;
}
type ImportedSymbol = NamedImportedSymbol | NamespaceImportedSymbol;
/**
 * A Set of imported symbols and data about them
 */
type ImportedSymbolSet = Set<ImportedSymbol>;
/**
 * A Map between source files and their ImportedSymbolSets
 */
type SourceFileToImportedSymbolSet = Map<string, ImportedSymbolSet>;
interface BaseVisitorContextShared {
    compilerOptions: TS.CompilerOptions;
    evaluate(node: TS.Declaration | TS.Expression | TS.Statement): EvaluateResult;
    needsImportPreservationLogic: boolean;
    // Some files need to add 'tslib' to their 'define' arrays
    sourceFileToAddTslibDefinition: Map<string, boolean>;
    // We might need to add in additional ImportDeclarations for
    // things like type-only implementation arguments, but we'll need to add
    // those in an after-transformer, since we will need to check if another import
    // already exists for that binding after transpilation
    sourceFileToRequiredImportedSymbolSet: SourceFileToImportedSymbolSet;
}
interface BaseVisitorContextProgram extends BaseVisitorContextShared, Required<DiProgramOptions> {
    typeChecker: TS.TypeChecker;
}
interface BaseVisitorContextIsolatedModules extends BaseVisitorContextShared, Required<DiIsolatedModulesOptions> {
}
type BaseVisitorContext = BaseVisitorContextProgram | BaseVisitorContextIsolatedModules;
interface VisitorContextShared {
    factory: TS.NodeFactory;
    transformationContext: TS.TransformationContext;
}
interface VisitorContextProgram extends BaseVisitorContextProgram, VisitorContextShared {
}
interface VisitorContextIsolatedModules extends BaseVisitorContextIsolatedModules, VisitorContextShared {
}
type VisitorContext = VisitorContextProgram | VisitorContextIsolatedModules;
declare function getBaseVisitorContext({ typescript, ...rest }?: DiOptions): BaseVisitorContext;
declare function afterTransformer(context: BaseVisitorContext): TS.TransformerFactory<TS.SourceFile>;
type VisitorContinuation<T extends TS.Node> = (node: T) => TS.VisitResult<T>;
interface VisitorOptions<T extends TS.Node> {
    node: T;
    sourceFile: TS.SourceFile;
    context: VisitorContext;
    continuation: VisitorContinuation<TS.Node>;
    childContinuation: VisitorContinuation<TS.Node>;
}
type RootBlock = TS.Node & {
    statements: TS.NodeArray<TS.Statement>;
};
interface AfterVisitorOptions<T extends TS.Node> extends VisitorOptions<T> {
    defineArrayLiteralExpression: TS.ArrayLiteralExpression | undefined;
    rootBlock: RootBlock;
}
declare function visitNode<T extends TS.Node>(options: AfterVisitorOptions<T>): TS.VisitResult<TS.Node>;
declare function visitDefineArrayLiteralExpression(options: AfterVisitorOptions<TS.ArrayLiteralExpression>): TS.ArrayLiteralExpression;
declare function visitRootBlockBlock(options: AfterVisitorOptions<TS.Block>): TS.VisitResult<TS.Node>;
declare function visitRootBlockSourceFile(options: AfterVisitorOptions<TS.SourceFile>): TS.VisitResult<TS.Node>;
declare function visitRootBlock(options: AfterVisitorOptions<RootBlock>): TS.Statement[];
declare function beforeTransformer(context: BaseVisitorContext): TS.TransformerFactory<TS.SourceFile>;
declare function transformSourceFile(sourceFile: TS.SourceFile, context: VisitorContext): TS.SourceFile;
interface BeforeVisitorOptions<T extends TS.Node> extends VisitorOptions<T> {
    requireImportedSymbol(importedSymbol: ImportedSymbol): void;
    addTslibDefinition(): void;
}
declare function visitNode$0<T extends TS.Node>(options: BeforeVisitorOptions<T>): TS.VisitResult<TS.Node>;
declare function visitCallExpression(options: BeforeVisitorOptions<TS.CallExpression>): TS.VisitResult<TS.Node>;
type TSWithHelpers = typeof TS & {
    importDefaultHelper?: TS.EmitHelper;
    importStarHelper?: TS.EmitHelper;
};
declare function needsImportPreservationLogic(context: Pick<BaseVisitorContext, "compilerOptions" | "typescript">): boolean;
declare function needsImportPreservationLogic(typescript: typeof TS, compilerOptions: TS.CompilerOptions): boolean;
declare function getImportDefaultHelper(typescript: TSWithHelpers): TS.EmitHelper;
declare function getImportStarHelper(typescript: TSWithHelpers): TS.EmitHelper;
declare function moduleKindSupportsImportHelpers(moduleKind: TS.ModuleKind | undefined, typescript: typeof TS): boolean;
declare function moduleKindDefinesDependencies(moduleKind: TS.ModuleKind | undefined, typescript: typeof TS): boolean;
declare function getUnscopedHelperName(context: VisitorContext, helperName: string): TS.Identifier;
declare function getRootBlockInsertionPosition(rootBlock: RootBlock, typescript: typeof TS): number;
declare function getDefineArrayLiteralExpression(sourceFile: TS.SourceFile, context: VisitorContext): TS.ArrayLiteralExpression | undefined;
declare function getRootBlock(sourceFile: TS.SourceFile, context: VisitorContext): RootBlock;
declare function isImportedSymbolImported(importedSymbol: ImportedSymbol, rootBlock: RootBlock, context: VisitorContext): boolean;
declare function generateImportStatementForImportedSymbolInContext(importedSymbol: ImportedSymbol, context: VisitorContext): TS.Statement | undefined;
declare function visitClassLikeDeclaration(options: BeforeVisitorOptions<TS.ClassLikeDeclaration>): TS.VisitResult<TS.Node>;
/**
 * A TypeNode such as IFoo<string> should still yield the service name "IFoo".
 * This helper generates a proper service name from a TypeNode
 */
declare function pickServiceOrImplementationName(node: TS.Expression | TS.TypeNode | TS.EntityName, context: VisitorContext): string;
declare function getModifierLikes(node: TS.Node): readonly TS.ModifierLike[] | undefined;
declare const CONSTRUCTOR_ARGUMENTS_SYMBOL_IDENTIFIER = "___CTOR_ARGS___";
declare const DI_CONTAINER_NAME = "DIContainer";
type DiMethodName = "get" | "has" | "registerSingleton" | "registerTransient";
interface FileCacheOptions {
    cacheName: string;
    ttl: number;
}
declare class FileCache<T> extends Map<string, T> {
    private readonly cacheFiles;
    private readonly options;
    constructor({ cacheName, ttl }?: Partial<FileCacheOptions>);
    private get cacheDirectory();
    private readTransformResult;
    get(key: string): NonNullable<T> | undefined;
    set(key: string, value: T): this;
    expireDiskCache(): void;
}
export { transform, di, getBaseVisitorContext, afterTransformer, visitNode, visitDefineArrayLiteralExpression, visitRootBlockBlock, visitRootBlockSourceFile, visitRootBlock, beforeTransformer, transformSourceFile, visitCallExpression, needsImportPreservationLogic, getImportDefaultHelper, getImportStarHelper, moduleKindSupportsImportHelpers, moduleKindDefinesDependencies, getUnscopedHelperName, getRootBlockInsertionPosition, getDefineArrayLiteralExpression, getRootBlock, isImportedSymbolImported, generateImportStatementForImportedSymbolInContext, visitClassLikeDeclaration, pickServiceOrImplementationName, getModifierLikes, CONSTRUCTOR_ARGUMENTS_SYMBOL_IDENTIFIER, DI_CONTAINER_NAME, DiMethodName, FileCache };
