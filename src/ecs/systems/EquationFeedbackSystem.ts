import { gameplayTimeMs } from '../gameplayClock';
import type { GameSystemRegistrar } from '../Engine';
import { EQUATION_FEEDBACK_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import type { BaseEquationModeState, EquationFeedback } from '../types';

const nextEquationModeForFeedback = (
  feedback: EquationFeedback,
  currentTime: number,
): BaseEquationModeState | undefined => {
  if (feedback.kind !== 'correct') return undefined;
  if (currentTime - feedback.startedAt < EQUATION_FEEDBACK_DURATION_MS.correct) return undefined;

  return feedback.nextMode;
};

export function addEquationFeedbackSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('equationFeedbackSystem')
    .setPriority(SYSTEM_PRIORITIES.EQUATION_FEEDBACK)
    .inScreens(['playing'])
    .runWhenEmpty()
    .withResources(['equationMode'])
    .setProcess(({ ecs, resources: { equationMode } }) => {
      const feedback = equationMode.feedback;
      if (!feedback) return;

      const nextMode = nextEquationModeForFeedback(feedback, gameplayTimeMs(ecs.getResource('gameplayClock')));
      if (!nextMode) return;

      ecs.setResource('equationMode', nextMode);
    });
}
