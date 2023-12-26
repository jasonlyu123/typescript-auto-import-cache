import type * as ts from 'typescript/lib/tsserverlibrary';

export interface ProjectContainer {
	languageService: ts.LanguageService;
	setPreferences?(preferences: ts.UserPreferences): void;
	projectUpdated?(updatedProjectDirectory: string): void;
	dispose?(): void;
}

export interface ProjectServiceOptions {
	watchFactory?: WatchFactory;
}

export interface ProjectOptions {
	projectService?: unknown;
}

export interface Project {
	onPackageJsonChange(path: ts.Path): void;
	onAutoImportProviderSettingsChanged(): void;
}

export interface WatchFactory {
	watchFile: (file: string, callback: ts.FileWatcherCallback, pollingInterval: number, options: ts.WatchOptions | undefined) => ts.FileWatcher;
	watchDirectory: (directory: string, callback: ts.DirectoryWatcherCallback, flags: ts.WatchDirectoryFlags, options: ts.WatchOptions | undefined) => ts.FileWatcher;
}
