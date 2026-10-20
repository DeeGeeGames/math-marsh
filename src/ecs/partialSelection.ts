import type { EquationModeState } from './types';

export const PARTIAL_SELECTION_DURATION_MS = 260;

/** Shared clock and identity for the pad and its equation slot. */
export const partialSelectionPresentation = function(
	mode: EquationModeState,
	problemId: number,
	currentTime: number,
	reducedMotion: boolean,
): { dip: number; scale: number; emphasis: number } {
	const effect = mode.partialSelection;
	const elapsed = effect ? currentTime - effect.startedAt : -1;
	if (!effect || effect.problemId !== problemId || mode.feedback
		|| mode.promptKind === 'selectResult'
		|| mode.selectedProblemIds.length >= mode.operandsRequired
		|| !mode.selectedProblemIds.includes(problemId)
		|| elapsed < 0 || elapsed >= PARTIAL_SELECTION_DURATION_MS) {
		return { dip: 0, scale: 1, emphasis: 0 };
	}
	const progress = elapsed / PARTIAL_SELECTION_DURATION_MS;
	// One press and a smaller rebound, with no movement in reduced motion.
	const dip = reducedMotion ? 0 : Math.sin(progress * Math.PI * 2) * (1 - progress);
	return {
		dip,
		scale: reducedMotion ? 1 : 1 + Math.sin(progress * Math.PI) * 0.18,
		emphasis: 1 - progress,
	};
};
