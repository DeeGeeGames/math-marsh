import { completeDemoArcadeRound, isDemoArcadeComplete } from '../demoArcade';
import type { GameSystemRegistrar } from '../Engine';
import { LEVEL_COMPLETE_DURATION_MS, SYSTEM_PRIORITIES } from '../systemConfigs';
import { skitForCompletedLevel } from '../skitSequence';
import { activePlayerProfile } from '../../profiles/rules';
import { goToNextLevel } from './nextLevel';

export function addLevelCompleteSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('levelCompleteSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.LEVEL_COMPLETE)
    .inScreens(['levelComplete'])
    .runWhenEmpty()
    .withResources(['mathDifficulty', 'playerProfiles'])
    .setProcess(({ ecs, resources: { mathDifficulty, playerProfiles } }) => {
      const state = ecs.getScreenState('levelComplete');
      const elapsed = performance.now() - state.startedAt;
      if (elapsed < LEVEL_COMPLETE_DURATION_MS || state.transitionStarted) return;

      ecs.updateScreenState('levelComplete', { transitionStarted: true });
      const demoRun = ecs.tryGetResource('practiceSession') ? null
        : completeDemoArcadeRound(ecs.tryGetResource('demoArcadeRun') ?? null, state.completedLevel);
      ecs.setResource('demoArcadeRun', demoRun);
      if (isDemoArcadeComplete(demoRun)) {
        void ecs.setScreen('gameOver', {});
        return;
      }
      const skit = skitForCompletedLevel(state.completedLevel);
      if (skit && !ecs.tryGetResource('practiceSession')) {
        void ecs.setScreen('skit', { nextLevel: state.nextLevel, skitId: skit.id });
        return;
      }
      const profile = activePlayerProfile(playerProfiles);
      if (!profile) return;
      goToNextLevel(ecs, state.nextLevel, mathDifficulty, profile.onboarding.operands, profile.onboarding.operandAndResult);
    });
}
