import * as TS from 'typescript';
import TS__default from 'typescript';
import { ensureNodeFactory } from 'compatfactory';
import path from 'crosspath';
import { evaluate } from 'ts-evaluator';
import fs from 'fs';
import path$1 from 'path';
import os from 'os';
import crypto from 'crypto';

const CONSTRUCTOR_ARGUMENTS_SYMBOL_IDENTIFIER = `___CTOR_ARGS___`;
const DI_CONTAINER_NAME = "DIContainer";

/**
 * A TypeNode such as IFoo<string> should still yield the service name "IFoo".
 * This helper generates a proper service name from a TypeNode
 */
function pickServiceOrImplementationName(node, context) {
    const { typescript } = context;
    if (typescript.isTypeReferenceNode(node)) {
        return pickServiceOrImplementationName(node.typeName, context);
    }
    else if (typescript.isIndexedAccessTypeNode(node)) {
        return `${pickServiceOrImplementationName(node.objectType, context)}[${pickServiceOrImplementationName(node.indexType, context)}]`;
    }
    else {
        return node.getText().trim();
    }
}
function getModifierLikes(node) {
    const modifiers = "modifiers" in node && Array.isArray(node.modifiers) ? node.modifiers : [];
    if ("decorators" in node && Array.isArray(node.decorators)) {
        return [...node.decorators, ...modifiers];
    }
    else {
        return modifiers;
    }
}

function visitClassLikeDeclaration(options) {
    const { node, childContinuation, continuation, context } = options;
    const { typescript, factory } = context;
    const constructorDeclaration = node.members.find(typescript.isConstructorDeclaration);
    // If there are no constructor declaration for the ClassLikeDeclaration, there's nothing to do
    if (constructorDeclaration == null) {
        return childContinuation(node);
    }
    const updatedClassMembers = [
        ...node.members.map(continuation),
        factory.createGetAccessorDeclaration([factory.createModifier(typescript.SyntaxKind.StaticKeyword)], factory.createComputedPropertyName(factory.createIdentifier(`Symbol.for("${CONSTRUCTOR_ARGUMENTS_SYMBOL_IDENTIFIER}")`)), [], undefined, factory.createBlock([factory.createReturnStatement(getParameterTypeNamesAsArrayLiteral(constructorDeclaration.parameters, context))]))
    ];
    const modifierLikes = getModifierLikes(node);
    if (typescript.isClassDeclaration(node)) {
        return factory.updateClassDeclaration(node, modifierLikes, node.name, node.typeParameters, node.heritageClauses, updatedClassMembers);
    }
    else {
        return factory.updateClassExpression(node, modifierLikes, node.name, node.typeParameters, node.heritageClauses, updatedClassMembers);
    }
}
/**
 * Takes ConstructorParams for the given NodeArray of ParameterDeclarations
 */
function getParameterTypeNamesAsArrayLiteral(parameters, context) {
    const { factory } = context;
    const constructorParams = [];
    for (let i = 0; i < parameters.length; i++) {
        const parameter = parameters[i];
        // If the parameter has no type, there's nothing to extract
        if (parameter.type == null) {
            constructorParams[i] = factory.createIdentifier("undefined");
        }
        else {
            constructorParams[i] = factory.createNoSubstitutionTemplateLiteral(pickServiceOrImplementationName(parameter.type, context));
        }
    }
    return factory.createArrayLiteralExpression(constructorParams);
}

