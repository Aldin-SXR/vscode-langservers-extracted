"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomSnippets = exports.expandAbbreviation = void 0;
exports.emmetHTML = emmetHTML;
exports.emmetCSS = emmetCSS;
exports.emmetJSX = emmetJSX;
const emmetHelper_1 = require("./emmetHelper");
const abbreviationActions_1 = require("./abbreviationActions");
// https://github.com/microsoft/vscode/blob/main/extensions/emmet/src/util.ts#L86
const LANGUAGE_MODES = {
    html: ['!', '.', '}', ':', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    jade: ['!', '.', '}', ':', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    slim: ['!', '.', '}', ':', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    haml: ['!', '.', '}', ':', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    xml: ['.', '}', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    xsl: ['!', '.', '}', '*', '$', '/', ']', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    css: [':', '!', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    scss: [':', '!', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    sass: [':', '!', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    less: [':', '!', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    stylus: [':', '!', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    javascript: ['!', '.', '}', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    typescript: ['!', '.', '}', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
};
// https://github.com/microsoft/vscode/blob/main/extensions/emmet/src/util.ts#L124
const MAPPED_MODES = {
    handlebars: 'html',
    php: 'html',
    twig: 'html',
};
const DEFAULT_CONFIG = {
    showExpandedAbbreviation: 'always',
    showAbbreviationSuggestions: true,
    showSuggestionsAsSnippets: false,
};
/**
 * add completion provider
 * @param monaco monaco self
 * @param language added language
 * @param isMarkup is markup language
 * @param isLegalToken check whether given token is legal or not
 * @param getLegalEmmetSets get legal emmet substring from a string.
 */
function registerProvider(monaco, languages, syntax) {
    if (!monaco) {
        console.error("emmet-monaco-es: 'monaco' should be either declared on window or passed as first parameter");
        return;
    }
    const providers = languages.map((language) => monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: LANGUAGE_MODES[MAPPED_MODES[language] || language],
        provideCompletionItems: (model, position) => (0, abbreviationActions_1.isValidLocationForEmmetAbbreviation)(model, position, syntax, language)
            ? (0, emmetHelper_1.doComplete)(monaco, model, position, syntax, DEFAULT_CONFIG)
            : undefined,
    }));
    return () => {
        providers.forEach((provider) => provider.dispose());
    };
}
function emmetHTML(monaco = window.monaco, languages = ['html']) {
    return registerProvider(monaco, languages, 'html');
}
function emmetCSS(monaco = window.monaco, languages = ['css']) {
    return registerProvider(monaco, languages, 'css');
}
function emmetJSX(monaco = window.monaco, languages = ['javascript']) {
    return registerProvider(monaco, languages, 'jsx');
}
var emmetHelper_2 = require("./emmetHelper");
Object.defineProperty(exports, "expandAbbreviation", { enumerable: true, get: function () { return emmetHelper_2.expandAbbreviation; } });
Object.defineProperty(exports, "registerCustomSnippets", { enumerable: true, get: function () { return emmetHelper_2.registerCustomSnippets; } });
