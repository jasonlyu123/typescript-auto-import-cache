import * as semver from 'semver';
import type * as ts from 'typescript/lib/tsserverlibrary';
import _40 from './4_0';
import _44 from './4_4';
import _47 from './4_7';
import * as _50 from './5_0';
import _53 from './5_3';
import * as types from './types';

export { PackageJsonAutoImportPreference } from './5_0/projectService';

export function createLanguageService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: ts.System,
	host: ts.LanguageServiceHost,
	createLanguageService: (host: ts.LanguageServiceHost) => ts.LanguageService,
	options?: types.ProjectOptions,
): types.ProjectContainer {
	if (semver.gte(ts.version, '5.3.0')) {
		return _53(ts, sys, host, createLanguageService, options);
	}
	else if (semver.gte(ts.version, '5.0.0')) {
		return _50.default(ts, sys, host, createLanguageService, options);
	}
	else if (semver.gte(ts.version, '4.7.0')) {
		const service = createLanguageService(host);
		_47(ts, host, service);
		return { languageService: service };
	}
	else if (semver.gte(ts.version, '4.4.0')) {
		const service = createLanguageService(host);
		_44(ts, host, service);
		return { languageService: service };
	}
	else if (semver.gte(ts.version, '4.0.0')) {
		const service = createLanguageService(host);
		_40(ts, host, service);
		return { languageService: service };
	}
	return { languageService: createLanguageService(host) };
}

export function createProjectService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	sys: ts.System,
	currentDirectory: string,
	hostConfiguration: { preferences: ts.UserPreferences; },
	serverMode: ts.LanguageServiceMode,
	options?: types.ProjectServiceOptions,
): unknown {
	if (semver.gte(ts.version, '5.0')) {
		return _50.createProjectService(ts, sys, currentDirectory, hostConfiguration, serverMode, options);
	}
}