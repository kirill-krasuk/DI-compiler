import TS__default from 'typescript';
import path from 'path';
import fs from 'fs/promises';
import urlModule from 'url';
import { booleanize, FileCache, transform } from './common/common.js';
import { parseTsconfig, getTsconfig } from 'get-tsconfig';

const ENV_VARIABLE_TSCONFIG_PATH = "DI_COMPILER_TSCONFIG_PATH";
const ENV_VARIABLE_IDENTIFIER = "DI_COMPILER_IDENTIFIER";
const ENV_VARIABLE_DISABLE_CACHE = "DI_COMPILER_DISABLE_CACHE";
// Only these formats have type information that can be transpiled with DICompiler
const ALLOWED_EXTENSIONS = new Set([".ts", ".mts", ".cts"]);
function resolveOptions(typescript) {
    var _a, _b, _c, _d, _e, _f;
    const tsconfig = upgradeTsconfig(typescript, process.env[ENV_VARIABLE_TSCONFIG_PATH] != null
        ? {
            path: process.env[ENV_VARIABLE_TSCONFIG_PATH],
            config: parseTsconfig(process.env[ENV_VARIABLE_TSCONFIG_PATH])
        }
        : (_a = getTsconfig()) !== null && _a !== void 0 ? _a : undefined);
    let identifier = (_c = (_b = process.env[ENV_VARIABLE_IDENTIFIER]) === null || _b === void 0 ? void 0 : _b.split(",").map(item => item.trim()).filter(item => item.length > 0)) !== null && _c !== void 0 ? _c : (_d = tsconfig.di) === null || _d === void 0 ? void 0 : _d.identifier;
    if (Array.isArray(identifier) && identifier.length === 1) {
        identifier = identifier[0];
    }
    const disableCache = process.env[ENV_VARIABLE_DISABLE_CACHE] == null ? (_f = (_e = tsconfig.di) === null || _e === void 0 ? void 0 : _e.disableCache) !== null && _f !== void 0 ? _f : false : booleanize(process.env[ENV_VARIABLE_DISABLE_CACHE]);
    return {
        identifier,
        compilerOptions: tsconfig === null || tsconfig === void 0 ? void 0 : tsconfig.compilerOptions,
        cache: disableCache ? new Map() : new FileCache(),
        printer: typescript.createPrinter()
    };
}
function upgradeTsconfig(typescript, input) {
    var _a;
    if (input == null) {
        return {
            compilerOptions: overrideCompilerOptions(typescript.getDefaultCompilerOptions())
        };
    }
    const inputDiOptions = "config" in input ? input.config.di : input.di;
    const inputCompilerOptions = "config" in input ? input.config.compilerOptions : input.compilerOptions;
    if (inputCompilerOptions == null) {
        return {
            di: inputDiOptions,
            compilerOptions: overrideCompilerOptions(typescript.getDefaultCompilerOptions())
        };
    }
    return {
        di: inputDiOptions,
        compilerOptions: overrideCompilerOptions(typescript.convertCompilerOptionsFromJson(inputCompilerOptions, (_a = inputCompilerOptions.baseUrl) !== null && _a !== void 0 ? _a : ".").options)
    };
}
function overrideCompilerOptions(input) {
    return {
        ...input,
        // We always want to inline source maps when DICompiler is used as a loader
        ...(input.sourceMap === true ? { inlineSourceMap: true } : {}),
        preserveValueImports: true
    };
}

const transformOptions = resolveOptions(TS__default);
const load = async (url, context, nextLoad) => {
    var _a;
    if (ALLOWED_EXTENSIONS.has(path.extname(url))) {
        const fileName = urlModule.fileURLToPath(url);
        const rawSource = await fs.readFile(fileName, "utf-8");
        if (rawSource != null) {
            const { code: source } = transform(rawSource.toString(), fileName, {
                ...transformOptions,
                typescript: TS__default
            });
            return {
                format: (_a = context.format) !== null && _a !== void 0 ? _a : "module",
                shortCircuit: true,
                source
            };
        }
    }
    // Defer to the next hook in the chain.
    return nextLoad(url, context);
};

export { load };
//# sourceMappingURL=loader.js.map
