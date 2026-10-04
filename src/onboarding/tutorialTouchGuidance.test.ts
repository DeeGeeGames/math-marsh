import { describe, expect, test } from 'bun:test';
import { createGameplayOnboardingSession } from './gameplayOnboarding';
import { shouldShowTutorialTouchGuidance, tutorialTouchGuidance } from './tutorialTouchGuidance';

describe('tutorial touch guidance', () => {
	test('requires touch support and suppresses guidance for a connected controller', () => {
		expect(shouldShowTutorialTouchGuidance(true, false)).toBe(true);
		expect(shouldShowTutorialTouchGuidance(true, true)).toBe(false);
		expect(shouldShowTutorialTouchGuidance(false, false)).toBe(false);
		expect(shouldShowTutorialTouchGuidance(false, true)).toBe(false);
	});

	test('teaches arrival before the second tap, including later equation tutorials', () => {
		for (const kind of ['basics', 'operands', 'operandAndResult'] as const) {
			const session = createGameplayOnboardingSession(kind, true, { kind: 'previousScreen' });
			if (!session.active) throw new Error('Expected an active tutorial');
			const guidance = tutorialTouchGuidance({ ...session, stepIndex: 2 });
			expect(guidance?.action).toBe('eat');
			expect(guidance?.copy).toContain('Once the fly arrives, tap that same pad again');
		}
	});

	test('keeps non-control explanations and inactive sessions unchanged', () => {
		const session = createGameplayOnboardingSession('basics', true, { kind: 'previousScreen' });
		if (!session.active) throw new Error('Expected an active tutorial');
		expect(tutorialTouchGuidance(session)?.action).toBe('move');
		expect(tutorialTouchGuidance({ ...session, stepIndex: 1 })).toBeUndefined();
		expect(tutorialTouchGuidance({ active: false })).toBeUndefined();
	});

	test('retains the equation selection order in the later tutorials', () => {
		const session = createGameplayOnboardingSession('operandAndResult', true, { kind: 'previousScreen' });
		if (!session.active) throw new Error('Expected an active tutorial');
		expect(tutorialTouchGuidance({ ...session, stepIndex: 4 })?.copy)
			.toContain('Always eat the missing number first, then the result.');
	});
});
