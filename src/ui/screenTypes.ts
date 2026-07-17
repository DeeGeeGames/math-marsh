import type { SettingsReturnScreen } from '../ecs/types';
import type { TemplateResult } from 'lit-html';
import type { InputPromptItem } from './inputPrompts';

export type UIScreen = SettingsReturnScreen | 'settings';

export type ScreenSpec = {
  id: string;
  className: string;
  html: string | TemplateResult;
  prompts?: InputPromptItem[];
  wire?: (root: HTMLElement) => void;
  focusSelector?: string;
  onCancel?: () => void;
};

export const DEFAULT_FOCUS_SELECTOR = 'button:not(:disabled), [data-focusable]:not(.disabled)';
