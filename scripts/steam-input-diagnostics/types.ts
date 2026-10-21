export const actions = ['select', 'back', 'pause', 'up', 'down', 'left', 'right'] as const;
export type DiagnosticAction = typeof actions[number];
export interface ActionSample {
	name: DiagnosticAction;
	active: boolean;
	pressed: boolean;
	presses: number;
	releases: number;
	longestHoldMs: number;
	glyph: string | null;
}
export interface ControllerSample {
	handle: string;
	type: string;
	bindingRevision: { major: number; minor: number } | null;
	actions: ActionSample[];
}
export interface DiagnosticReport {
	build: string;
	platform: string;
	node: string;
	electron: string;
	library: string;
	appId: number;
	launchedBySteam: boolean;
	initialized: boolean;
	manifestAccepted: boolean;
	inputInitialized: boolean;
	actionSet: string;
	actionHandles: Record<DiagnosticAction, string>;
	sessionConfiguration: number;
	controllers: ControllerSample[];
	seenControllers: string[];
	observations: Record<string, ActionSample[]>;
	disconnects: number;
	updatedAt: string;
	errors: string[];
	reportPath: string;
}
export interface DiagnosticBridge {
	getReport(): Promise<DiagnosticReport>;
	copyReport(): Promise<void>;
	openBindings(): Promise<boolean>;
	quit(): Promise<void>;
}
