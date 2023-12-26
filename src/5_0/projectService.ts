import type { Path, System, server, LanguageServiceMode, UserPreferences, FileWatcher } from 'typescript/lib/tsserverlibrary';
import { createPackageJsonCache, PackageJsonCache, Ternary, ProjectPackageJsonInfo } from './packageJsonCache';
import { Project, ProjectServiceOptions } from '../types';

export type ProjectService = ReturnType<typeof createProjectService>;

type NormalizedPath = server.NormalizedPath;

export const enum PackageJsonAutoImportPreference {
	Off,
	On,
	Auto,
}

const noopWatcher = {
	close() {}
}
const returnNoopWatcher = () => noopWatcher

export function createProjectService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: System,
	currentDirectory: string,
	hostConfiguration: { preferences: UserPreferences; },
	serverMode: LanguageServiceMode,
	options?: ProjectServiceOptions,
) {
	const {
		toPath,
		getNormalizedAbsolutePath,
		normalizePath: toNormalizedPath,
		createGetCanonicalFileName,
		forEachAncestorDirectory,
		getDirectoryPath,
		combinePaths
	} = ts as any;

	const watchFactory = options?.watchFactory ?? {
		watchFile: returnNoopWatcher,
		watchDirectory: returnNoopWatcher
	}

	const projectService = {
		serverMode,
		host: sys,
		currentDirectory: toNormalizedPath(currentDirectory),
		toCanonicalFileName: createGetCanonicalFileName(sys.useCaseSensitiveFileNames),
		toPath(fileName: string): Path {
			return toPath(fileName, this.currentDirectory, this.toCanonicalFileName);
		},

		getExecutingFilePath() {
			return this.getNormalizedAbsolutePath(this.host.getExecutingFilePath());
		},

		getNormalizedAbsolutePath(fileName: string) {
			return getNormalizedAbsolutePath(fileName, this.host.getCurrentDirectory());
		},

		packageJsonCache: undefined as unknown as PackageJsonCache,
		packageJsonFilesMap: undefined as unknown as Map<Path, FileWatcher>,

		getPackageJsonsVisibleToFile(fileName: string, rootDir?: string): readonly ProjectPackageJsonInfo[] {
			const packageJsonCache = this.packageJsonCache;
			const rootPath = rootDir && this.toPath(rootDir);
			const filePath = this.toPath(fileName);
			const result: ProjectPackageJsonInfo[] = [];
			const processDirectory = (directory: Path): boolean | undefined => {
				switch (packageJsonCache.directoryHasPackageJson(directory)) {
					// Sync and check same directory again
					case Ternary.Maybe:
						packageJsonCache.searchDirectoryAndAncestors(directory);
						return processDirectory(directory);
					// Check package.json
					case Ternary.True:
						const packageJsonFileName = combinePaths(directory, "package.json");
						this.watchPackageJsonFile(packageJsonFileName as Path);
						const info = packageJsonCache.getInDirectory(directory);
						if (info) result.push(info as any);
				}
				if (rootPath && rootPath === directory) {
					return true;
				}
			};

			forEachAncestorDirectory(getDirectoryPath(filePath), processDirectory);
			return result;
		},

		includePackageJsonAutoImports(): PackageJsonAutoImportPreference {
			switch (hostConfiguration.preferences.includePackageJsonAutoImports) {
				case 'on': return PackageJsonAutoImportPreference.On;
				case 'off': return PackageJsonAutoImportPreference.Off;
				default: return PackageJsonAutoImportPreference.Auto;
			}
		},

		fileExists(fileName: NormalizedPath): boolean {
			return this.host.fileExists(fileName);
		},

		watchPackageJsonFile(path: Path) {
			const watchers = this.packageJsonFilesMap || (this.packageJsonFilesMap = new Map());
			if (!watchers.has(path)) {
				this.invalidateProjectPackageJson(path);
				watchers.set(
					path,
					watchFactory.watchFile(
						path,
						(fileName, eventKind) => {
							const path = this.toPath(fileName);
							switch (eventKind) {
								case ts.FileWatcherEventKind.Created:
									throw new Error('Expected package.json to exist already');
								case ts.FileWatcherEventKind.Changed:
									this.packageJsonCache.addOrUpdate(path);
									this.invalidateProjectPackageJson(path);
									break;
								case  ts.FileWatcherEventKind.Deleted:
									this.packageJsonCache.delete(path);
									this.invalidateProjectPackageJson(path);
									watchers.get(path)?.close();
									watchers.delete(path);
							}
						},
						/*PollingInterval.Low*/ 250,
						undefined
					),
				);
			}
		},

		invalidateProjectPackageJson(packageJsonPath: Path) {
			this.projects.forEach(project => {
				if (packageJsonPath) {
					project.onPackageJsonChange(packageJsonPath);
				}
				else {
					project.onAutoImportProviderSettingsChanged();
				}
			})
		},

		projects: new Set<Project>(),
	};

	projectService.packageJsonCache = createPackageJsonCache(ts, projectService);
	return projectService;
}
