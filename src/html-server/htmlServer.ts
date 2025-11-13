/*---------------------------------------------------------------------------------------------
 *  HTML Language Server with Emmet Integration
 *  Based on vscode-html-languageservice with emmet-monaco-es integration
 *--------------------------------------------------------------------------------------------*/

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as htmlService from 'vscode-html-languageservice';
import { getEmmetCompletions, VSCodeEmmetConfig } from '../emmet/lspAdapter';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a document manager
const documents = new TextDocuments(TextDocument);

// Create HTML language service
const htmlLanguageService = htmlService.getLanguageService();

// Emmet configuration
const emmetConfig: VSCodeEmmetConfig = {
  showExpandedAbbreviation: 'always',
  showAbbreviationSuggestions: true,
  showSuggestionsAsSnippets: false,
};

/**
 * Helper: check if the position is inside the content of a <script> or <style> tag.
 * We only want Emmet in "pure" HTML, not in embedded CSS/JS.
 */
function isInsideScriptOrStyle(
  document: TextDocument,
  position: { line: number; character: number },
  htmlDocument: htmlService.HTMLDocument
): boolean {
  const offset = document.offsetAt(position);
  const node = htmlDocument.findNodeAt(offset);
  if (!node || !node.tag) {
    return false;
  }

  if (node.startTagEnd === undefined || node.endTagStart === undefined) {
    return false;
  }

  const isContent =
    offset >= node.startTagEnd && offset <= node.endTagStart;

  if (!isContent) {
    return false;
  }

  const tag = node.tag.toLowerCase();
  return tag === 'script' || tag === 'style';
}

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
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
  const htmlCompletions = htmlLanguageService.doComplete(
    document,
    position,
    htmlDocument
  );

  // If we are inside <script> or <style>, do NOT trigger Emmet.
  // Let the built-in embedded language logic handle CSS/JS instead.
  if (isInsideScriptOrStyle(document, position, htmlDocument)) {
    return htmlCompletions;
  }

  // Get Emmet completions for pure HTML context
  const emmetCompletions = getEmmetCompletions(
    document,
    position,
    'html',
    emmetConfig
  );

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
  return htmlLanguageService.doHover(
    document,
    textDocumentPosition.position,
    htmlDocument
  );
});

// Handle document highlight requests
connection.onDocumentHighlight((textDocumentPosition) => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  if (!document) {
    return null;
  }

  const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
  return htmlLanguageService.findDocumentHighlights(
    document,
    textDocumentPosition.position,
    htmlDocument
  );
});

// Handle document links
connection.onDocumentLinks((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const documentContext = {
    resolveReference: (ref: string) => ref,
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
  return htmlLanguageService.doRename(
    document,
    params.position,
    params.newName,
    htmlDocument
  );
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
