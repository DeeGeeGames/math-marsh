import { tutorialSteps, type GameplayOnboardingSession } from './gameplayOnboarding';

export const shouldShowTutorialTouchGuidance = function(
	touchSupported: boolean,
	controllerConnected: boolean,
): boolean {
	return touchSupported && !controllerConnected;
};

type TutorialTouchGuidance = Readonly<{
	action: 'move' | 'eat';
	copy: string;
	caption: string;
}>;

export const tutorialTouchGuidance = function(session: GameplayOnboardingSession): TutorialTouchGuidance | undefined {
	if (!session.active) return undefined;
	const step = tutorialSteps(session.kind)[session.stepIndex];
	if (!step) return undefined;
	if (step.id === 'move') {
		return {
			action: 'move',
			copy: 'When playing, tap a lily pad to move there. Wait for the fly to arrive.',
			caption: 'Tap a pad → move',
		} as const;
	}
	if (step.id === 'eat' || step.id === 'eatFirstNumber' || step.id === 'finishEquation') {
		return {
			action: 'eat',
			copy: `${session.kind === 'basics' ? '' : `${step.copy} `}When playing, tap the number’s pad to move. Once the fly arrives, tap that same pad again to eat the number.`,
			caption: 'Arrive → tap again to eat',
		} as const;
	}
	return undefined;
};

// Decorative diagrams accompany the written instructions; they are not controls.
export const tutorialTouchIllustration = function(action: 'move' | 'eat'): string {
	const flyX = action === 'move' ? 42 : 158;
	return `
		<svg class="tutorial-tap-diagram" viewBox="0 0 220 70" aria-hidden="true" focusable="false">
			<ellipse cx="42" cy="38" rx="31" ry="23" fill="#70a946" />
			<ellipse cx="158" cy="38" rx="31" ry="23" fill="#70a946" />
			${action === 'move'
				? '<path d="M82 38h33m-9-8 9 8-9 8" fill="none" stroke="#fff7c6" stroke-width="3" />'
				: '<text x="158" y="58" text-anchor="middle" fill="#fff7c6" font-size="18" font-weight="800">8</text>'}
			<ellipse cx="${flyX - 8}" cy="29" rx="10" ry="6" fill="#fff7c6" />
			<ellipse cx="${flyX + 8}" cy="29" rx="10" ry="6" fill="#fff7c6" />
			<ellipse cx="${flyX}" cy="35" rx="6" ry="11" fill="#142e32" />
			<circle cx="158" cy="38" r="29" fill="none" stroke="#ffd76a" stroke-width="3" />
			<path d="m184 48 8 18 3-8 8-3Z" fill="#fff7c6" stroke="#142e32" stroke-width="2" />
		</svg>`;
};
