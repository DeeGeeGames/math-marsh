import { contextBridge, ipcRenderer } from 'electron';
import type { DiagnosticBridge, DiagnosticReport } from './types';
const bridge: DiagnosticBridge = {
	getReport: function (): Promise<DiagnosticReport> { return ipcRenderer.invoke('input-test:report'); },
	copyReport: function (): Promise<void> { return ipcRenderer.invoke('input-test:copy'); },
	openBindings: function (): Promise<boolean> { return ipcRenderer.invoke('input-test:bindings'); },
	quit: function (): Promise<void> { return ipcRenderer.invoke('input-test:quit'); },
};
contextBridge.exposeInMainWorld('steamInputDiagnostic', bridge);
