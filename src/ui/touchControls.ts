import { scheduleTouchControlsLayout } from './touchLayout';

export type TouchControlsMode = 'auto' | 'on' | 'off';

const STORAGE_KEY = 'math-marsh.touchControls';
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

const MODES: readonly TouchControlsMode[] = ['auto', 'on', 'off'];

const isMode = (value: unknown): value is TouchControlsMode =>
	typeof value === 'string' && MODES.some((m) => m === value);

export const loadTouchControlsMode = (): TouchControlsMode => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isMode(stored) ? stored : 'auto';
	} catch {
		return 'auto';
	}
};

export const saveTouchControlsMode = (mode: TouchControlsMode): void => {
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// Storage unavailable (private mode, quota) — in-memory state still
		// drives the current session via applyTouchControlsVisibility.
	}
};

export const isTouchPrimary = (): boolean => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
	return window.matchMedia(TOUCH_QUERY).matches;
};

export const shouldShowTouchControls = (mode: TouchControlsMode): boolean =>
	mode === 'on' || (mode === 'auto' && isTouchPrimary());

export const applyTouchControlsVisibility = (mode: TouchControlsMode = loadTouchControlsMode()): void => {
	document.body.dataset.touchControls = shouldShowTouchControls(mode) ? 'on' : 'off';
	scheduleTouchControlsLayout();
};

const refreshTouchModeButtons = (root: ParentNode, mode: TouchControlsMode): void => {
	const buttons = root.querySelectorAll<HTMLButtonElement>('.touch-mode-btn');
	buttons.forEach((btn) => {
		const isActive = btn.dataset.touchMode === mode;
		btn.setAttribute('aria-pressed', String(isActive));
		btn.classList.toggle('ring-2', isActive);
		btn.classList.toggle('ring-yellow-300', isActive);
	});
};

export const wireTouchControlsSetting = (
	root: ParentNode,
	onChange: () => void,
): void => {
	const initial = loadTouchControlsMode();
	refreshTouchModeButtons(root, initial);
	const buttons = root.querySelectorAll<HTMLButtonElement>('.touch-mode-btn');
	buttons.forEach((btn) => {
		btn.addEventListener('click', () => {
			const next = btn.dataset.touchMode;
			if (!isMode(next)) return;
			saveTouchControlsMode(next);
			applyTouchControlsVisibility(next);
			refreshTouchModeButtons(root, next);
			onChange();
		});
	});
};
