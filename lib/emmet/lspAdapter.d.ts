import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position, CompletionList } from 'vscode-languageserver-types';
import { type VSCodeEmmetConfig } from './emmetHelper';
/**
 * Get Emmet completions for LSP
 */
export declare function getEmmetCompletions(document: TextDocument, position: Position, syntax: string, emmetConfig?: VSCodeEmmetConfig): CompletionList | null;
export { VSCodeEmmetConfig };
