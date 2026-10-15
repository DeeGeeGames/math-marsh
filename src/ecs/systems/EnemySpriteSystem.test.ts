import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { ANIMATION_CONFIG } from '../../config';
import { spiderWalkSide } from '../assets';
import type { GameEngine } from '../Engine';
import { enemyComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { startEnemyGridMovement, startEnemyGridTurn } from './EnemySpriteSystem';

describe('spider side-walk animation', () => {
	test('uses seven frames across the normal movement duration', async () => {
		const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
		await world.initialize();
		try {
			const start = gridToPixel(1, 1);
			const target = gridToPixel(2, 1);
			const spider = world.spawn(enemyComponents(start.x, start.y, 'spider', 'patrol'));
			startEnemyGridMovement(world, spider.id, 'spider', { x: 1, y: 1 }, { x: 2, y: 1 }, target.x, target.y);
			world.update(0);

			const steps = world.getComponent(spider.id, 'spriteAnimation')?.steps;
			const walkStep = steps?.[1];
			expect(walkStep?.imageSrc).toBe(spiderWalkSide);
			expect(walkStep?.frameCount).toBe(7);
			expect(walkStep?.duration).toBeCloseTo(ANIMATION_CONFIG.MOVEMENT_DURATION / 1000 - 0.18);
		} finally {
			await world.dispose();
		}
	});

	test('holds the last valid side-walk frame after turning', async () => {
		const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
		await world.initialize();
		try {
			const start = gridToPixel(1, 1);
			const spider = world.spawn(enemyComponents(start.x, start.y, 'spider', 'patrol'));
			startEnemyGridTurn(world, spider.id, 'spider', { x: 1, y: 1 }, { x: 2, y: 1 });
			world.update(0);

			const idleStep = world.getComponent(spider.id, 'spriteAnimation')?.steps.at(-1);
			expect(idleStep?.imageSrc).toBe(spiderWalkSide);
			expect(idleStep?.frameCount).toBe(7);
			expect(idleStep?.staticFrameIndex).toBe(6);
		} finally {
			await world.dispose();
		}
	});
});
