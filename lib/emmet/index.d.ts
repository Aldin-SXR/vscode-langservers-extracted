import type * as Monaco from 'monaco-editor';
declare global {
    interface Window {
        monaco?: typeof Monaco;
    }
}
export declare function emmetHTML(monaco?: any, languages?: string[]): () => void;
export declare function emmetCSS(monaco?: any, languages?: string[]): () => void;
export declare function emmetJSX(monaco?: any, languages?: string[]): () => void;
export { expandAbbreviation, registerCustomSnippets } from './emmetHelper';
