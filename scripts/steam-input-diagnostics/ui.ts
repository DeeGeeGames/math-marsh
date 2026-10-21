import type { DiagnosticBridge, DiagnosticReport } from './types';
declare global { interface Window { steamInputDiagnostic?: DiagnosticBridge } }
const root = document.getElementById('report');
const status = document.getElementById('status');
let stopped = false;
const line = function (label: string, value: string): HTMLParagraphElement {
	const paragraph = document.createElement('p');
	paragraph.textContent = `${label}: ${value}`;
	return paragraph;
};
const render = function (report: DiagnosticReport): void {
	if (!root) return;
	root.replaceChildren(
		line('Build', report.build),
		line('Steam / manifest / native input', [report.initialized, report.manifestAccepted, report.inputInitialized].map(value => value ? 'OK' : 'FAILED').join(' / ')),
		line('Session opt-ins', `0x${report.sessionConfiguration.toString(16)} (Xbox 2, PlayStation 1, Generic 4, Switch 8)`),
		line('Native controllers', `${report.controllers.length}; disconnects observed: ${report.disconnects}`),
	);
	if (report.controllers.length === 0) root.append(line('Waiting', 'No Steam Input controller. Enable Steam Input in this game’s Properties → Controller, then restart.'));
	for (const controller of report.controllers) {
		root.append(line('Controller', `${controller.type} · ${controller.handle}`));
		for (const action of controller.actions) {
			const row = line(action.name, `${action.pressed ? 'HELD' : action.active ? 'ready' : 'unbound'} · presses ${action.presses} · releases ${action.releases} · hold ${action.longestHoldMs}ms · ${action.glyph ?? 'no button label'}`);
			row.classList.toggle('held', action.pressed);
			root.append(row);
		}
	}
	root.append(line('Report saved automatically', report.reportPath));
	for (const error of report.errors) root.append(line('Error', error));
};
const refresh = async function (): Promise<void> {
	const bridge = window.steamInputDiagnostic;
	if (!bridge || stopped) return;
	try { render(await bridge.getReport()); }
	catch (error) { if (status) status.textContent = String(error); }
	if (!stopped) setTimeout(() => { void refresh(); }, 100);
};
window.addEventListener('pagehide', () => { stopped = true; });
document.getElementById('copy')?.addEventListener('click', async function () {
	await window.steamInputDiagnostic?.copyReport();
	if (status) status.textContent = 'Report copied. Paste it into the conversation.';
});
document.getElementById('bindings')?.addEventListener('click', async function () {
	const opened = await window.steamInputDiagnostic?.openBindings();
	if (status) status.textContent = opened ? 'Controller binding panel requested.' : 'No native controller available. Use Steam’s controller settings.';
});
document.getElementById('quit')?.addEventListener('click', () => { void window.steamInputDiagnostic?.quit(); });
document.addEventListener('keydown', function (event) {
	if (event.key === 'Escape') void window.steamInputDiagnostic?.quit();
	if (event.key.toLowerCase() === 'c') void window.steamInputDiagnostic?.copyReport();
});
void refresh();
