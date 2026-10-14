import type { EquationOperation } from '../../ecs/types';
import { PRACTICE_FINAL_STEP } from '../../ecs/practiceSteps';
import { skitById } from '../../ecs/skitSequence';
import { operationLabels, isEquationOperation } from '../labels';
import type { ScreenSpec } from '../screenTypes';
import { $ } from '../dom';
import { BTN_CHROME, BTN_SIZE, inputPromptsSlot, OVERLAY_BASE, type ScreenSpecActions } from './shared';

const PRACTICE_OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];

const progressLabel = function(currentStep: number, highestUnlockedStep: number): string {
	return `Step ${currentStep} of ${PRACTICE_FINAL_STEP} · Highest ${highestUnlockedStep}`;
};

const persistenceLabel = function(persistence: ReturnType<ScreenSpecActions['getPracticeProgressPersistence']>): string {
	return persistence === 'persistent'
		? 'Device saving is available.'
		: 'Progress is available for this session only.';
};

const assessmentLabel = function(
	correctAnswers: number,
	incorrectAnswers: number,
	activeSeconds?: number,
	expectedSecondsPerCorrect?: number,
): string {
	const total = correctAnswers + incorrectAnswers;
	const accuracy = total > 0 ? Math.round(correctAnswers / total * 100) : 0;
	const timing = activeSeconds !== undefined && expectedSecondsPerCorrect !== undefined
		? ` · ${activeSeconds.toFixed(1)} active seconds · ${expectedSecondsPerCorrect.toFixed(1)} budget seconds per correct`
		: ' · timing unavailable';
	return `${correctAnswers} correct · ${incorrectAnswers} incorrect · ${accuracy}% accuracy${timing}`;
};

export function createPracticeSelectScreenSpec(actions: ScreenSpecActions): ScreenSpec {
	return {
		id: 'practice-select-screen',
		className: `${OVERLAY_BASE} app-background`,
		html: `
			<div class="practice-shell">
				<header class="practice-heading">
					<h1 class="pond-title text-gold drop-shadow-lg">Practice</h1>
					<p>Choose one operation for this run. Solve six equations to check your progress.</p>
				</header>
				<div class="practice-operation-grid" role="group" aria-label="Practice operation">
					${PRACTICE_OPERATIONS.map(operation => `
						<button type="button" class="practice-operation-card" data-operation="${operation}">
							<span class="practice-operation-name">${operationLabels[operation]}</span>
							<span class="practice-operation-progress" data-progress-for="${operation}"></span>
						</button>
					`).join('')}
				</div>
				<p id="practice-save-status" class="practice-save-status" aria-live="polite"></p>
				<button id="practice-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.md}">← Back to Menu</button>
				${inputPromptsSlot()}
			</div>
		`,
		prompts: [
			{ action: 'select', label: 'Start operation' },
			{ action: 'back', label: 'Back' },
		],
		promptPlacement: 'panel',
		wire: (root): void => {
			root.querySelectorAll<HTMLButtonElement>('[data-operation]').forEach(button => {
				button.addEventListener('click', () => {
					if (isEquationOperation(button.dataset.operation)) actions.startPractice(button.dataset.operation);
				});
			});
			$(root, '#practice-menu-btn').addEventListener('click', actions.goToMenu);
		},
		onShow: function(root): void {
			const progress = actions.getPracticeProgress();
			PRACTICE_OPERATIONS.forEach(operation => {
				const track = progress[operation];
				const label = $<HTMLElement>(root, `[data-progress-for="${operation}"]`);
				label.textContent = progressLabel(track.currentStep, track.highestUnlockedStep);
			});
			$(root, '#practice-save-status').textContent = persistenceLabel(actions.getPracticeProgressPersistence());
		},
		onCancel: actions.goToMenu,
	};
}


