import { describe, expect, test } from 'bun:test';
import { SPRITES } from './assetCatalog';

describe('asset preview catalog', () => {
	test('lists each surprised enemy as a static single-frame sprite', () => {
		const eliminatedSprites = SPRITES.filter(sprite => sprite.key.endsWith('Eliminated'));
		expect(eliminatedSprites.map(sprite => sprite.key).sort()).toEqual([
			'frogEliminated',
			'lizardEliminated',
			'spiderEliminated',
		]);
		expect(eliminatedSprites.every(sprite => sprite.frameCount === 1 && sprite.fps === 0)).toBe(true);
	});
});