// For some TypeScript versions, such as 3.1, these helpers are not exposed by TypeScript,
// so they will have to be duplicated and reused from here in these rare cases
const HELPERS = {
    importDefaultHelper: {
        name: "typescript:commonjsimportdefault",
        scoped: false,
        text: '\nvar __importDefault = (this && this.__importDefault) || function (mod) {\n    return (mod && mod.__esModule) ? mod : { "default": mod };\n};'
    },
    importStarHelper: {
        name: "typescript:commonjsimportstar",
        scoped: false,
        text: '\nvar __importStar = (this && this.__importStar) || function (mod) {\n    if (mod && mod.__esModule) return mod;\n    var result = {};\n    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];\n    result["default"] = mod;\n    return result;\n};'
    }
};
function needsImportPreservationLogic(typescriptOrContext, compilerOptionsOrUndefined) {
    const typescript = arguments.length >= 2 ? typescriptOrContext : typescriptOrContext.typescript;
    const compilerOptions = arguments.length >= 2 ? compilerOptionsOrUndefined : typescriptOrContext.compilerOptions;
    // If value imports shouldn't always be preserved, we'll have to perform import preservation logic
    if (!Boolean(compilerOptions.preserveValueImports))
        return true;
    // Only TypeScript v4.5 and newer supports the `preserValueImports` Compiler option
    if (parseFloat(typescript.version) < 4.5)
        return true;
    switch (compilerOptions.module) {
        case typescript.ModuleKind.AMD:
        case typescript.ModuleKind.UMD:
        case typescript.ModuleKind.CommonJS:
        case typescript.ModuleKind.System:
        case typescript.ModuleKind.None:
            // None of these module systems support the `preserValueImports` Compiler option
            return true;
        default:
            return false;
    }
}
function getImportDefaultHelper(typescript) {
    var _a;
    return (_a = typescript.importDefaultHelper) !== null && _a !== void 0 ? _a : HELPERS.importDefaultHelper;
}
function getImportStarHelper(typescript) {
    var _a;
    return (_a = typescript.importStarHelper) !== null && _a !== void 0 ? _a : HELPERS.importStarHelper;
}
function moduleKindSupportsImportHelpers(moduleKind = TS.ModuleKind.CommonJS, typescript) {
    switch (moduleKind) {
        case typescript.ModuleKind.CommonJS:
        case typescript.ModuleKind.UMD:
        case typescript.ModuleKind.AMD:
            return true;
        default:
            return false;
    }
}
function moduleKindDefinesDependencies(moduleKind = TS.ModuleKind.CommonJS, typescript) {
    switch (moduleKind) {
        case typescript.ModuleKind.UMD:
        case typescript.ModuleKind.AMD:
            return true;
        default:
            return false;
    }
}
function getUnscopedHelperName(context, helperName) {
    const typescript = context.typescript;
    if ("getUnscopedHelperName" in typescript) {
        return typescript.getUnscopedHelperName(helperName);
    }
    else if ("createEmitHelperFactory" in typescript) {
        return typescript.createEmitHelperFactory(context.transformationContext).getUnscopedHelperName(helperName);
    }
    else {
        return typescript.getHelperName(helperName);
    }
}
function getRootBlockInsertionPosition(rootBlock, typescript) {
    let insertPosition = 0;
    for (let i = 0; i < rootBlock.statements.length; i++) {
        const statement = rootBlock.statements[i];
        const isUseStrict = typescript.isExpressionStatement(statement) && typescript.isStringLiteralLike(statement.expression) && statement.expression.text === "use strict";
        const isEsModuleSymbol = typescript.isExpressionStatement(statement) &&
            typescript.isCallExpression(statement.expression) &&
            typescript.isPropertyAccessExpression(statement.expression.expression) &&
            typescript.isIdentifier(statement.expression.expression.expression) &&
            typescript.isIdentifier(statement.expression.expression.name) &&
            statement.expression.expression.expression.text === "Object" &&
            statement.expression.expression.name.text === "defineProperty" &&
            statement.expression.arguments.length >= 2 &&
            typescript.isIdentifier(statement.expression.arguments[0]) &&
            statement.expression.arguments[0].text === "exports" &&
            typescript.isStringLiteralLike(statement.expression.arguments[1]) &&
            statement.expression.arguments[1].text === "__esModule";
        if (isUseStrict || isEsModuleSymbol) {
            insertPosition = Math.max(insertPosition, i + 1);
        }
    }
    return insertPosition;
}
function getDefineArrayLiteralExpression(sourceFile, context) {
    const { compilerOptions, typescript } = context;
    switch (compilerOptions.module) {
        case typescript.ModuleKind.ESNext:
        case typescript.ModuleKind.ES2015:
        case typescript.ModuleKind.ES2020:
        case typescript.ModuleKind.ES2022:
            // There are no such thing for these module types
            return undefined;
        // If we're targeting UMD, the root block won't be the root scope, but the Function Body of an iife
        case typescript.ModuleKind.UMD: {
            for (const statement of sourceFile.statements) {
                if (typescript.isExpressionStatement(statement) &&
                    typescript.isCallExpression(statement.expression) &&
                    typescript.isParenthesizedExpression(statement.expression.expression) &&
                    typescript.isFunctionExpression(statement.expression.expression.expression) &&
                    statement.expression.expression.expression.parameters.length === 1) {
                    const [firstParameter] = statement.expression.expression.expression.parameters;
                    if (typescript.isIdentifier(firstParameter.name)) {
                        if (firstParameter.name.text === "factory") {
                            for (const subStatement of statement.expression.expression.expression.body.statements) {
                                if (typescript.isIfStatement(subStatement) &&
                                    subStatement.elseStatement != null &&
                                    typescript.isIfStatement(subStatement.elseStatement) &&
                                    typescript.isBlock(subStatement.elseStatement.thenStatement)) {
                                    for (const subSubStatement of subStatement.elseStatement.thenStatement.statements) {
                                        if (typescript.isExpressionStatement(subSubStatement) &&
                                            typescript.isCallExpression(subSubStatement.expression) &&
                                            subSubStatement.expression.arguments.length === 2 &&
                                            typescript.isIdentifier(subSubStatement.expression.expression) &&
                                            subSubStatement.expression.expression.text === "define") {
                                            const [firstSubSubStatementExpressionArgument] = subSubStatement.expression.arguments;
                                            if (typescript.isArrayLiteralExpression(firstSubSubStatementExpressionArgument)) {
                                                return firstSubSubStatementExpressionArgument;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            break;
        }
        case typescript.ModuleKind.AMD: {
            for (const statement of sourceFile.statements) {
                if (typescript.isExpressionStatement(statement) &&
                    typescript.isCallExpression(statement.expression) &&
                    typescript.isIdentifier(statement.expression.expression) &&
                    statement.expression.expression.text === "define" &&
                    statement.expression.arguments.length === 2) {
                    const [firstArgument, secondArgument] = statement.expression.arguments;
                    if (typescript.isArrayLiteralExpression(firstArgument)) {
                        if (typescript.isFunctionExpression(secondArgument) && secondArgument.parameters.length >= 2) {
                            const [firstParameter, secondParameter] = secondArgument.parameters;
                            if (typescript.isIdentifier(firstParameter.name) &&
                                typescript.isIdentifier(secondParameter.name) &&
                                firstParameter.name.text === "require" &&
                                secondParameter.name.text === "exports") {
                                return firstArgument;
                            }
                        }
                    }
                }
            }
            break;
        }
    }
    return undefined;
}
function getRootBlock(sourceFile, context) {
    const { compilerOptions, typescript } = context;
    switch (compilerOptions.module) {
        // If we're targeting UMD, the root block won't be the root scope, but the Function Body of an iife
        case typescript.ModuleKind.UMD: {
            for (const statement of sourceFile.statements) {
                if (typescript.isExpressionStatement(statement) && typescript.isCallExpression(statement.expression) && statement.expression.arguments.length === 1) {
                    const [firstArgument] = statement.expression.arguments;
                    if (typescript.isFunctionExpression(firstArgument) && firstArgument.parameters.length === 2) {
                        const [firstParameter, secondParameter] = firstArgument.parameters;
                        if (typescript.isIdentifier(firstParameter.name) &&
                            typescript.isIdentifier(secondParameter.name) &&
                            firstParameter.name.text === "require" &&
                            secondParameter.name.text === "exports") {
                            return firstArgument.body;
                        }
                    }
                }
            }
            break;
        }
        // If we're targeting AMD, the root block won't be the root scope, but the Function Body of the
        // anonymous function provided as a second argument to the define() function
        case typescript.ModuleKind.AMD: {
            for (const statement of sourceFile.statements) {
                if (typescript.isExpressionStatement(statement) &&
                    typescript.isCallExpression(statement.expression) &&
                    typescript.isIdentifier(statement.expression.expression) &&
                    statement.expression.expression.text === "define" &&
                    statement.expression.arguments.length === 2) {
                    const [, secondArgument] = statement.expression.arguments;
                    if (typescript.isFunctionExpression(secondArgument) && secondArgument.parameters.length >= 2) {
                        const [firstParameter, secondParameter] = secondArgument.parameters;
                        if (typescript.isIdentifier(firstParameter.name) &&
                            typescript.isIdentifier(secondParameter.name) &&
                            firstParameter.name.text === "require" &&
                            secondParameter.name.text === "exports") {
                            return secondArgument.body;
                        }
                    }
                }
            }
            break;
        }
    }
    return sourceFile;
}
function isImportedSymbolImported(importedSymbol, rootBlock, context) {
    const { compilerOptions, typescript } = context;
    switch (compilerOptions.module) {
        case typescript.ModuleKind.ES2022:
        case typescript.ModuleKind.ES2020:
        case typescript.ModuleKind.ES2015:
        case typescript.ModuleKind.ESNext: {
            for (const statement of rootBlock.statements) {
                if (!typescript.isImportDeclaration(statement))
                    continue;
                if (!typescript.isStringLiteralLike(statement.moduleSpecifier)) {
                    continue;
                }
                if (statement.moduleSpecifier.text !== importedSymbol.moduleSpecifier) {
                    continue;
                }
                if (statement.importClause == null) {
                    continue;
                }
                if ("isDefaultImport" in importedSymbol) {
                    if (importedSymbol.isDefaultImport) {
                        if (statement.importClause.name == null) {
                            continue;
                        }
                        if (statement.importClause.name.text !== importedSymbol.name) {
                            continue;
                        }
                        return true;
                    }
                    else {
                        if (statement.importClause.namedBindings == null)
                            continue;
                        if (!typescript.isNamedImports(statement.importClause.namedBindings)) {
                            continue;
                        }
                        for (const importSpecifier of statement.importClause.namedBindings.elements) {
                            if (importSpecifier.name.text !== importedSymbol.name)
                                continue;
                            return true;
                        }
                    }
                }
                else if ("isNamespaceImport" in importedSymbol) {
                    if (statement.importClause.namedBindings == null)
                        continue;
                    if (!typescript.isNamespaceImport(statement.importClause.namedBindings)) {
                        continue;
                    }
                    if (statement.importClause.namedBindings.name.text !== importedSymbol.name) {
                        continue;
                    }
                    return true;
                }
            }
            return false;
        }
        case typescript.ModuleKind.CommonJS:
        case typescript.ModuleKind.AMD:
        case typescript.ModuleKind.UMD: {
            for (const statement of rootBlock.statements) {
                if (!typescript.isVariableStatement(statement))
                    continue;
                for (const declaration of statement.declarationList.declarations) {
                    if (!typescript.isIdentifier(declaration.name))
                        continue;
                    if (declaration.name.text !== importedSymbol.name)
                        continue;
                    return true;
                }
            }
        }
    }
    // TODO: Add support for other module systems
    return false;
}
function generateImportStatementForImportedSymbolInContext(importedSymbol, context) {
    const { compilerOptions, typescript, factory } = context;
    switch (compilerOptions.module) {
        case typescript.ModuleKind.ES2022:
        case typescript.ModuleKind.ES2020:
        case typescript.ModuleKind.ES2015:
        case typescript.ModuleKind.ESNext: {
            return factory.createImportDeclaration(undefined, "isDefaultImport" in importedSymbol
                ? factory.createImportClause(false, !importedSymbol.isDefaultImport ? undefined : factory.createIdentifier(importedSymbol.name), importedSymbol.isDefaultImport
                    ? undefined
                    : factory.createNamedImports([
                        factory.createImportSpecifier(false, importedSymbol.propertyName === importedSymbol.name ? undefined : factory.createIdentifier(importedSymbol.propertyName), factory.createIdentifier(importedSymbol.name))
                    ]))
                : "isNamespaceImport" in importedSymbol
                    ? factory.createImportClause(false, undefined, factory.createNamespaceImport(factory.createIdentifier(importedSymbol.name)))
                    : undefined, factory.createStringLiteral(importedSymbol.moduleSpecifier));
        }
        case typescript.ModuleKind.CommonJS:
        case typescript.ModuleKind.AMD:
        case typescript.ModuleKind.UMD: {
            const requireCall = factory.createCallExpression(factory.createIdentifier("require"), undefined, [factory.createStringLiteral(importedSymbol.moduleSpecifier)]);
            let wrappedRequireCall = requireCall;
            // We'll need to use a helper, '__importDefault', and wrap the require call with it
            if (compilerOptions.esModuleInterop === true &&
                (("isDefaultImport" in importedSymbol && importedSymbol.isDefaultImport) || (!("isDefaultImport" in importedSymbol) && importedSymbol.isNamespaceImport))) {
                // If tslib is being used, we can do something like 'require("tslib").__import{Default|Star}(<requireCall>)'
                if (compilerOptions.importHelpers === true) {
                    wrappedRequireCall = factory.createCallExpression(factory.createPropertyAccessExpression(factory.createCallExpression(factory.createIdentifier("require"), undefined, [factory.createStringLiteral("tslib")]), getUnscopedHelperName(context, "isDefaultImport" in importedSymbol ? "__importDefault" : "__importStar")), undefined, [requireCall]);
                }
                // Otherwise, we'll have to make sure that the helper is being inlined in an transformation step later
                else {
                    // We've already requested the __importDefault helper in the before transformer under these
                    // circumstances
                    wrappedRequireCall = factory.createCallExpression(getUnscopedHelperName(context, "isDefaultImport" in importedSymbol ? "__importDefault" : "__importStar"), undefined, [
                        requireCall
                    ]);
                }
            }
            return factory.createVariableStatement(undefined, factory.createVariableDeclarationList([factory.createVariableDeclaration(factory.createIdentifier(importedSymbol.name), undefined, undefined, wrappedRequireCall)], typescript.NodeFlags.Const));
        }
    }
    // TODO: Handle other module types as well
    return undefined;
}

/**
 * Ensures that the given item is an array
 */
function ensureArray(item) {
    return Array.isArray(item) ? item : [item];
}
/**
 * Converts the given string to a boolean
 */
function booleanize(str) {
    if (str == null)
        return false;
    if (typeof str === "boolean")
        return str;
    if (isTrueLike(str)) {
        return true;
    }
    else if (isFalseLike(str)) {
        return false;
    }
    else {
        return Boolean(str);
    }
}
function isTrueLike(str) {
    if (typeof str === "boolean")
        return str === true;
    if (str == null)
        return false;
    switch (str.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
        case "":
            return true;
        default:
            return false;
    }
}
function isFalseLike(str) {
    if (typeof str === "boolean")
        return str === false;
    if (str == null)
        return true;
    switch (str.toLowerCase().trim()) {
        case "false":
        case "no":
        case "0":
            return true;
        default:
            return false;
    }
}
const sha1 = (data) => crypto.createHash("sha1").update(data).digest("hex");
const NOOP = () => {
    // Noop
};

function visitCallExpression(options) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { node, childContinuation, continuation, context, addTslibDefinition, requireImportedSymbol } = options;
    const { typescript, factory, compilerOptions, transformationContext, needsImportPreservationLogic } = context;
    const diMethod = getDiMethodName(node.expression, context);
    if (diMethod != null) {
        switch (diMethod) {
            case "get":
            case "has": {
                // If no type arguments are given, don't modify the node at all
                if (node.typeArguments == null || node.typeArguments[0] == null) {
                    return childContinuation(node);
                }
                const [firstTypeArgument] = node.typeArguments;
                return factory.updateCallExpression(node, node.expression, node.typeArguments, [
                    factory.createObjectLiteralExpression([
                        factory.createPropertyAssignment("identifier", factory.createStringLiteral(((_b = (_a = firstTypeArgument.getFirstToken()) === null || _a === void 0 ? void 0 : _a.getText()) !== null && _b !== void 0 ? _b : firstTypeArgument.getText()).trim()))
                    ])
                ]);
            }
            case "registerSingleton":
            case "registerTransient": {
                const [typeArg, secondTypeArg] = ((_c = node.typeArguments) !== null && _c !== void 0 ? _c : []);
                const [firstArgument] = (_d = node.arguments) !== null && _d !== void 0 ? _d : [];
                // The user may explicitly pass 'undefined' as a value here, which shouldn't count as a custom implementation
                const customImplementation = firstArgument == null || (typescript.isIdentifier(firstArgument) && firstArgument.text === "undefined") ? undefined : firstArgument;
                const implementationArg = 
                // If another implementation is passed, used that one instead
                (_e = customImplementation !== null && customImplementation !== void 0 ? customImplementation : 
                // If not implementation is provided, use the type argument *as* the implementation
                secondTypeArg) !== null && _e !== void 0 ? _e : typeArg;
                if (typeArg == null || implementationArg == null) {
                    return childContinuation(node);
                }
                const typeArgText = pickServiceOrImplementationName(typeArg, context);
                const implementationArgText = pickServiceOrImplementationName(implementationArg, context);
                // If the Implementation is a TypeNode, and if it originates from an ImportDeclaration, it may be stripped from the file since Typescript won't Type-check the updates from
                // a CustomTransformer and such a node would normally be removed from the imports.
                // to fix it, add an ImportDeclaration if needed. This is only needed if `preserveValueImports` is falsy
                if (needsImportPreservationLogic && customImplementation == null) {
                    const matchingImport = findMatchingImportDeclarationForIdentifier(implementationArgText, options);
                    if (matchingImport != null && typescript.isStringLiteralLike(matchingImport.importDeclaration.moduleSpecifier)) {
                        switch (matchingImport.kind) {
                            case "default": {
                                // Log a request for the __importDefault helper already if we will
                                // need it in a later transformation step
                                if (moduleKindSupportsImportHelpers(compilerOptions.module, typescript) && compilerOptions.esModuleInterop === true && compilerOptions.importHelpers !== true) {
                                    transformationContext.requestEmitHelper(getImportDefaultHelper(typescript));
                                }
                                // Log a request for adding 'tslib' to the define([...]) array for the current
                                // module system if it relies on declaring dependencies (such as UMD, AMD, and SystemJS does)
                                if (moduleKindDefinesDependencies(compilerOptions.module, typescript) && compilerOptions.esModuleInterop === true && compilerOptions.importHelpers === true) {
                                    addTslibDefinition();
                                }
                                requireImportedSymbol({
                                    isDefaultImport: true,
                                    moduleSpecifier: matchingImport.importDeclaration.moduleSpecifier.text,
                                    name: matchingImport.identifier.text,
                                    propertyName: matchingImport.identifier.text
                                });
                                break;
                            }
                            case "namedImport": {
                                requireImportedSymbol({
                                    isDefaultImport: false,
                                    moduleSpecifier: matchingImport.importDeclaration.moduleSpecifier.text,
                                    name: matchingImport.importSpecifier.name.text,
                                    propertyName: (_g = (_f = matchingImport.importSpecifier.propertyName) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : matchingImport.importSpecifier.name.text
                                });
                                break;
                            }
                            case "namespace": {
                                // Log a request for the __importStar helper already if you will
                                // need it in a later transformation step
                                if (moduleKindSupportsImportHelpers(compilerOptions.module, typescript) && compilerOptions.esModuleInterop === true && compilerOptions.importHelpers !== true) {
                                    transformationContext.requestEmitHelper(getImportStarHelper(typescript));
                                }
                                requireImportedSymbol({
                                    isNamespaceImport: true,
                                    moduleSpecifier: matchingImport.importDeclaration.moduleSpecifier.text,
                                    name: matchingImport.identifier.text
                                });
                                break;
                            }
                        }
                    }
                }
                return factory.updateCallExpression(node, node.expression, node.typeArguments, [
                    customImplementation == null ? factory.createIdentifier("undefined") : continuation(implementationArg),
                    factory.createObjectLiteralExpression([
                        factory.createPropertyAssignment("identifier", factory.createNoSubstitutionTemplateLiteral(typeArgText)),
                        ...(customImplementation != null
                            ? []
                            : [factory.createPropertyAssignment("implementation", factory.createIdentifier(rewriteImplementationName(implementationArgText, options)))])
                    ])
                ]);
            }
        }
    }
    return childContinuation(node);
}
function findMatchingImportDeclarationForIdentifier(identifier, options) {
    var _a;
    const { sourceFile, context: { typescript } } = options;
    // Find the matching import
    const importDeclarations = sourceFile.statements.filter(typescript.isImportDeclaration);
    for (const importDeclaration of importDeclarations) {
        if (importDeclaration.importClause == null)
            continue;
        // Default import
        if (((_a = importDeclaration.importClause.name) === null || _a === void 0 ? void 0 : _a.text) === identifier) {
            return {
                importDeclaration,
                kind: "default",
                identifier: importDeclaration.importClause.name
            };
        }
        else if (importDeclaration.importClause.namedBindings != null) {
            if (typescript.isNamespaceImport(importDeclaration.importClause.namedBindings)) {
                if (importDeclaration.importClause.namedBindings.name.text === identifier) {
                    return {
                        importDeclaration,
                        kind: "namespace",
                        identifier: importDeclaration.importClause.namedBindings.name
                    };
                }
            }
            else {
                for (const importSpecifier of importDeclaration.importClause.namedBindings.elements) {
                    if (importSpecifier.name.text === identifier) {
                        return {
                            importDeclaration,
                            kind: "namedImport",
                            importSpecifier: importSpecifier
                        };
                    }
                }
            }
        }
    }
    // No import was matched
    return undefined;
}
function rewriteImplementationName(name, options) {
    var _a;
    const { context: { typescript, compilerOptions } } = options;
    switch (compilerOptions.module) {
        case typescript.ModuleKind.ES2022:
        case typescript.ModuleKind.ES2020:
        case typescript.ModuleKind.ES2015:
        case typescript.ModuleKind.ESNext:
            return name;
        case typescript.ModuleKind.CommonJS:
        case typescript.ModuleKind.AMD:
        case typescript.ModuleKind.UMD: {
            // Find the matching import
            const match = findMatchingImportDeclarationForIdentifier(name, options);
            if (match == null) {
                return name;
            }
            switch (match.kind) {
                case "default":
                    return `${name}.default`;
                case "namespace":
                    return name;
                case "namedImport":
                    return `${name}.${((_a = match.importSpecifier.propertyName) !== null && _a !== void 0 ? _a : match.importSpecifier.name).text}`;
            }
            // Fall back to returning the original name
            return name;
        }
        default:
            // TODO: Add support for SystemJS here
            return name;
    }
}
function getDiMethodName(node, context) {
    if (!context.typescript.isPropertyAccessExpression(node) && !context.typescript.isElementAccessExpression(node)) {
        return undefined;
    }
    // If it is an element access expression, evaluate the argument expression
    if (context.typescript.isElementAccessExpression(node)) {
        // Do nothing at this point if this isn't a DIContainer instance, as we can avoid invoking evaluate at this point
        if (!isDiContainerInstance(node, context)) {
            return undefined;
        }
        const evaluationResult = context.evaluate(node.argumentExpression);
        // If no value could be computed, or if the value isn't of type string, do nothing
        if (!evaluationResult.success || typeof evaluationResult.value !== "string") {
            return undefined;
        }
        else {
            return isDiContainerMethodName(evaluationResult.value) ? evaluationResult.value : undefined;
        }
    }
    else {
        // If the name is any of the relevant ones, assert that it is invoked on an instance of DIContainer
        return isDiContainerMethodName(node.name.text) && isDiContainerInstance(node, context) ? node.name.text : undefined;
    }
}
function isDiContainerMethodName(name) {
    switch (name) {
        case "get":
        case "has":
        case "registerSingleton":
        case "registerTransient":
            return true;
        default:
            return false;
    }
}
function isDiContainerInstance(node, context) {
    var _a, _b, _c;
    if ("typeChecker" in context) {
        // Don't proceed unless the left-hand expression is the DIServiceContainer
        const type = context.typeChecker.getTypeAtLocation(node.expression);
        if (type == null || type.symbol == null || type.symbol.escapedName !== DI_CONTAINER_NAME) {
            return false;
        }
    }
    else {
        // If one or more variable names were passed in, check those directly
        if (context.identifier != null && context.identifier.length > 0) {
            // Pick the left-hand side of the expression here
            const name = ((_b = (_a = node.expression.getFirstToken()) === null || _a === void 0 ? void 0 : _a.getText()) !== null && _b !== void 0 ? _b : node.expression.getText()).trim();
            // If not a single matcher matches the text, this does not represent an instance of DIContainer.
            if (!ensureArray(context.identifier).some(matcher => name === matcher)) {
                return false;
            }
        }
        else {
            // Otherwise, attempt to resolve the value of the expression and check if it is an instance of DIContainer
            const evaluationResult = context.evaluate(node.expression);
            if (!evaluationResult.success ||
                evaluationResult.value == null ||
                typeof evaluationResult.value !== "object" ||
                ((_c = evaluationResult.value.constructor) === null || _c === void 0 ? void 0 : _c.name) !== DI_CONTAINER_NAME) {
                return false;
            }
        }
    }
    return true;
}

function visitNode$1(options) {
    if (options.context.typescript.isClassLike(options.node)) {
        return visitClassLikeDeclaration({ ...options, node: options.node });
    }
    else if (options.context.typescript.isCallExpression(options.node)) {
        return visitCallExpression({ ...options, node: options.node });
    }
    return options.childContinuation(options.node);
}

function beforeTransformer(context) {
    return transformationContext => {
        var _a;
        const factory = ensureNodeFactory((_a = transformationContext.factory) !== null && _a !== void 0 ? _a : context.typescript);
        return sourceFile => transformSourceFile$1(sourceFile, {
            ...context,
            transformationContext,
            factory
        });
    };
}
function transformSourceFile$1(sourceFile, context) {
    const requiredImportedSymbolSet = new Set();
    /**
     * An optimization in which every imported symbol is converted into
     * a string that can be matched against directly to guard against
     * duplicates
     */
    const requiredImportedSymbolSetFlags = new Set();
    if (context.needsImportPreservationLogic) {
        context.sourceFileToAddTslibDefinition.set(sourceFile.fileName, false);
        context.sourceFileToRequiredImportedSymbolSet.set(sourceFile.fileName, requiredImportedSymbolSet);
    }
    const computeImportedSymbolFlag = (symbol) => ["name", "propertyName", "moduleSpecifier", "isNamespaceImport", "isDefaultImport"]
        .map(property => { var _a; return `${property}:${(_a = symbol[property]) !== null && _a !== void 0 ? _a : false}`; })
        .join("|");
    const visitorOptions = {
        context,
        addTslibDefinition: () => {
            if (!context.needsImportPreservationLogic)
                return;
            context.sourceFileToAddTslibDefinition.set(sourceFile.fileName, true);
        },
        requireImportedSymbol: (importedSymbol) => {
            if (!context.needsImportPreservationLogic)
                return;
            // Guard against duplicates and compute a string so we can do
            // constant time lookups to compare against existing symbols
            const flag = computeImportedSymbolFlag(importedSymbol);
            if (requiredImportedSymbolSetFlags.has(flag))
                return;
            requiredImportedSymbolSetFlags.add(flag);
            requiredImportedSymbolSet.add(importedSymbol);
        },
        continuation: node => visitNode$1({
            ...visitorOptions,
            sourceFile,
            node
        }),
        childContinuation: node => context.typescript.visitEachChild(node, cbNode => visitNode$1({
            ...visitorOptions,
            sourceFile,
            node: cbNode
        }), context.transformationContext)
    };
    return visitorOptions.continuation(sourceFile);
}

function visitRootBlock(options) {
    var _a;
    const { node, sourceFile, context } = options;
    const { typescript } = context;
    const leadingExtraStatements = [];
    for (const importedSymbol of (_a = context.sourceFileToRequiredImportedSymbolSet.get(sourceFile.fileName)) !== null && _a !== void 0 ? _a : new Set()) {
        if (isImportedSymbolImported(importedSymbol, node, context))
            continue;
        const missingImportStatement = generateImportStatementForImportedSymbolInContext(importedSymbol, context);
        if (missingImportStatement != null) {
            leadingExtraStatements.push(missingImportStatement);
        }
    }
    const insertPosition = getRootBlockInsertionPosition(node, typescript);
    return [...node.statements.slice(0, insertPosition), ...leadingExtraStatements, ...node.statements.slice(insertPosition)];
}

function visitRootBlockSourceFile(options) {
    const { node, context } = options;
    const { factory } = context;
    return factory.updateSourceFile(node, visitRootBlock(options), node.isDeclarationFile, node.referencedFiles, node.typeReferenceDirectives, node.hasNoDefaultLib, node.libReferenceDirectives);
}

function visitRootBlockBlock(options) {
    const { node, context } = options;
    const { factory } = context;
    return factory.updateBlock(node, visitRootBlock(options));
}

function visitDefineArrayLiteralExpression(options) {
    var _a;
    const { node, sourceFile, context } = options;
    const { typescript, factory } = context;
    const trailingExtraExpressions = [];
    for (const importedSymbol of (_a = context.sourceFileToRequiredImportedSymbolSet.get(sourceFile.fileName)) !== null && _a !== void 0 ? _a : new Set()) {
        // Skip the node if it is already declared as a dependency
        if (node.elements.some(element => typescript.isStringLiteralLike(element) && element.text === importedSymbol.moduleSpecifier)) {
            continue;
        }
        trailingExtraExpressions.push(factory.createStringLiteral(importedSymbol.moduleSpecifier));
    }
    if (context.sourceFileToAddTslibDefinition.get(sourceFile.fileName) === true) {
        trailingExtraExpressions.push(factory.createStringLiteral("tslib"));
    }
    if (trailingExtraExpressions.length < 1) {
        return node;
    }
    return factory.updateArrayLiteralExpression(node, [...node.elements, ...trailingExtraExpressions]);
}

function visitNode(options) {
    const { node, childContinuation, defineArrayLiteralExpression, rootBlock, context: { typescript } } = options;
    if (typescript.isSourceFile(node) && rootBlock === node) {
        return visitRootBlockSourceFile({ ...options, node });
    }
    else if (typescript.isBlock(node) && rootBlock === node) {
        return visitRootBlockBlock({ ...options, node });
    }
    else if (typescript.isArrayLiteralExpression(node) && defineArrayLiteralExpression === node) {
        return visitDefineArrayLiteralExpression({
            ...options,
            node
        });
    }
    return childContinuation(options.node);
}

function afterTransformer(context) {
    return transformationContext => {
        var _a;
        const factory = ensureNodeFactory((_a = transformationContext.factory) !== null && _a !== void 0 ? _a : context.typescript);
        return sourceFile => transformSourceFile(sourceFile, {
            ...context,
            transformationContext,
            factory
        });
    };
}
function transformSourceFile(sourceFile, context) {
    // For TypeScript versions below 3.5, there may be instances
    // where EmitHelpers such as __importDefault or __importStar is duplicated.
    // For these TypeScript versions, well have to guard against this behavior
    if (sourceFile.emitNode != null && sourceFile.emitNode.helpers != null) {
        const seenNames = new Set();
        const filtered = sourceFile.emitNode.helpers.filter(helper => {
            if (seenNames.has(helper.name))
                return false;
            seenNames.add(helper.name);
            return true;
        });
        // Reassign the emitNodes if they changed
        if (filtered.length !== sourceFile.emitNode.helpers.length) {
            sourceFile.emitNode.helpers = filtered;
        }
    }
    const visitorOptions = {
        context,
        defineArrayLiteralExpression: getDefineArrayLiteralExpression(sourceFile, context),
        rootBlock: getRootBlock(sourceFile, context),
        continuation: node => visitNode({
            ...visitorOptions,
            sourceFile,
            node
        }),
        childContinuation: node => context.typescript.visitEachChild(node, cbNode => visitNode({
            ...visitorOptions,
            sourceFile,
            node: cbNode
        }), context.transformationContext)
    };
    return visitorOptions.continuation(sourceFile);
}

/**
 * Shim the @wessberg/di module
 */
const EVALUATE_MODULE_OVERRIDES = {
    "@wessberg/di": {
        [DI_CONTAINER_NAME]: class {
        }
    }
};
function getBaseVisitorContext({ typescript = TS__default, ...rest } = {}) {
    var _a;
    // Prepare a VisitorContext
    const visitorContextShared = {
        sourceFileToAddTslibDefinition: new Map(),
        sourceFileToRequiredImportedSymbolSet: new Map()
    };
    if ("program" in rest) {
        const typeChecker = rest.program.getTypeChecker();
        const compilerOptions = rest.program.getCompilerOptions();
        return {
            ...rest,
            ...visitorContextShared,
            needsImportPreservationLogic: needsImportPreservationLogic(typescript, compilerOptions),
            typescript,
            typeChecker,
            compilerOptions,
            evaluate: node => evaluate({
                node,
                typeChecker,
                typescript,
                moduleOverrides: EVALUATE_MODULE_OVERRIDES
            })
        };
    }
    else {
        const compilerOptions = (_a = rest.compilerOptions) !== null && _a !== void 0 ? _a : typescript.getDefaultCompilerOptions();
        return {
            identifier: [],
            ...rest,
            ...visitorContextShared,
            needsImportPreservationLogic: needsImportPreservationLogic(typescript, compilerOptions),
            typescript,
            compilerOptions,
            evaluate: node => evaluate({
                node,
                typescript,
                moduleOverrides: EVALUATE_MODULE_OVERRIDES
            })
        };
    }
}

/**
 * CustomTransformer that associates constructor arguments with any given class declaration
 */
function di(options) {
    const baseVisitorContext = getBaseVisitorContext(options);
    return {
        before: [beforeTransformer(baseVisitorContext)],
        after: baseVisitorContext.needsImportPreservationLogic ? [afterTransformer(baseVisitorContext)] : []
    };
}

function transform(source, filenameOrOptions, optionsOrUndefined) {
    var _a, _b;
    const filename = typeof filenameOrOptions === "string" ? filenameOrOptions : "file.ts";
    const options = typeof filenameOrOptions === "string" ? optionsOrUndefined : filenameOrOptions;
    const baseVisitorContext = getBaseVisitorContext(options);
    // By preserving value imports, we can avoid the `after` transformer entirely,
    // as well as adding/tracking imports,since nothing will be stripped away.
    baseVisitorContext.compilerOptions.preserveValueImports = true;
    const { compilerOptions } = baseVisitorContext;
    const typescript = baseVisitorContext.typescript;
    const hash = generateCacheKey(source, baseVisitorContext, options);
    const cacheHit = hash == null ? undefined : (_a = options === null || options === void 0 ? void 0 : options.cache) === null || _a === void 0 ? void 0 : _a.get(hash);
    if (cacheHit != null) {
        return cacheHit;
    }
    const newLine = typescript.sys.newLine;
    const printer = ((_b = options === null || options === void 0 ? void 0 : options.printer) !== null && _b !== void 0 ? _b : typescript.createPrinter());
    const factory = ensureNodeFactory(typescript);
    // An undocumented internal helper can be leveraged here
    const transformationContext = typescript.nullTransformationContext;
    const visitorContext = { ...baseVisitorContext, transformationContext, factory };
    const sourceFile = typescript.createSourceFile(filename, source, typescript.ScriptTarget.ESNext, true);
    const transformedSourceFile = transformSourceFile$1(sourceFile, visitorContext);
    let result;
    if (Boolean(compilerOptions.sourceMap)) {
        const sourceMapOptions = {
            sourceMap: Boolean(compilerOptions.sourceMap),
            sourceRoot: "",
            mapRoot: "",
            extendedDiagnostics: false
        };
        const emitHost = {
            getCanonicalFileName: typescript.createGetCanonicalFileName(typescript.sys.useCaseSensitiveFileNames),
            getCompilerOptions: () => compilerOptions,
            getCurrentDirectory: () => path.dirname(filename)
        };
        const sourceMapGenerator = typescript.createSourceMapGenerator(emitHost, path.basename(filename), sourceMapOptions.sourceRoot, path.dirname(filename), sourceMapOptions);
        const writer = typescript.createTextWriter(newLine);
        printer.writeFile(transformedSourceFile, writer, sourceMapGenerator);
        const sourceMappingUrl = getSourceMappingUrl(sourceMapGenerator, filename, Boolean(compilerOptions.inlineSourceMap));
        if (sourceMappingUrl.length > 0) {
            if (!writer.isAtStartOfLine())
                writer.rawWrite(newLine);
            writer.writeComment("//# ".concat("sourceMappingURL", "=").concat(sourceMappingUrl)); // Tools can sometimes see this line as a source mapping url comment
        }
        result = {
            code: writer.getText(),
            map: Boolean(compilerOptions.inlineSourceMap) ? undefined : sourceMapGenerator.toString()
        };
    }
    else {
        result = {
            code: printer.printFile(transformedSourceFile)
        };
    }
    if (hash != null && (options === null || options === void 0 ? void 0 : options.cache) != null) {
        options.cache.set(hash, result);
    }
    return result;
}
function generateCacheKey(source, context, options) {
    // No point in calculating a hash if there's no cache in use
    if ((options === null || options === void 0 ? void 0 : options.cache) == null)
        return undefined;
    const identifier = options != null && "identifier" in options ? options.identifier : undefined;
    let key = source;
    if (identifier != null) {
        key += ensureArray(identifier).join(",");
    }
    key += Boolean(context.compilerOptions.sourceMap);
    return sha1(key);
}
function getSourceMappingUrl(sourceMapGenerator, filePath, inline) {
    if (inline) {
        // Encode the sourceMap into the sourceMap url
        const sourceMapText = sourceMapGenerator.toString();
        const base64SourceMapText = Buffer.from(sourceMapText).toString("base64");
        return "data:application/json;base64,".concat(base64SourceMapText);
    }
    const sourceMapFilePath = `${filePath}.map`;
    const sourceMapFile = path.basename(sourceMapFilePath);
    return encodeURI(sourceMapFile);
}

/**
 * This implementation is very closely inspired by that found in https://github.com/esbuild-kit/core-utils.
 */
const DEFAULT_TTL_DAYS = 7;
const DEFAULT_TTL = 60 * 60 * 24 * DEFAULT_TTL_DAYS * 1000;
class FileCache extends Map {
    constructor({ cacheName = "di-compiler", ttl = DEFAULT_TTL } = {}) {
        super();
        this.cacheFiles = [];
        this.options = { cacheName, ttl };
        // Initialize the disk cache
        fs.mkdirSync(this.cacheDirectory, { recursive: true });
        this.cacheFiles = fs.readdirSync(this.cacheDirectory).map(fileName => {
            const [time, key] = fileName.split("-");
            return {
                time: Number(time),
                key,
                fileName
            };
        });
        setImmediate(() => this.expireDiskCache());
    }
    get cacheDirectory() {
        return path$1.join(os.tmpdir(), this.options.cacheName);
    }
    readTransformResult(filePath) {
        try {
            const jsonString = fs.readFileSync(filePath, "utf8");
            return JSON.parse(jsonString);
        }
        catch {
            return undefined;
        }
    }
    get(key) {
        const memoryCacheHit = super.get(key);
        if (memoryCacheHit != null) {
            return memoryCacheHit;
        }
        const diskCacheHit = this.cacheFiles.find(cache => cache.key === key);
        if (diskCacheHit == null) {
            return;
        }
        const cacheFilePath = path$1.join(this.cacheDirectory, diskCacheHit.fileName);
        const cachedResult = this.readTransformResult(cacheFilePath);
        if (cachedResult == null) {
            // Remove broken cache file
            fs.promises.unlink(cacheFilePath).then(() => {
                const index = this.cacheFiles.indexOf(diskCacheHit);
                this.cacheFiles.splice(index, 1);
            }, NOOP);
            return;
        }
        // Load it into memory
        super.set(key, cachedResult);
        return cachedResult;
    }
    set(key, value) {
        super.set(key, value);
        if (value != null) {
            const time = Date.now();
            fs.promises.writeFile(path$1.join(this.cacheDirectory, `${time}-${key}`), JSON.stringify(value)).catch(NOOP);
        }
        return this;
    }
    expireDiskCache() {
        const time = Date.now();
        for (const cache of this.cacheFiles) {
            // Remove if older than ~7 days
            if (time - cache.time > this.options.ttl) {
                fs.promises.unlink(path$1.join(this.cacheDirectory, cache.fileName)).catch(NOOP);
            }
        }
    }
}

export { FileCache, booleanize, di, transform };
//# sourceMappingURL=common.js.map
