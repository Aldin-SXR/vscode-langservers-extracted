"use strict";
/*---------------------------------------------------------------------------------------------
 *  LSP Adapter for Emmet Monaco ES
 *  This file adapts the emmet-monaco-es library to work with Language Server Protocol
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmmetCompletions = getEmmetCompletions;
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const emmetHelper_1 = require("./emmetHelper");
const abbreviationActions_1 = require("./abbreviationActions");
// Create a mock Monaco object
const createMonacoMock = () => ({
    languages: {
        CompletionItemKind: {
            Text: 0,
            Method: 1,
            Function: 2,
            Constructor: 3,
            Field: 4,
            Variable: 5,
            Class: 6,
            Interface: 7,
            Module: 8,
            Property: 9,
            Unit: 10,
            Value: 11,
            Enum: 12,
            Keyword: 13,
            Snippet: 14,
            Color: 15,
            File: 16,
            Reference: 17,
            Folder: 18,
            EnumMember: 19,
            Constant: 20,
            Struct: 21,
            Event: 22,
            Operator: 23,
            TypeParameter: 24,
        },
        CompletionItemInsertTextRule: {
            None: 0,
            KeepWhitespace: 1,
            InsertAsSnippet: 4,
        },
    },
    Range: class {
        constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
            this.startLineNumber = startLineNumber;
            this.startColumn = startColumn;
            this.endLineNumber = endLineNumber;
            this.endColumn = endColumn;
        }
    },
});
/**
 * Convert LSP Position to Monaco Position
 */
function lspToMonacoPosition(lspPos) {
    return {
        lineNumber: lspPos.line + 1, // LSP is 0-based, Monaco is 1-based
        column: lspPos.character + 1,
    };
}
/**
 * Convert Monaco Range to LSP Range
 */
function monacoToLspRange(monacoRange) {
    return {
        start: {
            line: monacoRange.startLineNumber - 1,
            character: monacoRange.startColumn - 1,
        },
        end: {
            line: monacoRange.endLineNumber - 1,
            character: monacoRange.endColumn - 1,
        },
    };
}
/**
 * Create a Monaco-compatible text model from LSP TextDocument
 */
function createMonacoTextModel(document) {
    const lines = document.getText().split(/\r?\n/);
    const languageId = document.languageId;
    // Create a minimal tokenization mock for emmet validation
    // The abbreviationActions.ts code checks for tokenization support
    // We'll provide a simple mock that allows Emmet everywhere in HTML
    // For HTML, we need tokens with type '' or 'delimiter.html' to allow Emmet
    const tokenizationSupport = {
        getInitialState: () => ({ lineNumber: 0 }),
        tokenize: (line, hasEOL, state) => {
            // Return tokens that indicate we're in a valid HTML context
            // For HTML syntax, empty token type '' allows Emmet
            const tokens = [{
                    offset: 0,
                    type: '', // Empty type allows Emmet in HTML
                    language: languageId,
                }];
            return { tokens, endState: state };
        },
        tokenizeEncoded: () => ({ tokens: new Uint32Array(0), endState: { lineNumber: 0 } }),
    };
    // Create state object with clone method
    const createState = (lineNumber) => ({
        lineNumber,
        clone: function () {
            return createState(this.lineNumber);
        },
    });
    const stateStore = {
        getBeginState: (lineNumber) => createState(lineNumber - 1),
        getEndState: (lineNumber) => createState(lineNumber),
        getFirstInvalidEndStateLineNumber: () => null,
        _invalidLineStartIndex: 0,
    };
    return {
        getLineContent(lineNumber) {
            return lines[lineNumber - 1] || '';
        },
        getLineCount() {
            return lines.length;
        },
        getValueInRange(range) {
            const startLine = range.startLineNumber - 1;
            const endLine = range.endLineNumber - 1;
            const startCol = range.startColumn - 1;
            const endCol = range.endColumn - 1;
            if (startLine === endLine) {
                return lines[startLine]?.substring(startCol, endCol) || '';
            }
            const result = [];
            for (let i = startLine; i <= endLine; i++) {
                if (i === startLine) {
                    result.push(lines[i]?.substring(startCol) || '');
                }
                else if (i === endLine) {
                    result.push(lines[i]?.substring(0, endCol) || '');
                }
                else {
                    result.push(lines[i] || '');
                }
            }
            return result.join('\n');
        },
        getLanguageId() {
            return languageId;
        },
        get _languageId() {
            return languageId;
        },
        // Provide tokenization mock for emmet validation
        _tokenization: {
            _tokenizationStateStore: stateStore,
            _tokenizationSupport: tokenizationSupport,
        },
    };
}
/**
 * Convert Monaco CompletionItem to LSP CompletionItem
 */
