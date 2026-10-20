import { ANIMATION_CONFIG, GAME_CONFIG } from '../config';
import type { EnemyType } from '../types/shared';
import type { GameEngine } from './Engine';
import {
	frogEliminated,
	lizardEliminated,
	spiderEliminated,
} from './assets';
import type { AllComponents, MathDifficulty } from './types';
import { cancelCoroutine } from 'ecspresso/plugins/scripting/coroutine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { startEnemyDeathAnimation } from './systems/AnimationSystem';

const ELIMINATED_IMAGES: Record<EnemyType, string> = {
	lizard: lizardEliminated,
	frog: frogEliminated,
	spider: spiderEliminated,
};

type EnemyForElimination = {
	id: number;
	components: Pick<AllComponents, 'enemy' | 'position' | 'timers'>;
};

export const beginEnemyElimination = function(
	ecs: GameEngine,
	enemy: EnemyForElimination,
	difficulty: MathDifficulty,
): void {
	const { enemy: enemyState, position, timers } = enemy.components;
	const enemyId = enemy.id;

	delete enemyState.plannedMove;
	delete enemyState.aiState;
	delete timers.enemyMove;
	delete timers.enemySpawnTelegraph;
	timers.enemyRespawn = createTimer(GAME_CONFIG.ENEMY_ELIMINATION.RESPAWN_SECONDS[difficulty]);

	if (enemyState.enemyType === 'frog') {
		cancelCoroutine(ecs, enemyId);
		delete timers.frogTongueWindup;
		ecs.commands.removeComponent(enemyId, 'frogTongue');
	}

	ecs.mutateComponent(enemyId, 'renderable', renderable => {
		renderable.imageSrc = ELIMINATED_IMAGES[enemyState.enemyType];
		delete renderable.spriteSheet;
	});
	ecs.commands.addComponent(enemyId, 'enemyElimination', {
		deathScale: ANIMATION_CONFIG.DEATH.SCALE_START,
	});
	startEnemyDeathAnimation(ecs, enemyId, position.rotation ?? 0);
};
