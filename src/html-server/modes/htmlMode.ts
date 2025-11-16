/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLanguageModelCache } from '../languageModelCache';
import {
	LanguageService as HTMLLanguageService, HTMLDocument, DocumentContext, FormattingOptions,
	HTMLFormatConfiguration, SelectionRange,
	TextDocument, Position, Range, FoldingRange,
	LanguageMode, Workspace, Settings, ColorInformation, ColorPresentation, Color, TokenType
} from './languageModes';
import { LanguageService as CSSLanguageService } from 'vscode-css-languageservice';
import { getEmmetCompletions, VSCodeEmmetConfig } from '../../emmet/lspAdapter';

export function getHTMLMode(htmlLanguageService: HTMLLanguageService, workspace: Workspace, cssLanguageService?: CSSLanguageService): LanguageMode {
	const htmlDocuments = getLanguageModelCache<HTMLDocument>(10, 60, document => htmlLanguageService.parseHTMLDocument(document));
	return {
		getId() {
			return 'html';
		},
		async getSelectionRange(document: TextDocument, position: Position): Promise<SelectionRange> {
			return htmlLanguageService.getSelectionRanges(document, [position])[0];
		},
		async doComplete(document: TextDocument, position: Position, documentContext: DocumentContext, settings = workspace.settings) {
			const htmlSettings = settings?.html;
			const options = merge(htmlSettings?.suggest, {});
			options.hideAutoCompleteProposals = htmlSettings?.autoClosingTags === true;
			options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

			const htmlDocument = htmlDocuments.get(document);
			const completionList = await htmlLanguageService.doComplete2(document, position, htmlDocument, documentContext, options);

			// Add Emmet completions
			const emmetConfig: VSCodeEmmetConfig = {
				showExpandedAbbreviation: 'always',
				showAbbreviationSuggestions: true,
				showSuggestionsAsSnippets: false,
			};
			const emmetCompletions = getEmmetCompletions(document, position, 'html', emmetConfig);

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
		async doHover(document: TextDocument, position: Position, settings?: Settings) {
			return htmlLanguageService.doHover(document, position, htmlDocuments.get(document), settings?.html?.hover);
		},
		async findDocumentHighlight(document: TextDocument, position: Position) {
			return htmlLanguageService.findDocumentHighlights(document, position, htmlDocuments.get(document));
		},
		async findDocumentLinks(document: TextDocument, documentContext: DocumentContext) {
			return htmlLanguageService.findDocumentLinks(document, documentContext);
		},
		async findDocumentSymbols(document: TextDocument) {
			return htmlLanguageService.findDocumentSymbols(document, htmlDocuments.get(document));
		},
		async findDocumentColors(document: TextDocument) {
			if (!cssLanguageService) {
				return [];
			}
			return findHTMLDocumentColors(document, htmlLanguageService, cssLanguageService);
		},
		async getColorPresentations(document: TextDocument, color: Color, range: Range) {
			if (!cssLanguageService) {
				return [];
			}
			return getHTMLColorPresentations(document, color, range, cssLanguageService);
		},
		async format(document: TextDocument, range: Range, formatParams: FormattingOptions, settings = workspace.settings) {
			const formatSettings: HTMLFormatConfiguration = merge(settings?.html?.format, {});
			if (formatSettings.contentUnformatted) {
				formatSettings.contentUnformatted = formatSettings.contentUnformatted + ',script';
			} else {
				formatSettings.contentUnformatted = 'script';
			}
			merge(formatParams, formatSettings);
			return htmlLanguageService.format(document, range, formatSettings);
		},
		async getFoldingRanges(document: TextDocument): Promise<FoldingRange[]> {
			return htmlLanguageService.getFoldingRanges(document);
		},
		async doAutoInsert(document: TextDocument, position: Position, kind: 'autoQuote' | 'autoClose', settings = workspace.settings) {
			const offset = document.offsetAt(position);
			const text = document.getText();
			if (kind === 'autoQuote') {
				if (offset > 0 && text.charAt(offset - 1) === '=') {
					const htmlSettings = settings?.html;
					const options = merge(htmlSettings?.suggest, {});
					options.attributeDefaultValue = htmlSettings?.completion?.attributeDefaultValue ?? 'doublequotes';

					return htmlLanguageService.doQuoteComplete(document, position, htmlDocuments.get(document), options);
				}
			} else if (kind === 'autoClose') {
				if (offset > 0 && text.charAt(offset - 1).match(/[>\/]/g)) {
					return htmlLanguageService.doTagComplete(document, position, htmlDocuments.get(document));
				}
			}
			return null;
		},
		async doRename(document: TextDocument, position: Position, newName: string) {
			const htmlDocument = htmlDocuments.get(document);
			return htmlLanguageService.doRename(document, position, newName, htmlDocument);
		},
		async onDocumentRemoved(document: TextDocument) {
			htmlDocuments.onDocumentRemoved(document);
		},
		async findMatchingTagPosition(document: TextDocument, position: Position) {
			const htmlDocument = htmlDocuments.get(document);
			return htmlLanguageService.findMatchingTagPosition(document, position, htmlDocument);
		},
		async doLinkedEditing(document: TextDocument, position: Position) {
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

function findHTMLDocumentColors(document: TextDocument, htmlLanguageService: HTMLLanguageService, cssLanguageService: CSSLanguageService): ColorInformation[] {
	const scanner = htmlLanguageService.createScanner(document.getText());
	const colors: ColorInformation[] = [];
	let token = scanner.scan();
	let currentAttributeName: string | null = null;

	while (token !== TokenType.EOS) {
		switch (token) {
			case TokenType.AttributeName:
				currentAttributeName = scanner.getTokenText().toLowerCase();
				break;
			case TokenType.AttributeValue: {
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

function getHTMLColorPresentations(document: TextDocument, color: Color, range: Range, cssLanguageService: CSSLanguageService): ColorPresentation[] {
	const attributeColorValue = document.getText(range);
	const prefix = '* { color: ';
	const cssDocument = TextDocument.create('color://html-attribute.css', 'css', 0, `${prefix}${attributeColorValue}; }`);
	const stylesheet = cssLanguageService.parseStylesheet(cssDocument);
	const colorRange = Range.create(Position.create(0, prefix.length), Position.create(0, prefix.length + attributeColorValue.length));
	return cssLanguageService.getColorPresentations(cssDocument, stylesheet, color, colorRange);
}

function getUnquotedAttributeValue(document: TextDocument, scanner: ReturnType<HTMLLanguageService['createScanner']>): { value: string; range: Range } | null {
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

	const range = Range.create(document.positionAt(start), document.positionAt(end));
	return { value: text.substring(start, end), range };
}

function parseCSSColor(value: string, cssLanguageService: CSSLanguageService): Color | null {
	const cssDocument = TextDocument.create('color://html-attribute.css', 'css', 0, `* { color: ${value}; }`);
	const stylesheet = cssLanguageService.parseStylesheet(cssDocument);
	const colors = cssLanguageService.findDocumentColors(cssDocument, stylesheet);
	return colors.length ? colors[0].color : null;
}

function isColorAttribute(attributeName: string): boolean {
	return colorAttributes.has(attributeName) || attributeName.endsWith('color');
}

function merge(src: any, dst: any): any {
	if (src) {
		for (const key in src) {
			if (src.hasOwnProperty(key)) {
				dst[key] = src[key];
			}
		}
	}
	return dst;
}
