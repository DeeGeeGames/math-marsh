import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

// The existing authorized S3 archive contains redistributables only. Pin both
// the archive and the desktop files to SDK 1.64, independent of its mutable key.
export const STEAM_SDK_ARCHIVE_SHA256 = '729b1c13b40c838426a3e490da52a6c5f4faba281f40899c1f6f5dcd58cbb2b6';
const redistributables = [
	['linux64/libsteam_api.so', 'ec4797f76a206eb0af627af0f0788eb5a2eabf5dee38ee0a6affbaa44a645f4e'],
	['win64/steam_api64.dll', 'eb17909a76668cf9ae0b92a618a34a50f6c73d3a6787cb4dd8ce36a8b10bfb75'],
] as const;
const sha256 = function (bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
};

export const prepareSteamSdk = async function (archive: string, destination = resolve(import.meta.dir, '..')): Promise<void> {
	if (sha256(await readFile(archive)) !== STEAM_SDK_ARCHIVE_SHA256) {
		throw new Error('Steamworks SDK archive checksum mismatch; expected the approved SDK 1.64 redistributables archive.');
	}
	for (const [file, expected] of redistributables) {
		const member = `steamworks_sdk/redistributable_bin/${file}`;
		// Git for Windows' GNU tar treats a drive-letter path as a remote host.
		// A basename in the archive directory works with both GNU and BSD tar.
		const extraction = Bun.spawn(['tar', '-xOf', basename(archive), member], {
			cwd: dirname(resolve(archive)), stdout: 'pipe', stderr: 'pipe',
		});
		const [bytes, errors, exitCode] = await Promise.all([
			new Response(extraction.stdout).arrayBuffer(), new Response(extraction.stderr).text(), extraction.exited,
		]);
		const data = new Uint8Array(bytes);
		if (exitCode !== 0 || sha256(data) !== expected) throw new Error(`Invalid SDK redistributable ${file}: ${errors}`);
		const target = resolve(destination, member);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, data);
	}
};

if (import.meta.main) {
	const archive = process.argv[2];
	if (!archive) throw new Error('Usage: bun scripts/prepare-steam-sdk.ts <approved steamworks_sdk.tar.gz>');
	await prepareSteamSdk(archive);
}
