import { describe, expect, test } from 'bun:test';
import { legacyLearnerData, parsedProfileStore, serializedProfileStore } from './codec';
import { initialPlayerLearnerData } from './rules';
import type { PlayerProfile } from './types';

const createProfile = function(id: string, name: string): PlayerProfile {
	return { id, name, ...initialPlayerLearnerData() };
};

const createProfileRecord = function(id: string, name: string): Readonly<{ id: string; name: string; learnerData: unknown }> {
	const profile = createProfile(id, name);
	return {
		id: profile.id,
		name: profile.name,
		learnerData: {
			mathProgress: profile.mathProgress,
			onboarding: profile.onboarding,
			skitProgress: profile.skitProgress,
			practiceProgress: { version: 1, facts: {}, lastSelection: null },
		},
	};
};

describe('player profile codec', () => {
	test('salvages valid learner fields from a partially invalid profile', () => {
		const stored = JSON.stringify({
			version: 1,
			profiles: [{
				id: 'maya',
				name: ' Maya ',
				learnerData: {
					mathProgress: {
						add: { currentStep: 5, highestUnlockedStep: 7 },
						subtract: { currentStep: 8, highestUnlockedStep: 3 },
						multiply: { currentStep: 2, highestUnlockedStep: 4 },
					},
					onboarding: { basics: 'completed', operands: 42, operandAndResult: 'skipped' },
					skitProgress: ['snack-break', 'not-a-scene'],
					practiceProgress: {
						version: 1,
						facts: {
							'add:1:2': { attempts: 2, correct: 1 },
							'not-a-fact': { attempts: 4, correct: 4 },
						},
						lastSelection: { topicId: 'unknown-topic', related: true, pond: 'easy' },
					},
				},
			}],
		});
		const parsed = parsedProfileStore(stored);
		expect(parsed?.profiles).toHaveLength(1);
		const profile = parsed?.profiles[0];
		if (!profile) throw new Error('Expected the valid portions of the profile to be retained');

		expect(profile.name).toBe('Maya');
		expect(profile.mathProgress).toEqual({
			add: { currentStep: 5, highestUnlockedStep: 7 },
			subtract: { currentStep: 1, highestUnlockedStep: 1 },
			multiply: { currentStep: 2, highestUnlockedStep: 4 },
			divide: { currentStep: 1, highestUnlockedStep: 1 },
		});
		expect(profile.onboarding).toEqual({ basics: 'completed', operands: 'pending', operandAndResult: 'skipped' });
		expect(profile.skitProgress).toEqual(['snack-break']);
		expect(profile.practiceProgress.facts).toEqual({ 'add:1:2': { attempts: 2, correct: 1 } });
		expect(profile.practiceProgress.lastSelection).toBeNull();
	});

	test('converts legacy learner values into independently parsed learner data', () => {
		const learnerData = legacyLearnerData({
			math: JSON.stringify({
				version: 1,
				tracks: { add: { currentStep: 5, highestUnlockedStep: 7 } },
			}),
			skits: JSON.stringify(['snack-break', 'not-a-scene']),
			onboarding: { basics: 'completed', operands: 'skipped', operandAndResult: null },
		});

		expect(learnerData.mathProgress.add).toEqual({ currentStep: 5, highestUnlockedStep: 7 });
		expect(learnerData.mathProgress.subtract).toEqual({ currentStep: 1, highestUnlockedStep: 1 });
		expect(learnerData.skitProgress).toEqual(['snack-break']);
		expect(learnerData.onboarding).toEqual({ basics: 'completed', operands: 'skipped', operandAndResult: 'pending' });
		expect(learnerData.practiceProgress).toEqual({ facts: {}, lastSelection: null, canPersist: true });
	});

	test('rejects a missing or unsupported outer store version', () => {
		expect(parsedProfileStore(JSON.stringify({ profiles: [] }))).toBeUndefined();
		expect(parsedProfileStore(JSON.stringify({ version: 2, profiles: [] }))).toBeUndefined();
	});

	test('roundtrips an unknown Practice payload unchanged', () => {
		const futurePracticePayload = {
			version: 9,
			facts: { 'new-engine-fact': { attempts: 3, correct: 2, streak: 4 } },
			lastSelection: { topicId: 'future-topic', related: true, pond: 'expert' },
			futureField: { enabled: true, revision: 4 },
		};
		const stored = JSON.stringify({
			version: 1,
			profiles: [{
				id: 'future',
				name: 'Future Learner',
				learnerData: {
					mathProgress: {},
					onboarding: {},
					skitProgress: [],
					practiceProgress: futurePracticePayload,
				},
			}],
		});
		const parsed = parsedProfileStore(stored);
		if (!parsed) throw new Error('Expected the version 1 profile store to parse');
		const profile = parsed.profiles[0];
		if (!profile) throw new Error('Expected the future learner profile to parse');

		expect(profile.practiceProgress.canPersist).toBe(false);
		expect(profile.practiceProgress.preservedValue).toEqual(futurePracticePayload);
		const serialized = serializedProfileStore(parsed.profiles);
		expect(serialized).toContain(JSON.stringify(futurePracticePayload));
		const reparsed = parsedProfileStore(serialized);
		expect(reparsed?.profiles[0]?.practiceProgress.preservedValue).toEqual(futurePracticePayload);
	});

	test('filters duplicate IDs and names independently, including names on a rejected duplicate ID', () => {
		const parsed = parsedProfileStore(JSON.stringify({
			version: 1,
			profiles: [
				createProfileRecord('shared-id', 'Ada'),
				createProfileRecord('shared-id', 'Bea'),
				createProfileRecord('third-id', 'BEA'),
				createProfileRecord('fourth-id', 'ADA'),
				createProfileRecord('fifth-id', 'Casey'),
			],
		}));

		expect(parsed?.profiles.map(profile => profile.id)).toEqual(['shared-id', 'fifth-id']);
		expect(parsed?.profiles.map(profile => profile.name)).toEqual(['Ada', 'Casey']);
	});
});
