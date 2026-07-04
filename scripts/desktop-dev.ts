import { spawn, type Subprocess } from 'bun';
import { delimiter, join } from 'node:path';

const port = Bun.env.MATH_MARSH_DEV_PORT ?? '3000';
const devServerUrl = `http://localhost:${port}`;
const localBinPath = join(process.cwd(), 'node_modules/.bin');
const path = `${localBinPath}${delimiter}${Bun.env.PATH ?? ''}`;

function killProcess(process: Subprocess): void {
	process.kill();
}

const renderer = spawn({
	cmd: ['bun', '--port', port, '--console', 'index.html'],
	stdout: 'inherit',
	stderr: 'inherit',
});

const desktop = spawn({
	cmd: ['electron', 'electron/main.cjs'],
	env: {
		...Bun.env,
		MATH_MARSH_DEV_SERVER_URL: devServerUrl,
		PATH: path,
	},
	stdout: 'inherit',
	stderr: 'inherit',
});

const stopProcesses = (): void => {
	[desktop, renderer].forEach(killProcess);
};

process.on('SIGINT', () => {
	stopProcesses();
	process.exit(130);
});

process.on('SIGTERM', () => {
	stopProcesses();
	process.exit(143);
});

const exitCodes = await Promise.all([desktop.exited, renderer.exited]);
stopProcesses();
process.exit(exitCodes.find(code => code !== 0) ?? 0);
