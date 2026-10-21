import { app, BrowserWindow, clipboard, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SteamworksSDK, SteamInputType } from 'steamworks-ffi-node';
import { actions, type ActionSample, type DiagnosticReport } from './types';

const diagnosticRoot = join(app.getAppPath(), 'dist-steam-input');
const steam = SteamworksSDK.getInstance();
const report: DiagnosticReport = {
	build: 'development', platform: process.platform, node: process.versions.node,
	electron: process.versions.electron, library: '0.11.3', appId: 4927380,
	launchedBySteam: process.env.SteamAppId === '4927380',
	initialized: false, manifestAccepted: false, inputInitialized: false,
	actionSet: '0', actionHandles: { select: '0', back: '0', pause: '0', up: '0', down: '0', left: '0', right: '0' },
	sessionConfiguration: 0, controllers: [], seenControllers: [], observations: {}, disconnects: 0,
	updatedAt: '', errors: [], reportPath: '',
};
const history = new Map<string, { sample: ActionSample; pressedAt: number | null }>();
let previousControllers = new Set<string>();
let poll: ReturnType<typeof setInterval> | undefined;
let persist: ReturnType<typeof setInterval> | undefined;
let shuttingDown = false;
let pendingSave = Promise.resolve();

const recordError = function (error: unknown): void {
	const message = error instanceof Error ? error.message : String(error);
	if (!report.errors.includes(message)) report.errors = [...report.errors.slice(-9), message];
};
const save = function (): Promise<void> {
	if (!report.reportPath) return pendingSave;
	pendingSave = pendingSave.then(async function () {
		try { await writeFile(report.reportPath, JSON.stringify(report, null, 2)); }
		catch (error) { recordError(error); }
	});
	return pendingSave;
};
const sample = function (): void {
	if (!report.inputInitialized) return;
	try {
		steam.runCallbacks();
		steam.input.runFrame();
		report.sessionConfiguration = steam.input.getSessionInputConfigurationSettings();
		const handles = steam.input.getConnectedControllers();
		const current = new Set(handles.map(String));
		for (const old of previousControllers) {
			if (!current.has(old)) {
				report.disconnects++;
				// A disconnect is not an observed button release.
				for (const action of actions) {
					const state = history.get(`${old}:${action}`);
					if (state) { state.pressedAt = null; state.sample.pressed = false; }
				}
			}
		}
		previousControllers = current;
		report.seenControllers = [...new Set([...report.seenControllers, ...current])];
		report.controllers = handles.map(function (handle) {
			steam.input.activateActionSet(handle, BigInt(report.actionSet));
			return {
				handle: String(handle), type: SteamInputType[steam.input.getInputTypeForHandle(handle)] ?? 'Unknown',
				bindingRevision: steam.input.getDeviceBindingRevision(handle),
				actions: actions.map(function (name) {
					const key = `${handle}:${name}`;
					const old = history.get(key) ?? {
						sample: { name, active: false, pressed: false, presses: 0, releases: 0, longestHoldMs: 0, glyph: null },
						pressedAt: null,
					};
					const actionHandle = BigInt(report.actionHandles[name]);
					const data = steam.input.getDigitalActionData(handle, actionHandle);
					const pressed = data.active && data.state;
					const now = performance.now();
					if (pressed && !old.sample.pressed) { old.sample.presses++; old.pressedAt = now; }
					if (!pressed && old.sample.pressed && data.active) old.sample.releases++;
					if (old.pressedAt !== null) old.sample.longestHoldMs = Math.max(old.sample.longestHoldMs, Math.round(now - old.pressedAt));
					if (!pressed) old.pressedAt = null;
					old.sample.active = data.active;
					old.sample.pressed = pressed;
					// Resolve again periodically so rebinding and controller changes are visible.
					if (Math.floor(now / 1000) !== Math.floor((now - 16) / 1000) || old.sample.glyph === null) {
						const origin = steam.input.getDigitalActionOrigins(handle, BigInt(report.actionSet), actionHandle)[0];
						old.sample.glyph = origin === undefined ? null : steam.input.getStringForActionOrigin(origin);
					}
					history.set(key, old);
					return { ...old.sample };
				}),
			};
		});
		report.observations = Object.fromEntries(report.seenControllers.map(handle => [
			handle, actions.flatMap(name => {
				const state = history.get(`${handle}:${name}`);
				return state ? [{ ...state.sample }] : [];
			}),
		]));
		report.updatedAt = new Date().toISOString();
	} catch (error) { recordError(error); }
};

app.whenReady().then(async function () {
	report.reportPath = join(app.getPath('userData'), 'steam-input-diagnostic.json');
	await mkdir(app.getPath('userData'), { recursive: true });
	try { report.build = (await readFile(join(diagnosticRoot, 'build-id.txt'), 'utf8')).trim(); }
	catch { /* A source launch can use the development identifier. */ }
	try {
		steam.setSdkPath(join(process.resourcesPath, 'steamworks_sdk'));
		report.initialized = steam.init({ appId: report.appId });
		if (!report.initialized) throw new Error('Steamworks did not initialize. Start this build from Steam.');
		report.manifestAccepted = steam.input.setInputActionManifestFilePath(join(process.resourcesPath, 'steam-input', 'game_actions.vdf'));
		report.inputInitialized = steam.input.init(true);
		report.actionSet = String(steam.input.getActionSetHandle('Diagnostic'));
		for (const name of actions) report.actionHandles[name] = String(steam.input.getDigitalActionHandle(name));
		if (!report.manifestAccepted || !report.inputInitialized || report.actionSet === '0' || Object.values(report.actionHandles).includes('0')) {
			throw new Error('Steam Input initialization or action resolution failed. See the report.');
		}
		poll = setInterval(sample, 16);
	} catch (error) { recordError(error); }

	ipcMain.handle('input-test:report', () => report);
	ipcMain.handle('input-test:copy', () => clipboard.writeText(JSON.stringify(report, null, 2)));
	ipcMain.handle('input-test:bindings', () => {
		if (!report.inputInitialized) return false;
		const handle = steam.input.getConnectedControllers()[0];
		return handle === undefined ? false : steam.input.showBindingPanel(handle);
	});
	ipcMain.handle('input-test:quit', () => app.quit());
	const window = new BrowserWindow({
		width: 1280, height: 800, backgroundColor: '#07170f', autoHideMenuBar: true,
		fullscreen: process.env.SteamTenfoot === '1',
		webPreferences: { preload: join(diagnosticRoot, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
	});
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	await window.loadFile(join(diagnosticRoot, 'index.html'));
	persist = setInterval(() => { void save(); }, 2000);
	await save();
}).catch(function (error: unknown) { recordError(error); console.error(error); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', function (event) {
	if (shuttingDown) return;
	event.preventDefault();
	shuttingDown = true;
	clearInterval(poll);
	clearInterval(persist);
	if (report.initialized) {
		try { if (report.inputInitialized) steam.input.shutdown(); steam.shutdown(); }
		catch (error) { recordError(error); }
	}
	void save().finally(() => app.quit());
});
