import { createProjectService, ProjectService } from './projectService';
import { createProject, initProject, Project } from './project';
import type { LanguageService, LanguageServiceHost, UserPreferences } from 'typescript/lib/tsserverlibrary';
import { ProjectOptions } from '../types';

// only create the once for all hosts, as this will improve performance as the internal cache can be reused
let projectServiceSingleton: ProjectService | undefined;
const projects = new Set<Project>()

export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: import('typescript/lib/tsserverlibrary').System,
	host: LanguageServiceHost,
	createLanguageService: (host: LanguageServiceHost) => LanguageService,
	options: ProjectOptions | undefined,
	_createProject: typeof createProject = createProject,
) {
	const hostConfiguration = { preferences: { includePackageJsonAutoImports: 'auto' } as UserPreferences };

	let projectService = options?.projectService as ProjectService;

	if (!projectService) {
		if (!projectServiceSingleton) {
			projectServiceSingleton = createProjectService(
				ts,
				sys,
				host.getCurrentDirectory(),
				hostConfiguration,
				ts.LanguageServiceMode.Semantic,
				{}
			);
		}

		projectService = projectServiceSingleton;
	}

	const project = _createProject(
		ts,
		host,
		createLanguageService,
		{
			projectService: projectService,
			currentDirectory: host.getCurrentDirectory(),
			compilerOptions: host.getCompilationSettings(),
		}
	);

	projectService.projects.add(project);

	const proxyMethods: (keyof Project)[] = [
		'getCachedExportInfoMap',
		'getModuleSpecifierCache',
		'getGlobalTypingsCacheLocation',
		'getSymlinkCache',
		'getPackageJsonsVisibleToFile',
		'getPackageJsonAutoImportProvider',
		'includePackageJsonAutoImports',
		'useSourceOfProjectReferenceRedirect'
	]
	proxyMethods.forEach(key => (host as any)[key] = project[key].bind(project))
	initProject(project, host, createLanguageService)
	projects.add(project)

	return {
		languageService: project.languageService!,
		setPreferences(newPreferences: UserPreferences) {
			let onAutoImportProviderSettingsChanged = newPreferences.includePackageJsonAutoImports !== hostConfiguration.preferences.includePackageJsonAutoImports;
			hostConfiguration.preferences = newPreferences;
			if (onAutoImportProviderSettingsChanged) {
				project.onAutoImportProviderSettingsChanged();
			}
		},
		projectUpdated(path: string) {
			projects.forEach(projectToUpdate => {
				if (project === projectToUpdate || !projectToUpdate.autoImportProviderHost) return

				const realPaths = [...projectToUpdate.symlinks?.getSymlinkedDirectoriesByRealpath()?.keys() ?? []]
					.map(name => projectToUpdate.projectService.getNormalizedAbsolutePath(name));

				if (realPaths.includes(projectToUpdate.projectService.toCanonicalFileName(path))) {
					projectToUpdate.autoImportProviderHost.markAsDirty();
				}
			})
		},

		dispose() {
			projects.delete(project)
			projectService.projects.delete(project)
		}
	};
}

export { createProjectService }