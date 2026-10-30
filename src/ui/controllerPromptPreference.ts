import type { ControllerPromptPreference } from './inputPrompts';

const STORAGE_KEY = 'math-marsh.controller-prompts';
const choices = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'xbox', label: 'Xbox' },
	{ value: 'playstation', label: 'PlayStation' },
	{ value: 'switch', label: 'Nintendo' },
	{ value: 'steamdeck', label: 'Steam Deck' },
] as const;
let preference: ControllerPromptPreference | undefined;

export const loadControllerPromptPreference = function(): ControllerPromptPreference {
	if (preference !== undefined) return preference;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		preference = choices.find(choice => choice.value === stored)?.value ?? 'auto';
	} catch {
		preference = 'auto';
	}
	return preference;
};

// A cycle button participates in the existing spatial navigation and confirm
// path, including on controllers where a native select popup is inaccessible.
export const wireControllerPromptPreference = function(root: HTMLElement): void {
	const button = root.querySelector<HTMLButtonElement>('[data-controller-prompts]');
	if (!button) return;
	const refresh = function(): void {
		const selected = choices.find(choice => choice.value === loadControllerPromptPreference()) ?? choices[0];
		button.textContent = `Button prompts: ${selected.label}`;
	};
	refresh();
	button.addEventListener('click', function() {
		const index = choices.findIndex(choice => choice.value === loadControllerPromptPreference());
		preference = choices[(index + 1) % choices.length]?.value ?? 'auto';
		try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* Retain the session choice. */ }
		refresh();
	});
};
