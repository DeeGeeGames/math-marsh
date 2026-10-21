import { rename, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Steam's Windows launch option is exactly "game.exe". The installer and zip
// keep the product executable name; only the unpacked depot directory is renamed.
export const STEAM_WINDOWS_EXECUTABLE = 'game.exe';

const isMissingFile = function(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
};

const fileExists = async function(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if (isMissingFile(error)) return false;
		throw error;
	}
};

export const packagedWindowsExecutableName = function(executableName: string): string {
	if (executableName.length === 0 || /[\\/]/.test(executableName)) {
		throw new Error('Windows executable name must be a non-empty file name');
	}
	return executableName.toLowerCase().endsWith('.exe') ? executableName : `${executableName}.exe`;
};

export const renamePackagedExecutableForSteam = async function(
	unpackedDir: string,
	executableName: string,
): Promise<void> {
	const packagedName = packagedWindowsExecutableName(executableName);
	const source = join(unpackedDir, packagedName);
	const target = join(unpackedDir, STEAM_WINDOWS_EXECUTABLE);
	if (packagedName === STEAM_WINDOWS_EXECUTABLE) {
		if (!(await fileExists(target))) throw new Error(`Steam Windows build is missing ${target}`);
		return;
	}
	if (!(await fileExists(source))) {
		throw new Error(`Steam Windows build is missing ${source}`);
	}
	if (await fileExists(target)) {
		throw new Error(`${target} already exists`);
	}
	await rename(source, target);
};

const executableNameFromPackage = function(value: unknown): string {
	if (typeof value !== 'object' || value === null || !('build' in value)) {
		throw new Error('package.json is missing build.executableName');
	}
	const build = value.build;
	if (typeof build !== 'object' || build === null || !('executableName' in build)) {
		throw new Error('package.json is missing build.executableName');
	}
	const executableName = build.executableName;
	if (typeof executableName !== 'string' || executableName.length === 0) {
		throw new Error('package.json build.executableName must be a non-empty string');
	}
	return executableName;
};

if (import.meta.main) {
	const packageJson: unknown = await Bun.file(resolve(import.meta.dir, '../package.json')).json();
	await renamePackagedExecutableForSteam(
		resolve(import.meta.dir, '../desktop-dist/win-unpacked'),
		executableNameFromPackage(packageJson),
	);
}
