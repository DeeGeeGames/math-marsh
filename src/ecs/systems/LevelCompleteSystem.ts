import type { GameSystemRegistrar } from '../Engine';
import { LEVEL_COMPLETE_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import { shouldPlaySkit } from '../skitSequence';
import { goToNextLevel } from './nextLevel';

export function addLevelCompleteSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('levelCompleteSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.LEVEL_COMPLETE)
    .inScreens(['levelComplete'])
    .runWhenEmpty()
    .withResources(['mathDifficulty', 'operandOnboardingCompletion', 'operandAndResultOnboardingCompletion'])
    .setProcess(({ ecs, resources: { mathDifficulty, operandOnboardingCompletion, operandAndResultOnboardingCompletion } }) => {
      const state = ecs.getScreenState('levelComplete');
      const elapsed = performance.now() - state.startedAt;
      if (elapsed < LEVEL_COMPLETE_DURATION_MS || state.transitionStarted) return;

      ecs.updateScreenState('levelComplete', { transitionStarted: true });
      if (shouldPlaySkit(state.completedLevel)) {
        void ecs.setScreen('skit', { nextLevel: state.nextLevel });
        return;
      }
      goToNextLevel(ecs, state.nextLevel, mathDifficulty, operandOnboardingCompletion, operandAndResultOnboardingCompletion);
    });
}
