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
import {
  getCSSLanguageService,
  LanguageService as CSSLanguageService,
} from 'vscode-css-languageservice';
import { getEmmetCompletions, VSCodeEmmetConfig } from '../emmet/lspAdapter';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a document manager
const documents = new TextDocuments(TextDocument);

// Create HTML language service
const htmlLanguageService = htmlService.getLanguageService();

// Create CSS language service for <style> regions
const cssLanguageService: CSSLanguageService = getCSSLanguageService();

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

  const position = textDocumentPosition.position;
  const htmlDocument = htmlLanguageService.parseHTMLDocument(document);
  const offset = document.offsetAt(position);
  const node = htmlDocument.findNodeAt(offset);

  // Helper: are we inside the content between <tag>...</tag> ?
  const isInsideNodeContent =
    node &&
    typeof node.startTagEnd === 'number' &&
    typeof node.endTagStart === 'number' &&
    offset >= node.startTagEnd &&
    offset <= node.endTagStart;

  const tag = node?.tag?.toLowerCase();

  // --- CSS inside <style> ---
  if (tag === 'style' && isInsideNodeContent) {
    // Extract only the CSS text between <style> and </style>
    const cssText = document
      .getText()
      .substring(node!.startTagEnd!, node!.endTagStart!);

    // Create a virtual CSS document
    const cssDocument = TextDocument.create(
      document.uri + '.css',
      'css',
      document.version,
      cssText
    );

    // Map current offset into the CSS snippet
    const cssOffset = offset - node!.startTagEnd!;
    const cssPosition = cssDocument.positionAt(cssOffset);

    const stylesheet = cssLanguageService.parseStylesheet(cssDocument);
    return cssLanguageService.doComplete(cssDocument, cssPosition, stylesheet);
  }

  // --- JavaScript inside <script> ---
  if (tag === 'script' && isInsideNodeContent) {
    // Do NOT provide completions here – let your JS/TS tooling handle it
    // (e.g., Monaco's built-in JS language service).
    return null;
  }

  // --- Pure HTML region: HTML completions + Emmet ---
  const htmlCompletions = htmlLanguageService.doComplete(
    document,
    position,
    htmlDocument
  );

  // Only run Emmet in HTML (not in <style>/<script>)
  const emmetCompletions = getEmmetCompletions(
    document,
    position,
    'html',
    emmetConfig
  );

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
