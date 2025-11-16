"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHTMLMode = getHTMLMode;
const languageModelCache_1 = require("../languageModelCache");
const languageModes_1 = require("./languageModes");
const lspAdapter_1 = require("../../emmet/lspAdapter");
function getHTMLMode(htmlLanguageService, workspace, cssLanguageService) {
    const htmlDocuments = (0, languageModelCache_1.getLanguageModelCache)(10, 60, document => htmlLanguageService.parseHTMLDocument(document));
    return {
        getId() {
            return 'html';
        },
        async getSelectionRange(document, position) {
            return htmlLanguageService.getSelectionRanges(document, [position])[0];
        },
        async doComplete(document, position, documentContext, settings = workspace.settings) {
            const htmlSettings = settings?.html;
            const options = merge(htmlSettings?.suggest, {});
            options.hideAutoCompleteProposals = htmlSettings?.autoClosingTags === true;
            options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';
            const htmlDocument = htmlDocuments.get(document);
            const completionList = await htmlLanguageService.doComplete2(document, position, htmlDocument, documentContext, options);
            // Add Emmet completions
            const emmetConfig = {
                showExpandedAbbreviation: 'always',
                showAbbreviationSuggestions: true,
                showSuggestionsAsSnippets: false,
            };
            const emmetCompletions = (0, lspAdapter_1.getEmmetCompletions)(document, position, 'html', emmetConfig);
            if (emmetCompletions && emmetCompletions.items.length > 0) {
                // Add preselect and sort text to Emmet items
                emmetCompletions.items.forEach((item, index) => {
                    if (!item.sortText) {
                        item.sortText = `0_emmet_${index}`;
                    }
                    if (index === 0) {
                        item.preselect = true;
                    }
                });
                // Merge: Emmet first, then HTML
                const mergedItems = [
                    ...emmetCompletions.items,
                    ...(completionList?.items || []),
                ];
                return {
                    isIncomplete: true, // Trigger re-request as user types
                    items: mergedItems,
                };
            }
            return completionList;
        },
        async doHover(document, position, settings) {
            return htmlLanguageService.doHover(document, position, htmlDocuments.get(document), settings?.html?.hover);
        },
        async findDocumentHighlight(document, position) {
            return htmlLanguageService.findDocumentHighlights(document, position, htmlDocuments.get(document));
        },
        async findDocumentLinks(document, documentContext) {
            return htmlLanguageService.findDocumentLinks(document, documentContext);
        },
        async findDocumentSymbols(document) {
            return htmlLanguageService.findDocumentSymbols(document, htmlDocuments.get(document));
        },
        async findDocumentColors(document) {
            if (!cssLanguageService) {
                return [];
            }
            return findHTMLDocumentColors(document, htmlLanguageService, cssLanguageService);
        },
        async getColorPresentations(document, color, range) {
            if (!cssLanguageService) {
                return [];
            }
            return getHTMLColorPresentations(document, color, range, cssLanguageService);
        },
        async format(document, range, formatParams, settings = workspace.settings) {
            const formatSettings = merge(settings?.html?.format, {});
            if (formatSettings.contentUnformatted) {
                formatSettings.contentUnformatted = formatSettings.contentUnformatted + ',script';
            }
            else {
                formatSettings.contentUnformatted = 'script';
            }
            merge(formatParams, formatSettings);
            return htmlLanguageService.format(document, range, formatSettings);
        },
        async getFoldingRanges(document) {
            return htmlLanguageService.getFoldingRanges(document);
        },
        async doAutoInsert(document, position, kind, settings = workspace.settings) {
            const offset = document.offsetAt(position);
            const text = document.getText();
            if (kind === 'autoQuote') {
                if (offset > 0 && text.charAt(offset - 1) === '=') {
                    const htmlSettings = settings?.html;
                    const options = merge(htmlSettings?.suggest, {});
                    options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';
                    return htmlLanguageService.doQuoteComplete(document, position, htmlDocuments.get(document), options);
                }
            }
            else if (kind === 'autoClose') {
                if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
                    return htmlLanguageService.doTagComplete(document, position, htmlDocuments.get(document));
                }
            }
            return null;
        },
        async doRename(document, position, newName) {
            const htmlDocument = htmlDocuments.get(document);
            return htmlLanguageService.doRename(document, position, newName, htmlDocument);
        },
        async onDocumentRemoved(document) {
            htmlDocuments.onDocumentRemoved(document);
        },
        async findMatchingTagPosition(document, position) {
            const htmlDocument = htmlDocuments.get(document);
            return htmlLanguageService.findMatchingTagPosition(document, position, htmlDocument);
        },
        async doLinkedEditing(document, position) {
            const htmlDocument = htmlDocuments.get(document);
            return htmlLanguageService.findLinkedEditingRanges(document, position, htmlDocument);
        },
        dispose() {
            htmlDocuments.dispose();
        }
    };
}
const colorAttributes = new Set([
    'color',
    'bgcolor',
    'bordercolor',
    'alink',
    'link',
    'vlink',
    'text',
    'stroke',
    'fill',
    'stop-color',
    'flood-color',
    'lighting-color'
]);
function findHTMLDocumentColors(document, htmlLanguageService, cssLanguageService) {
    const scanner = htmlLanguageService.createScanner(document.getText());
    const colors = [];
    let token = scanner.scan();
    let currentAttributeName = null;
    while (token !== languageModes_1.TokenType.EOS) {
        switch (token) {
            case languageModes_1.TokenType.AttributeName:
                currentAttributeName = scanner.getTokenText().toLowerCase();
                break;
            case languageModes_1.TokenType.AttributeValue: {
                const attributeName = currentAttributeName;
                currentAttributeName = null;
                if (!attributeName || !isColorAttribute(attributeName)) {
                    break;
                }
                const value = getUnquotedAttributeValue(document, scanner);
                if (!value) {
                    break;
                }
                const color = parseCSSColor(value.value, cssLanguageService);
                if (color) {
                    colors.push({ color, range: value.range });
                }
                break;
            }
            default:
                break;
        }
        token = scanner.scan();
    }
    return colors;
}
function getHTMLColorPresentations(document, color, range, cssLanguageService) {
    const attributeColorValue = document.getText(range);
    const prefix = '* { color: ';
    const cssDocument = languageModes_1.TextDocument.create('color://html-attribute.css', 'css', 0, `${prefix}${attributeColorValue}; }`);
    const stylesheet = cssLanguageService.parseStylesheet(cssDocument);
    const colorRange = languageModes_1.Range.create(languageModes_1.Position.create(0, prefix.length), languageModes_1.Position.create(0, prefix.length + attributeColorValue.length));
    return cssLanguageService.getColorPresentations(cssDocument, stylesheet, color, colorRange);
}
function getUnquotedAttributeValue(document, scanner) {
    const text = document.getText();
    let start = scanner.getTokenOffset();
    let end = scanner.getTokenEnd();
    if (start >= end) {
        return null;
    }
    if (text[start] === '"' || text[start] === '\'') {
        start++;
        end--;
    }
    while (start < end && /\s/.test(text[start])) {
        start++;
    }
    while (end > start && /\s/.test(text[end - 1])) {
        end--;
    }
    if (start >= end) {
        return null;
    }
    const range = languageModes_1.Range.create(document.positionAt(start), document.positionAt(end));
    return { value: text.substring(start, end), range };
}
function parseCSSColor(value, cssLanguageService) {
    const cssDocument = languageModes_1.TextDocument.create('color://html-attribute.css', 'css', 0, `* { color: ${value}; }`);
    const stylesheet = cssLanguageService.parseStylesheet(cssDocument);
    const colors = cssLanguageService.findDocumentColors(cssDocument, stylesheet);
    return colors.length ? colors[0].color : null;
}
function isColorAttribute(attributeName) {
    return colorAttributes.has(attributeName) || attributeName.endsWith('color');
}
function merge(src, dst) {
    if (src) {
        for (const key in src) {
            if (src.hasOwnProperty(key)) {
                dst[key] = src[key];
            }
        }
    }
    return dst;
}
