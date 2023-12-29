'use strict';

const TS = require('typescript');
const common = require('./common/common.cjs');
const pirates = require('pirates');
const getTsconfig = require('get-tsconfig');

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
            config: getTsconfig.parseTsconfig(process.env[ENV_VARIABLE_TSCONFIG_PATH])
        }
        : (_a = getTsconfig.getTsconfig()) !== null && _a !== void 0 ? _a : undefined);
    let identifier = (_c = (_b = process.env[ENV_VARIABLE_IDENTIFIER]) === null || _b === void 0 ? void 0 : _b.split(",").map(item => item.trim()).filter(item => item.length > 0)) !== null && _c !== void 0 ? _c : (_d = tsconfig.di) === null || _d === void 0 ? void 0 : _d.identifier;
    if (Array.isArray(identifier) && identifier.length === 1) {
        identifier = identifier[0];
    }
    const disableCache = process.env[ENV_VARIABLE_DISABLE_CACHE] == null ? (_f = (_e = tsconfig.di) === null || _e === void 0 ? void 0 : _e.disableCache) !== null && _f !== void 0 ? _f : false : common.booleanize(process.env[ENV_VARIABLE_DISABLE_CACHE]);
    return {
        identifier,
        compilerOptions: tsconfig === null || tsconfig === void 0 ? void 0 : tsconfig.compilerOptions,
        cache: disableCache ? new Map() : new common.FileCache(),
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

const transformOptions = resolveOptions(TS);
pirates.addHook((code, filename) => common.transform(code.toString(), filename, {
    ...transformOptions,
    typescript: TS
}).code, { exts: [...ALLOWED_EXTENSIONS] });
//# sourceMappingURL=loader.cjs.map
