import type { PracticeSelection, PracticeSession } from '../../ecs/practiceSession';
import type { PracticeProgress } from '../../ecs/practiceProgress';
import type { EquationOperation, GameMode, MathDifficulty } from '../../ecs/types';
import type { BoardPoint } from '../../ecs/lilyPads';
import type { SkitId } from '../../ecs/skitSequence';
import type { SkitProgress } from '../../ecs/skitProgress';
import type { SavedMathProgress } from '../../ecs/mathProgressStore';
import { type ProfilePersistenceStatus, type PlayerProfile, type PlayerProfilesError, type PlayerProfilesState } from '../../profiles/types';

export type ScreenSpecActions = {
  startGame: (mode: GameMode, difficulty: MathDifficulty, level?: number) => void;
  isLevelSelectionUnlocked: () => boolean;
  startTutorial: () => void;
  skipTutorial: () => void;
  nextTutorialStep: () => void;
  previousTutorialStep: () => void;
  replayGame: () => void;
  isDemoArcadeComplete: () => boolean;
  continueDemo: () => void;
  openFullGame: () => Promise<void>;
  returnToPreviousScreen: () => void;
  goToMenu: () => void;
  openModeSelect: () => void;
  openPractice: () => void;
  startPractice: (selection: PracticeSelection) => void;
  getPracticeSession: () => PracticeSession | null;
  getPracticeProgress: () => PracticeProgress;
  getPracticePersistence: () => ProfilePersistenceStatus;
  repeatPractice: () => void;
  selectMathStep: (operation: EquationOperation, step: number) => void;
  getMathProgress: () => SavedMathProgress;
  getMathProgressPersistence: () => ProfilePersistenceStatus;
  openHowToPlay: () => void;
  getPlayerProfiles: () => PlayerProfilesState;
  getPlayerActionProfile: () => PlayerProfile | undefined;
  getNextPlayerName: () => string;
  openPlayerRoster: () => void;
  closePlayerScreen: (focusSelector: string) => void;
  openPlayerAdd: () => void;
  openPlayerManagement: () => void;
  openPlayerRename: (profileId: string) => void;
  openPlayerDelete: (profileId: string) => void;
  createPlayer: (name: string) => PlayerProfilesError | undefined;
  switchPlayer: (profileId: string) => void;
  renamePlayer: (profileId: string, name: string) => PlayerProfilesError | undefined;
  deletePlayer: (profileId: string) => PlayerProfilesError | undefined;
  openSkitGallery: () => void;
  replaySkit: (id: SkitId) => void;
  getSkitProgress: () => SkitProgress;
  openSettings: () => void;
  quitApplication?: (() => void) | undefined;
  pauseGame: () => void;
  skipSkit: () => void;
  wireFullscreenButton: (button: HTMLButtonElement) => void;
  wireAudioSettings: (root: ParentNode) => void;
  wireTouchControlsSetting: (root: ParentNode) => void;
  tapBoardPoint: (point: BoardPoint) => void;
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
