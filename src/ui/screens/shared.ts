import type { GameMode, MathDifficulty } from '../../ecs/types';
import type { GridCell } from '../../ecs/lilyPads';

export type ScreenSpecActions = {
  startGame: (mode: GameMode, difficulty: MathDifficulty) => void;
  startTutorial: () => void;
  skipTutorial: () => void;
  nextTutorialStep: () => void;
  previousTutorialStep: () => void;
  replayGame: () => void;
  returnToPreviousScreen: () => void;
  goToMenu: () => void;
  openModeSelect: () => void;
  openHowToPlay: () => void;
  openSettings: () => void;
  quitApplication?: () => void;
  pauseGame: () => void;
  wireFullscreenButton: (button: HTMLButtonElement) => void;
  wireAudioSettings: (root: ParentNode) => void;
  wireTouchControlsSetting: (root: ParentNode) => void;
  tapBoardCell: (cell: GridCell) => void;
};

export const OVERLAY_BASE =
  'absolute inset-0 flex flex-col items-center justify-center text-white z-50 overflow-y-auto overscroll-contain overlay-safe-padding';

export const BTN_CHROME =
  'text-white border-none rounded-xl shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-xl btn-mobile';

export const BTN_SIZE = {
  lgResponsive: 'px-8 md:px-12 py-4 md:py-5 text-lg md:text-xl font-semibold',
  mdResponsive: 'px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-medium',
  lg: 'px-8 py-4 text-lg font-semibold',
  md: 'px-6 py-3 text-base font-medium',
} as const;

export function inputPromptsSlot(): string {
  return '<div class="input-prompts-slot" data-input-prompts></div>';
}
