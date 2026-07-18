import type { SettingsReturnScreen } from '../ecs/types';
import type { TemplateResult } from 'lit-html';
import type { InputPromptItem } from './inputPrompts';

export type UIScreen = Exclude<SettingsReturnScreen, 'tutorial'> | 'settings' | 'tutorialOffer';

export type InputPromptPlacement = 'viewport' | 'panel' | 'hud';

export type ScreenSpec = {
  id: string;
  className: string;
  html: string | TemplateResult;
  prompts?: InputPromptItem[];
  promptPlacement: InputPromptPlacement;
  wire?: (root: HTMLElement) => void;
  focusSelector?: string;
  onCancel?: () => void;
};

export const DEFAULT_FOCUS_SELECTOR = [
	'button:not(:disabled)',
	'input:not(:disabled)',
	'select:not(:disabled)',
	'textarea:not(:disabled)',
	'[data-focusable]:not(.disabled)',
].join(', ');
