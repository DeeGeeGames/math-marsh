import type { ScreenSpec } from '../ui/screenTypes';
import {
  tutorialSteps,
  type GameplayOnboardingSession,
} from './gameplayOnboarding';

export const TUTORIAL_PROMPT_SPEC = {
  prompts: [
    { action: 'select', label: 'Next' },
    { action: 'back', label: 'Back' },
    { action: 'skip', label: 'Skip' },
  ],
  promptPlacement: 'hud',
} as const satisfies Pick<ScreenSpec, 'prompts' | 'promptPlacement'>;

const TUTORIAL_FINISH_LABELS = {
  nextTutorial: 'Next Tutorial',
  previousScreen: 'Finish Tutorial',
  newGame: 'Start Playing',
} as const;

export function updateGameplayOnboardingUI(
  session: GameplayOnboardingSession,
): void {
  const panel = document.getElementById('gameplay-onboarding');
  if (!panel) return;
  panel.classList.toggle('hidden', !session.active);
  panel.closest('#gameplay-ui')?.classList.toggle('tutorial-mode', session.active);
  const pauseButton = document.getElementById('pause-btn');
  if (pauseButton) pauseButton.hidden = session.active;
  if (!session.active) return;

  const steps = tutorialSteps(session.kind);
  const step = steps[session.stepIndex];
  if (!step) throw new Error(`Unknown tutorial step: ${session.stepIndex}`);
  const kicker = document.getElementById('gameplay-onboarding-kicker');
  const title = document.getElementById('gameplay-onboarding-title');
  const description = document.getElementById('gameplay-onboarding-copy');
  const backButton = document.getElementById('tutorial-back-btn');
  const nextButton = document.getElementById('tutorial-next-btn');
  if (!kicker || !title || !description || !backButton || !nextButton) {
    throw new Error('Gameplay onboarding UI is incomplete');
  }

  kicker.textContent = `Step ${session.stepIndex + 1} of ${steps.length}`;
  title.textContent = step.title;
  description.textContent = step.copy;
  backButton.toggleAttribute('disabled', session.stepIndex === 0);
  nextButton.textContent = session.stepIndex === steps.length - 1
    ? session.returnTo.kind === 'level'
      ? `Start Level ${session.returnTo.level}`
      : TUTORIAL_FINISH_LABELS[session.returnTo.kind]
    : 'Next';
}
