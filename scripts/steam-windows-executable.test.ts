import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	packagedWindowsExecutableName,
	renamePackagedExecutableForSteam,
	STEAM_WINDOWS_EXECUTABLE,
} from './steam-windows-executable';

const unpackedDir = async function(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'math-marsh-steam-'));
};

describe('Steam Windows executable', () => {
	test('renames the packaged executable to game.exe and leaves other files', async () => {
		const dir = await unpackedDir();
		try {
			await writeFile(join(dir, 'math-marsh.exe'), 'executable');
			await writeFile(join(dir, 'launch-notes.txt'), 'keep');
			await renamePackagedExecutableForSteam(dir, 'math-marsh');
			expect(await Bun.file(join(dir, STEAM_WINDOWS_EXECUTABLE)).text()).toBe('executable');
			await expect(stat(join(dir, 'math-marsh.exe'))).rejects.toMatchObject({ code: 'ENOENT' });
			expect(await Bun.file(join(dir, 'launch-notes.txt')).text()).toBe('keep');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('rejects a missing packaged executable and an existing game.exe', async () => {
		const dir = await unpackedDir();
		try {
			await expect(renamePackagedExecutableForSteam(dir, 'math-marsh')).rejects.toThrow(/missing/);
			await writeFile(join(dir, 'math-marsh.exe'), 'executable');
			await writeFile(join(dir, STEAM_WINDOWS_EXECUTABLE), 'already');
			await expect(renamePackagedExecutableForSteam(dir, 'math-marsh')).rejects.toThrow(/already exists/);
			expect(await Bun.file(join(dir, 'math-marsh.exe')).text()).toBe('executable');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test('accepts an executable name that is already game.exe', async () => {
		const dir = await unpackedDir();
		try {
			await writeFile(join(dir, STEAM_WINDOWS_EXECUTABLE), 'executable');
			await renamePackagedExecutableForSteam(dir, 'game.exe');
			expect(packagedWindowsExecutableName('game')).toBe('game.exe');
			expect(await Bun.file(join(dir, STEAM_WINDOWS_EXECUTABLE)).text()).toBe('executable');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
