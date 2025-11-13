"use strict";
/*---------------------------------------------------------------------------------------------
 *  HTML Language Server with Emmet Integration
 *  Based on vscode-html-languageservice with emmet-monaco-es integration
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const htmlService = __importStar(require("vscode-html-languageservice"));
const lspAdapter_1 = require("../emmet/lspAdapter");
// Create a connection for the server
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a document manager
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
// Create HTML language service
const htmlLanguageService = htmlService.getLanguageService();
// Emmet configuration
const emmetConfig = {
    showExpandedAbbreviation: 'always',
    showAbbreviationSuggestions: true,
    showSuggestionsAsSnippets: false,
};
/**
 * Helper: check if the position is inside the content of a <script> or <style> tag.
 * We only want Emmet in "pure" HTML, not in embedded CSS/JS.
 */
function isInsideScriptOrStyle(document, position, htmlDocument) {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return false;
    }
    if (node.startTagEnd === undefined || node.endTagStart === undefined) {
        return false;
    }
    const isContent = offset >= node.startTagEnd && offset <= node.endTagStart;
    if (!isContent) {
        return false;
    }
    const tag = node.tag.toLowerCase();
    return tag === 'script' || tag === 'style';
}
connection.onInitialize((_params) => {
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: [
                    '.',
                    ':',
                    '<',
                    '"',
                    '=',
                    '/',
                    // Emmet trigger characters for HTML
                    '!',
                    '}',
                    '*',
                    '$',
                    ']',
                    '>',
                    '0',
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                    '6',
                    '7',
                    '8',
                    '9',
                ],
            },
            hoverProvider: true,
            documentHighlightProvider: true,
            documentLinkProvider: {},
            documentSymbolProvider: true,
            renameProvider: true,
        },
    };
});
connection.onInitialized(() => {
    connection.console.log('HTML Language Server with Emmet initialized');
});
// Handle completion requests
connection.onCompletion(async (textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
    const position = textDocumentPosition.position;
    // Get HTML (and embedded CSS/JS) completions from the HTML language service
    const htmlCompletions = htmlLanguageService.doComplete(document, position, htmlDocument);
    // If we are inside <script> or <style>, do NOT trigger Emmet.
    // Let the built-in embedded language logic handle CSS/JS instead.
    if (isInsideScriptOrStyle(document, position, htmlDocument)) {
        return htmlCompletions;
    }
    // Get Emmet completions for pure HTML context
    const emmetCompletions = (0, lspAdapter_1.getEmmetCompletions)(document, position, 'html', emmetConfig);
    // Merge completions
    if (emmetCompletions && emmetCompletions.items.length > 0) {
        const mergedItems = [
            ...(htmlCompletions?.items || []),
            ...emmetCompletions.items,
        ];
        return {
            isIncomplete: htmlCompletions?.isIncomplete || false,
            items: mergedItems,
        };
    }
    return htmlCompletions;
});
// Handle hover requests
connection.onHover((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
    return htmlLanguageService.doHover(document, textDocumentPosition.position, htmlDocument);
});
// Handle document highlight requests
connection.onDocumentHighlight((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
    return htmlLanguageService.findDocumentHighlights(document, textDocumentPosition.position, htmlDocument);
});
// Handle document links
connection.onDocumentLinks((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const documentContext = {
        resolveReference: (ref) => ref,
    };
    return htmlLanguageService.findDocumentLinks(document, documentContext);
});
// Handle document symbols
connection.onDocumentSymbol((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
    return htmlLanguageService.findDocumentSymbols(document, htmlDocument);
});
// Handle rename requests
connection.onRenameRequest((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
    return htmlLanguageService.doRename(document, params.position, params.newName, htmlDocument);
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
