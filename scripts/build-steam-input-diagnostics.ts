import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { $ } from 'bun';

const root = resolve(import.meta.dir, '..');
const out = resolve(root, 'dist-steam-input');
await mkdir(out, { recursive: true });
for (const name of ['main', 'preload'] as const) {
	const result = await Bun.build({
		entrypoints: [resolve(import.meta.dir, `steam-input-diagnostics/${name}.ts`)],
		outdir: out, naming: `${name}.cjs`, target: 'node', format: 'cjs',
		external: ['electron', 'steamworks-ffi-node'],
	});
	if (!result.success) throw new AggregateError(result.logs, `Diagnostic ${name} build failed`);
}
const browser = await Bun.build({
	entrypoints: [resolve(import.meta.dir, 'steam-input-diagnostics/ui.ts')],
	outdir: out, naming: 'ui.js', target: 'browser',
});
if (!browser.success) throw new AggregateError(browser.logs, 'Diagnostic UI build failed');
await copyFile(resolve(import.meta.dir, 'steam-input-diagnostics/index.html'), resolve(out, 'index.html'));
for (const name of ['game_actions.vdf', 'gamepad_default.vdf']) {
	await copyFile(resolve(root, 'steam/input-test', name), resolve(out, name));
}
const commit = (await $`git rev-parse HEAD`.quiet().text()).trim();
await writeFile(resolve(out, 'build-id.txt'), Bun.env.GITHUB_SHA ?? commit);
