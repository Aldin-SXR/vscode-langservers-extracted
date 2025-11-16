import { LanguageService as HTMLLanguageService, LanguageMode, Workspace } from './languageModes';
import { LanguageService as CSSLanguageService } from 'vscode-css-languageservice';
export declare function getHTMLMode(htmlLanguageService: HTMLLanguageService, workspace: Workspace, cssLanguageService?: CSSLanguageService): LanguageMode;
