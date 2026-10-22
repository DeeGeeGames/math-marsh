import { describe, expect, test } from 'bun:test';
import {
	activePlayerProfile,
	createPlayerProfile,
	deletePlayerProfile,
	initialPlayerLearnerData,
	renamePlayerProfile,
	switchActivePlayerProfile,
	updateActivePlayerProfile,
} from './rules';
import type { PlayerLearnerData, PlayerProfilesState } from './types';

const createLegacyLearnerData = function(): PlayerLearnerData {
	return {
		mathProgress: {
			add: { currentStep: 4, highestUnlockedStep: 7 },
			subtract: { currentStep: 3, highestUnlockedStep: 5 },
			multiply: { currentStep: 2, highestUnlockedStep: 6 },
			divide: { currentStep: 1, highestUnlockedStep: 4 },
		},
		onboarding: { basics: 'completed', operands: 'skipped', operandAndResult: 'pending' },
		skitProgress: ['snack-break'],
		practiceProgress: {
			facts: {},
			lastSelection: null,
			canPersist: true,
		},
	};
};

const freezeLearnerData = function(data: PlayerLearnerData): PlayerLearnerData {
	Object.freeze(data.mathProgress.add);
	Object.freeze(data.mathProgress.subtract);
	Object.freeze(data.mathProgress.multiply);
	Object.freeze(data.mathProgress.divide);
	Object.freeze(data.mathProgress);
	Object.freeze(data.onboarding);
	Object.freeze(data.skitProgress);
	Object.freeze(data.practiceProgress.facts);
	Object.freeze(data.practiceProgress);
	return Object.freeze(data);
};

const freezeState = function(state: PlayerProfilesState): PlayerProfilesState {
	state.profiles.forEach(profile => {
		freezeLearnerData(profile);
		Object.freeze(profile);
	});
	Object.freeze(state.profiles);
	freezeLearnerData(state.initialLearnerData);
	return Object.freeze(state);
};

describe('pure player profile rules', () => {
	test('creates, renames, switches, and deletes profiles without mutating frozen inputs', () => {
		const legacyLearnerData = freezeLearnerData(createLegacyLearnerData());
		const emptyState = freezeState({
			profiles: [],
			activeProfileId: null,
			initialLearnerData: legacyLearnerData,
			persistence: 'session-only',
			canPersist: false,
		});

		const firstResult = createPlayerProfile(emptyState, 'Maya', 'maya');
		expect(firstResult.error).toBeUndefined();
		expect(firstResult.state.profiles[0]).toMatchObject({
			id: 'maya',
			name: 'Maya',
			mathProgress: legacyLearnerData.mathProgress,
			onboarding: legacyLearnerData.onboarding,
			skitProgress: legacyLearnerData.skitProgress,
			practiceProgress: legacyLearnerData.practiceProgress,
		});
		expect(firstResult.state.profiles[0]?.mathProgress).toBe(legacyLearnerData.mathProgress);
		expect(firstResult.state.canPersist).toBe(false);

		const firstState = freezeState(firstResult.state);
		const secondResult = createPlayerProfile(firstState, 'Jordan', 'jordan');
		expect(secondResult.error).toBeUndefined();
		const maya = secondResult.state.profiles.find(profile => profile.id === 'maya');
		const jordan = secondResult.state.profiles.find(profile => profile.id === 'jordan');
		if (!maya || !jordan) throw new Error('Expected both profiles to be present');
		expect(jordan.mathProgress).not.toBe(maya.mathProgress);
		expect(jordan.onboarding).not.toBe(maya.onboarding);
		expect(jordan.skitProgress).not.toBe(maya.skitProgress);
		expect(jordan.skitProgress).toEqual([]);
		expect(secondResult.state.canPersist).toBe(false);

		const secondState = freezeState(secondResult.state);
		const renameResult = renamePlayerProfile(secondState, 'maya', 'Maya G.');
		expect(renameResult.error).toBeUndefined();
		expect(renameResult.state.profiles[0]?.name).toBe('Maya G.');
		expect(renameResult.state.profiles[1]).toBe(secondState.profiles[1]);
		expect(secondState.profiles[0]?.name).toBe('Maya');

		const renamedState = freezeState(renameResult.state);
		const switchResult = switchActivePlayerProfile(renamedState, 'maya');
		expect(switchResult.error).toBeUndefined();
		expect(switchResult.state.activeProfileId).toBe('maya');
		expect(activePlayerProfile(switchResult.state)?.name).toBe('Maya G.');
		expect(switchResult.state.canPersist).toBe(false);

		const switchedState = freezeState(switchResult.state);
		const deleteResult = deletePlayerProfile(switchedState, 'maya');
		expect(deleteResult.error).toBeUndefined();
		expect(deleteResult.state.profiles.map(profile => profile.id)).toEqual(['jordan']);
		expect(deleteResult.state.activeProfileId).toBe('jordan');
		expect(switchedState.profiles.map(profile => profile.id)).toEqual(['maya', 'jordan']);
		expect(deleteResult.state.canPersist).toBe(false);
	});

	test('returns the same state when the active profile update is a no-op', () => {
		const result = createPlayerProfile({
			profiles: [],
			activeProfileId: null,
			initialLearnerData: initialPlayerLearnerData(),
			persistence: 'session-only',
			canPersist: false,
		}, 'Maya', 'maya');
		if (result.error) throw new Error(`Could not create test profile: ${result.error}`);

		expect(updateActivePlayerProfile(result.state, profile => profile)).toBe(result.state);
	});
});
