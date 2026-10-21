import { playSound } from '../../audio/audio';
import type { GameSystemRegistrar } from '../Engine';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { SPLASH_CELEBRATION_SECONDS, splashSound } from '../splashCelebration';

export const ENEMY_BURST_SECONDS = 0.28;
export const ENEMY_SPLASH_SECONDS = 0.44;

export const addEnemyEliminationFeedbackSystem = function(systems: GameSystemRegistrar): void {
	systems.addSystem('enemyEliminationFeedback')
		.inGroup('gameplay')
		.inScreens(['playing'])
		.setPriority(SYSTEM_PRIORITIES.ANIMATION - 1)
		.addQuery('eliminations', { with: ['enemyElimination'], mutates: ['enemyElimination'] } as const)
		.addQuery('celebrations', { with: ['eliminationCelebration'], mutates: ['eliminationCelebration'] } as const)
		.setProcess(({ queries, dt, ecs }) => {
			const landed = new Set<number>();
			for (const entity of queries.eliminations) {
				const impact = entity.components.enemyElimination.impact;
				if (!impact || impact.landed < 1) continue;
				if (!impact.played) {
					impact.played = true;
					landed.add(entity.id);
				} else {
					impact.age = Math.min(ENEMY_SPLASH_SECONDS, impact.age + dt);
				}
			}
			// All landings in this frame share a pop; every enemy keeps its own burst.
			if (landed.size > 0) playSound('enemyPop');

			// Only the newest landing group is shown. Never queue stale callouts.
			const starting = queries.celebrations.filter(entity =>
				entity.components.eliminationCelebration.age === null
				&& entity.components.eliminationCelebration.enemyIds.some(id => landed.has(id)));
			const newest = starting.at(-1);
			for (const entity of queries.celebrations) {
				const celebration = entity.components.eliminationCelebration;
				if (newest && newest.id !== entity.id && (celebration.age !== null || starting.includes(entity))) {
					ecs.commands.removeEntity(entity.id);
					continue;
				}
				if (entity.id === newest?.id) {
					celebration.age = 0;
					playSound(splashSound(celebration.enemyIds.length));
				} else if (celebration.age !== null) {
					celebration.age += dt;
					if (celebration.age >= SPLASH_CELEBRATION_SECONDS) ecs.commands.removeEntity(entity.id);
				} else if (!queries.eliminations.some(member => celebration.enemyIds.includes(member.id))) {
					// Sources can disappear before landing (for example on restart).
					ecs.commands.removeEntity(entity.id);
				}
			}
		});
};
