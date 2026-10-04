import { expect, test } from 'bun:test';
import { skitProgressFromStoredValue, unlockSkitForCompletedLevel, type SkitProgress } from './skitProgress';

test('completing level three unlocks Snack Break once without changing existing progress', () => {
	const locked: SkitProgress = [];
	for (const level of [0, 1, 2, 4, 5, 7, 8, 10, 11, 13]) {
		expect(unlockSkitForCompletedLevel(locked, level)).toBe(locked);
	}
	const unlocked = unlockSkitForCompletedLevel(locked, 3);
	expect(unlocked).toEqual(['snack-break']);
	expect(locked).toEqual([]);
	expect(unlockSkitForCompletedLevel(unlocked, 3)).toBe(unlocked);
	expect(unlockSkitForCompletedLevel(unlocked, 4)).toBe(unlocked);
	expect(skitProgressFromStoredValue(JSON.stringify(unlocked))).toEqual(unlocked);
});

test('scene progress validates saved data and deduplicates known scene IDs', () => {
	expect(skitProgressFromStoredValue('["snack-break","snack-break",42,"unknown"]')).toEqual(['snack-break']);
	for (const stored of [null, '', '{', '{}', 'null', '"snack-break"', '["unknown"]']) {
		expect(skitProgressFromStoredValue(stored)).toEqual([]);
	}
	expect(skitProgressFromStoredValue(JSON.stringify(['snack-break']))).toEqual(['snack-break']);
});

test('new scenes add to existing saved progress without replacing Snack Break', () => {
	const oldProgress = skitProgressFromStoredValue('["snack-break"]');
	const all = [6, 9, 12].reduce(unlockSkitForCompletedLevel, oldProgress);
	expect(all).toEqual(['snack-break', 'the-shortcut', 'do-not-disturb', 'dinner-committee']);
	expect(skitProgressFromStoredValue(JSON.stringify(all))).toEqual(all);
	expect(oldProgress).toEqual(['snack-break']);
});
