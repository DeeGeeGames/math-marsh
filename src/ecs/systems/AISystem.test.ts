import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import type { GameEngine } from '../Engine';
import { BOARD_SIZES } from '../boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { gridCells } from '../lilyPads';
import { GAME_CONFIG } from '../../config';
import { addAISystemToEngine } from './AISystem';

describe('AI board bounds', () => {
	Object.entries(BOARD_SIZES).forEach(([difficulty, board]) => {
		test(`${difficulty} keeps all AI behaviors and patrol waypoints inside the active board`, async () => {
			await Promise.all((['chase', 'patrol', 'random', 'guard'] as const).map(async behavior => {
				const world = ECSpresso.create<ConfigOf<GameEngine>>().withPlugin(createTweenPlugin()).build();
				world.setResource('board', board);
				world.setResource('currentLevel', 1);
				addAISystemToEngine(world);
				await world.initialize();
				const playerPosition = gridToPixel(0, 0);
				world.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: {} });
				gridCells(board).forEach(cell => {
					const position = gridToPixel(cell.x, cell.y);
					world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
				});
				const position = gridToPixel(board.width - 1, board.height - 1);
				world.spawn({ ...enemyComponents(position.x, position.y, 'lizard', behavior), timers: {} });
				world.update(0.01);
				world.update(2);
				const enemy = world.getEntitiesWithQuery(['enemy', 'position'])[0];
				if (!enemy) throw new Error('AI fixture lost its enemy');
				expect(enemy.components.position.x).toBeGreaterThanOrEqual(0);
				expect(enemy.components.position.y).toBeGreaterThanOrEqual(0);
				expect(enemy.components.position.x).toBeLessThan(board.width * GAME_CONFIG.GRID.CELL_SIZE);
				expect(enemy.components.position.y).toBeLessThan(board.height * GAME_CONFIG.GRID.CELL_SIZE);
				expect((enemy.components.enemy.waypoints ?? []).every(cell => cell.x < board.width && cell.y < board.height)).toBe(true);
				await world.dispose();
			}));
		});
	});
});
