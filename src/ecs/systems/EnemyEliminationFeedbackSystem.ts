import { playSound } from '../../audio/audio';
import type { GameSystemRegistrar } from '../Engine';
import { SYSTEM_PRIORITIES } from '../systemConfigs';

export const ENEMY_BURST_SECONDS = 0.28;

export const addEnemyEliminationFeedbackSystem = function(systems: GameSystemRegistrar): void {
	systems.addSystem('enemyEliminationFeedback')
		.inGroup('gameplay')
		.inScreens(['playing'])
		.setPriority(SYSTEM_PRIORITIES.ANIMATION - 1)
		.addQuery('eliminations', { with: ['enemyElimination'], mutates: ['enemyElimination'] } as const)
		.setProcess(({ queries, dt }) => {
			let landed = false;
			for (const entity of queries.eliminations) {
				const impact = entity.components.enemyElimination.impact;
				if (!impact || impact.landed < 1) continue;
				if (!impact.played) {
					impact.played = true;
					landed = true;
				} else {
					impact.age = Math.min(ENEMY_BURST_SECONDS, impact.age + dt);
				}
			}
			// All landings in this frame share a pop; every enemy keeps its own burst.
			if (landed) playSound('enemyPop');
		});
};
