import type { GameSystemRegistrar } from '../Engine';
import { gameActions } from '../controllerSelection';
import { skitById } from '../skitSequence';
import { updateSkitPresentation } from '../../ui/screens/skitScreen';
import { goToNextLevel } from './nextLevel';

export const addSkitSystemToEngine = function(systems: GameSystemRegistrar): void {
	systems.addSystem('skitSystem')
		.inScreens(['skit'])
		.withResources(['inputState', 'controllerSelection', 'mathDifficulty', 'operandOnboardingCompletion', 'operandAndResultOnboardingCompletion'])
		.setProcess(({ ecs, dt, resources }) => {
			const state = ecs.getScreenState('skit');
			if (state.transitionStarted) return;
			const skit = skitById(state.skitId);
			const actions = gameActions(resources.inputState, resources.controllerSelection);
			const skip = actions.justActivated('eat') || actions.justActivated('back') || actions.justActivated('pause');
			const elapsed = state.elapsed + dt;
			ecs.updateScreenState('skit', { elapsed });
			updateSkitPresentation(elapsed, skit);
			if (!skip && elapsed < skit.durationSeconds) return;
			ecs.updateScreenState('skit', { transitionStarted: true });
			if (state.replay) {
				void ecs.setScreen('skitGallery', {});
				return;
			}
			goToNextLevel(ecs, state.nextLevel, resources.mathDifficulty, resources.operandOnboardingCompletion, resources.operandAndResultOnboardingCompletion);
		});
};
