import { expect, test } from 'bun:test';
import { shouldPlaySkit } from './skitSequence';

test('intermissions follow only the four scheduled levels', () => {
	expect(Array.from({ length: 31 }, (_, level) => level).filter(shouldPlaySkit)).toEqual([3, 6, 9, 12]);
});
