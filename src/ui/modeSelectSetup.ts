import type { EquationOperation, GameMode, MathDifficulty } from '../ecs/types';
import type { SavedMathTrack } from '../ecs/mathProgressStore';

export type ModeSelectStep = 'math' | 'pond';
export type ModeSelectPanel = 'math-steps' | 'difficulty-help' | null;

export type ModeSelectSetupState = Readonly<{
	step: ModeSelectStep;
	selectedOperations: readonly EquationOperation[];
	difficulty: MathDifficulty | null;
	panel: ModeSelectPanel;
}>;

export type MathProgressCue = Readonly<{
	highestUnlockedStep: number;
	caption: string;
	valueText: string;
	percentage: number;
}>;

export type ModeSelectGameRequest = Readonly<{
	mode: GameMode;
	difficulty: MathDifficulty;
	startingLevel: number;
}>;

export function mathProgressCue(track: SavedMathTrack, finalStep: number): MathProgressCue {
	const unlockedStep = Math.min(finalStep, Math.max(1, Number.isFinite(track.highestUnlockedStep)
		? Math.floor(track.highestUnlockedStep)
		: 1));
	return {
		highestUnlockedStep: unlockedStep,
		caption: unlockedStep === 1 ? '1 step unlocked' : `${unlockedStep} steps unlocked`,
		valueText: `${unlockedStep} of ${finalStep} steps unlocked`,
		percentage: (unlockedStep / finalStep) * 100,
	};
}

export function createModeSelectSetupState(): ModeSelectSetupState {
	return {
		step: 'math',
		selectedOperations: [],
		difficulty: null,
		panel: null,
	};
}

export function toggleModeSelectOperation(
	state: ModeSelectSetupState,
	operation: EquationOperation,
): ModeSelectSetupState {
	if (state.step !== 'math' || state.panel !== null) return state;
	const selectedOperations = state.selectedOperations.includes(operation)
		? state.selectedOperations.filter(candidate => candidate !== operation)
		: [...state.selectedOperations, operation];
	return { ...state, selectedOperations };
}

export function advanceModeSelectToPond(state: ModeSelectSetupState): ModeSelectSetupState {
	if (state.step !== 'math' || state.panel !== null || state.selectedOperations.length === 0) return state;
	return { ...state, step: 'pond' };
}

export function returnModeSelectToMath(state: ModeSelectSetupState): ModeSelectSetupState {
	if (state.step !== 'pond' || state.panel !== null) return state;
	return { ...state, step: 'math' };
}

export function showModeSelectPanel(
	state: ModeSelectSetupState,
	panel: Exclude<ModeSelectPanel, null>,
): ModeSelectSetupState {
	if (state.panel !== null) return state;
	if (panel === 'math-steps' && (state.step !== 'math' || state.selectedOperations.length === 0)) return state;
	if (panel === 'difficulty-help' && state.step !== 'pond') return state;
	return { ...state, panel };
}

export function closeModeSelectPanel(state: ModeSelectSetupState): ModeSelectSetupState {
	return state.panel === null ? state : { ...state, panel: null };
}

export function revealModeSelectLevelSelection(state: ModeSelectSetupState): ModeSelectSetupState {
	return { ...state, step: 'math', panel: 'math-steps' };
}

export function chooseModeSelectDifficulty(
	state: ModeSelectSetupState,
	difficulty: MathDifficulty,
): ModeSelectSetupState {
	if (state.step !== 'pond' || state.panel !== null) return state;
	return { ...state, difficulty };
}

export function modeSelectGameRequest(
	state: ModeSelectSetupState,
	startingLevel: number,
): ModeSelectGameRequest | undefined {
	if (state.step !== 'pond' || state.panel !== null || state.difficulty === null) return undefined;
	const [firstOperation, ...otherOperations] = state.selectedOperations;
	if (!firstOperation) return undefined;
	return {
		mode: [firstOperation, ...otherOperations],
		difficulty: state.difficulty,
		startingLevel,
	};
}