function monacoToLspCompletionItem(monacoItem) {
    const item = {
        label: monacoItem.label,
        kind: vscode_languageserver_types_1.CompletionItemKind.Property,
        detail: monacoItem.detail,
        insertTextFormat: monacoItem.insertTextRules === 4
            ? vscode_languageserver_types_1.InsertTextFormat.Snippet
            : vscode_languageserver_types_1.InsertTextFormat.PlainText,
    };
    if (typeof monacoItem.documentation === 'string' && monacoItem.documentation.length) {
        const documentation = monacoItem.documentation.replace(/\s+$/g, '');
        item.documentation = {
            kind: vscode_languageserver_types_1.MarkupKind.Markdown,
            value: ['```', documentation, '```'].join('\n'),
        };
    }
    else if (monacoItem.documentation) {
        item.documentation = monacoItem.documentation;
    }
    // Handle text edits
    if (monacoItem.range) {
        const range = monacoToLspRange(monacoItem.range);
        item.textEdit = {
            range,
            newText: monacoItem.insertText || monacoItem.label,
        };
    }
    else {
        item.insertText = monacoItem.insertText || monacoItem.label;
    }
    return item;
}
/**
 * Check if position is inside <style> or <script> tags
 */
function isInsideStyleOrScriptTag(document, position) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    // Find the nearest opening tag before the cursor
    const beforeText = text.substring(0, offset);
    // Look for <style or <script tags before cursor
    const styleOpenMatch = beforeText.lastIndexOf('<style');
    const scriptOpenMatch = beforeText.lastIndexOf('<script');
    if (styleOpenMatch === -1 && scriptOpenMatch === -1) {
        return false;
    }
    const lastOpenTag = Math.max(styleOpenMatch, scriptOpenMatch);
    const tagType = styleOpenMatch > scriptOpenMatch ? 'style' : 'script';
    // Check if there's a closing tag after the opening tag
    const afterOpenTag = text.substring(lastOpenTag);
    const closeTagMatch = afterOpenTag.match(new RegExp(`</${tagType}>`));
    if (!closeTagMatch) {
        // No closing tag yet, we're inside
        return true;
    }
    const closeTagPosition = lastOpenTag + closeTagMatch.index;
    // Check if cursor is between opening and closing tag
    return offset > lastOpenTag && offset < closeTagPosition;
}
/**
 * Get Emmet completions for LSP
 */
function getEmmetCompletions(document, position, syntax, emmetConfig) {
    try {
        // Don't provide Emmet completions inside <style> or <script> tags
        if (isInsideStyleOrScriptTag(document, position)) {
            return null;
        }
        const monaco = createMonacoMock();
        const model = createMonacoTextModel(document);
        const monacoPos = lspToMonacoPosition(position);
        // Check if this is a valid location for emmet
        const language = document.languageId;
        if (!(0, abbreviationActions_1.isValidLocationForEmmetAbbreviation)(model, monacoPos, syntax, language)) {
            return null;
        }
        // Get completions from emmet
        const config = emmetConfig || {
            showExpandedAbbreviation: 'always',
            showAbbreviationSuggestions: true,
            showSuggestionsAsSnippets: false,
        };
        const monacoCompletions = (0, emmetHelper_1.doComplete)(monaco, model, monacoPos, syntax, config);
        if (!monacoCompletions || !monacoCompletions.suggestions) {
            return null;
        }
        // Convert Monaco completions to LSP completions
        const items = monacoCompletions.suggestions.map((item) => monacoToLspCompletionItem(item));
        return {
            isIncomplete: false,
            items,
        };
    }
    catch (error) {
        console.error('Error getting emmet completions:', error);
        return null;
    }
}
