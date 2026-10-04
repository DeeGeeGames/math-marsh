import { gameplayTimeMs } from '../gameplayClock';
import type { GameSystemRegistrar } from '../Engine';
import { EQUATION_FEEDBACK_DURATION_MS, SELECTION_DISRUPTION_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
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
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.EQUATION_FEEDBACK)
    .inScreens(['playing'])
    .runWhenEmpty()
    .addQuery('disruptions', { with: ['selectionDisruption'], mutates: [] } as const)
    .withResources(['equationMode', 'gameplayClock'])
    .setProcess(({ ecs, queries, resources: { equationMode, gameplayClock } }) => {
      const currentTime = gameplayTimeMs(gameplayClock);
      queries.disruptions
        .filter(effect => currentTime - effect.components.selectionDisruption.startedAt >= SELECTION_DISRUPTION_DURATION_MS)
        .forEach(effect => ecs.commands.removeEntity(effect.id));
      const feedback = equationMode.feedback;
      if (!feedback) return;

      const nextMode = nextEquationModeForFeedback(feedback, currentTime);
      if (!nextMode) return;

      ecs.setResource('equationMode', nextMode);
    });
}
