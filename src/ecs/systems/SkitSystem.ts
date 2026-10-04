import type { GameSystemRegistrar } from '../Engine';
import { gameActions } from '../controllerSelection';
import { SKIT_DURATION_SECONDS } from '../skitSequence';
import { updateSkitPresentation } from '../../ui/screens/skitScreen';
import { goToNextLevel } from './nextLevel';

export const addSkitSystemToEngine = function(systems: GameSystemRegistrar): void {
	systems.addSystem('skitSystem')
		.inScreens(['skit'])
		.withResources(['inputState', 'controllerSelection', 'mathDifficulty', 'operandOnboardingCompletion', 'operandAndResultOnboardingCompletion'])
		.setProcess(({ ecs, dt, resources }) => {
			const state = ecs.getScreenState('skit');
			if (state.transitionStarted) return;
			const actions = gameActions(resources.inputState, resources.controllerSelection);
			const skip = actions.justActivated('eat') || actions.justActivated('back') || actions.justActivated('pause');
			const elapsed = state.elapsed + dt;
			ecs.updateScreenState('skit', { elapsed });
			updateSkitPresentation(elapsed);
			if (!skip && elapsed < SKIT_DURATION_SECONDS) return;
			ecs.updateScreenState('skit', { transitionStarted: true });
			goToNextLevel(ecs, state.nextLevel, resources.mathDifficulty, resources.operandOnboardingCompletion, resources.operandAndResultOnboardingCompletion);
		});
};