const resultCopy = function(actions: ScreenSpecActions): {
	heading: string;
	detail: string;
	sample: string;
	sceneNames: readonly string[];
} {
	const summary = actions.getPracticeRoundSummary();
	if (!summary) return { heading: 'Practice', detail: 'Choose an operation to begin.', sample: '', sceneNames: [] };
	const outcome = summary.outcome;
	const sample = assessmentLabel(
		summary.assessment.correctAnswers,
		summary.assessment.incorrectAnswers,
		summary.assessment.activeSeconds,
		summary.assessment.expectedSecondsPerCorrect,
	);
	if (outcome.kind === 'invalid') {
		return { heading: 'Progress check unavailable', detail: 'This practice check could not be evaluated.', sample, sceneNames: [] };
	}
	if (outcome.kind === 'insufficientSample') {
		return {
			heading: 'Practice ended early',
			detail: `Solve at least six equations to check Step ${summary.assessedStep}. Your progress and speed streak were kept.`,
			sample,
			sceneNames: [],
		};
	}
	if (outcome.kind === 'stayed') {
		return {
			heading: 'Try this step again',
			detail: `Accuracy was below 80%. Repeat Step ${summary.assessedStep}; your speed streak has reset.`,
			sample,
			sceneNames: [],
		};
	}
	const step = outcome.progress.currentStep;
	const movement = outcome.advanceBy === 0
		? `Step ${summary.assessedStep} is complete. You are already at the final Step ${step}.`
		: `Step ${summary.assessedStep} complete. You advanced ${outcome.advanceBy} step${outcome.advanceBy === 1 ? '' : 's'} to Step ${step}.`;
	const speed = outcome.accelerated
		? `Fast accuracy streak ${outcome.progress.accelerationStreak}.`
		: 'Speed streak reset.';
	return {
		heading: 'Practice check complete',
		detail: `${movement} ${speed}`,
			sample,
		sceneNames: summary.unlockedSceneIds.map(id => skitById(id).title),
	};
};

export function createPracticeResultScreenSpec(actions: ScreenSpecActions): ScreenSpec {
	return {
		id: 'practice-result-screen',
		className: `${OVERLAY_BASE} app-background`,
		html: `
			<div class="practice-result-panel">
				<h1 id="practice-result-heading" class="pond-title text-gold drop-shadow-lg">Practice check complete</h1>
				<p id="practice-result-detail" class="practice-result-detail" aria-live="polite"></p>
				<p id="practice-result-sample" class="practice-result-sample"></p>
				<p id="practice-scenes-unlocked" class="practice-scenes-unlocked"></p>
				<p id="practice-result-save-status" class="practice-save-status"></p>
				<div class="practice-result-actions">
					<button id="practice-continue-btn" class="btn-success ${BTN_CHROME} ${BTN_SIZE.lgResponsive}">Continue Practice</button>
					<button id="practice-menu-btn" class="btn-secondary ${BTN_CHROME} ${BTN_SIZE.mdResponsive}">Main Menu</button>
				</div>
				${inputPromptsSlot()}
			</div>
		`,
		prompts: [{ action: 'select', label: 'Continue' }],
		promptPlacement: 'panel',
		wire: (root): void => {
			$(root, '#practice-continue-btn').addEventListener('click', () => {
				const summary = actions.getPracticeRoundSummary();
				if (summary) actions.startPractice(summary.operation);
			});
			$(root, '#practice-menu-btn').addEventListener('click', actions.goToMenu);
		},
		onShow: function(root): void {
			const result = resultCopy(actions);
			$(root, '#practice-result-heading').textContent = result.heading;
			$(root, '#practice-result-detail').textContent = result.detail;
			$(root, '#practice-result-sample').textContent = result.sample;
			$(root, '#practice-scenes-unlocked').textContent = result.sceneNames.length > 0
				? `Scenes unlocked: ${result.sceneNames.join(', ')}`
				: '';
			$(root, '#practice-result-save-status').textContent = persistenceLabel(actions.getPracticeProgressPersistence());
			const summary = actions.getPracticeRoundSummary();
			$<HTMLButtonElement>(root, '#practice-continue-btn').disabled = summary === null;
		},
		onCancel: actions.goToMenu,
	};
}
