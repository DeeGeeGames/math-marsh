import type { GameSystemRegistrar } from '../Engine';
import { presentTitleScene, titleSceneVisible } from '../../ui/titleScene';
import { SYSTEM_PRIORITIES } from '../systemConfigs';

/** The ECS screen owns the clock; the DOM only presents the sampled scene. */
export const addTitleSceneSystem = function(systems: GameSystemRegistrar): void {
	let reducedMotion: MediaQueryList | undefined;
	systems.addSystem('title-scene')
		.inScreens(['menu'])
		.setPriority(SYSTEM_PRIORITIES.UI)
		.setProcess(function({ ecs, dt }): void {
			const root = document.getElementById('main-menu');
			if (!root || document.hidden) return;
			reducedMotion ??= window.matchMedia('(prefers-reduced-motion: reduce)');
			const state = ecs.getScreenState('menu');
			if (reducedMotion.matches) { presentTitleScene(root, 0); return; }
			if (!titleSceneVisible(root)) return;
			const elapsed = (state.elapsed ?? 0) + dt;
			ecs.updateScreenState('menu', { elapsed });
			presentTitleScene(root, elapsed);
		});
};
