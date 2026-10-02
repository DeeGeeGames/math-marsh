import { GAME_CONFIG } from '../config';
import type { BoardSize } from './boardGeometry';

export function levelClearTarget(
	board: BoardSize,
	enemyCount: number,
	operandsRequired: number,
): number {
	const capacity = board.width * board.height;
	const normalTarget = Math.ceil(capacity * GAME_CONFIG.GAMEPLAY.LEVEL_CLEAR_RATIO);
	const cappedTarget = capacity - enemyCount - (operandsRequired - 1);
	// A crowded custom roster must not complete a level before an answer is eaten.
	return Math.max(1, Math.min(normalTarget, cappedTarget));
}
