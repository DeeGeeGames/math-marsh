import type { ScreenSpec } from '../ui/screenTypes';
import { shouldShowTutorialTouchGuidance, tutorialTouchGuidance, tutorialTouchIllustration } from './tutorialTouchGuidance';
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

export const updateTutorialTouchGuidance = function(
  session: GameplayOnboardingSession,
  touchSupported: boolean,
  controllerConnected: boolean,
): void {
  const illustration = document.getElementById('tutorial-touch-guidance');
  const description = document.getElementById('gameplay-onboarding-copy');
  const panel = document.getElementById('gameplay-onboarding');
  if (!illustration || !description || !panel || !session.active) return;
  const guidance = shouldShowTutorialTouchGuidance(touchSupported, controllerConnected)
    ? tutorialTouchGuidance(session)
    : undefined;
  panel.classList.toggle('touch-guidance', guidance !== undefined);
  illustration.hidden = guidance === undefined;
  const step = tutorialSteps(session.kind)[session.stepIndex];
  const copy = guidance?.copy ?? step?.copy;
  if (copy !== undefined && description.textContent !== copy) description.textContent = copy;
  if (!guidance || illustration.dataset.action === guidance.action) return;
  illustration.dataset.action = guidance.action;
  illustration.innerHTML = `
    <figure class="tutorial-tap-example">
      ${tutorialTouchIllustration(guidance.action)}
      <figcaption>${guidance.caption}</figcaption>
    </figure>
    <div class="tutorial-gamepad-option">
      <svg viewBox="0 0 150 64" aria-hidden="true" focusable="false">
        <path d="M25 3h20v19h19v20H45v19H25V42H6V22h19Z" fill="#0f4f62" stroke="#fff7c6" stroke-width="2" />
        <path d="m30 15 5-6 5 6m-10 35 5 6 5-6M18 27l-6 5 6 5m34-10 6 5-6 5" fill="none" stroke="#fff7c6" stroke-width="2" />
        <circle cx="116" cy="32" r="27" fill="#527f36" stroke="#fff7c6" stroke-width="2" />
        <text x="116" y="37" text-anchor="middle" fill="#fff7c6" font-size="15" font-weight="800">EAT</text>
      </svg>
      <p><strong>Or use the virtual gamepad</strong><br>Arrows move; EAT eats on the current pad. Settings → Touch Controls → Always On.</p>
    </div>`;
};

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
