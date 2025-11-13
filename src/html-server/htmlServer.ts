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

  // Get HTML completions
  const htmlCompletions = htmlLanguageService.doComplete(
    document,
    position,
    htmlDocument
  );

  // Get Emmet completions
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

// Note: findDefinition and findReferences are not available in vscode-html-languageservice
// These features are typically not needed for HTML

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
