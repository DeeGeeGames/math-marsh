import { html, nothing, render, type TemplateResult } from 'lit-html';
import { GAME_CONFIG } from '../../config';
import { BOARD_SIZES } from '../../ecs/boardGeometry';
import { PRACTICE_SESSION_LENGTH, practiceFactExample, summarizePracticeSession } from '../../ecs/practiceSession';
import { practiceTopicEvidence, type PracticeTopicEvidence } from '../../ecs/practiceProgress';
import { PRACTICE_TOPICS, practiceTopic, practiceFacts, practiceFactLabel, type PracticeTopic } from '../../math/practiceTopics';
import type { EquationOperation, MathDifficulty } from '../../ecs/types';
import { difficultyLabels, isMathDifficulty, operationLabels } from '../labels';
import { createPracticeSetupState, practiceSetupSelection, updatePracticeSetup, type PracticeSetupAction } from '../practiceSetup';
import type { ScreenSpec } from '../screenTypes';
import { inputPromptsSlot, OVERLAY_BASE, type ScreenSpecActions } from './shared';

const OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];
const SYMBOLS: Record<EquationOperation, string> = { multiply: '×', divide: '÷', add: '+', subtract: '−' };
const PONDS: readonly MathDifficulty[] = ['easy', 'medium', 'expert'];
const RELATED_OPERATIONS: Readonly<Record<EquationOperation, string>> = { add: 'subtraction', subtract: 'addition', multiply: 'division', divide: 'multiplication' };

const topicTile = function(topic: PracticeTopic, summary: PracticeTopicEvidence): TemplateResult | typeof nothing {
	const fact = topic.facts[0];
	if (!fact) return nothing;
	const number = topic.operation === 'add' ? fact.result : topic.operation === 'divide' ? fact.right : fact.left;
	const caption = topic.kind === 'make' ? 'Make' : topic.operation === 'multiply' ? 'Times table' : 'Divide by';
	const complete = summary.status === 'Practiced';
	const status = complete ? 'All solved' : summary.status === 'New' ? 'New' : 'In progress';
	const filled = summary.total > 0 ? summary.solved / summary.total * 100 : 0;
	return html`<button type="button" class="practice-topic" data-practice-topic=${topic.id} data-complete=${String(complete)}
		aria-label=${`${topic.label}. ${status}. ${summary.attempted} facts practiced. ${summary.solved} of ${summary.total} facts solved at least once.`}>
		<span class="practice-topic-caption" aria-hidden="true">${caption}</span>
		<span class="practice-topic-ring" aria-hidden="true">
			<svg viewBox="0 0 110 110" focusable="false">
				<circle class="practice-topic-track" cx="55" cy="55" r="48"></circle>
				<circle class="practice-topic-fill" cx="55" cy="55" r="48" pathLength="100"
					stroke-dasharray=${`${filled} 100`} visibility=${filled > 0 ? 'visible' : 'hidden'}></circle>
			</svg>
			<strong class="practice-topic-number">${number}</strong>
			${complete ? html`<span class="practice-topic-check">✓</span>` : nothing}
		</span>
		<span class="practice-topic-status" aria-hidden="true">${status}</span>
	</button>`;
};

const persistenceNotice = function(actions: ScreenSpecActions): TemplateResult | typeof nothing {
	return actions.getPracticePersistence() === 'session-only'
		? html`<p class="practice-save-status" role="status">Practice progress lasts for this session only. Device saving is unavailable.</p>`
		: nothing;
};

const focus = function(root: HTMLElement, selector: string): void {
	const target = root.querySelector<HTMLButtonElement>(selector);
	target?.focus();
	target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

export const createPracticeScreenSpec = function(actions: ScreenSpecActions): ScreenSpec {
	let state = createPracticeSetupState();
	let activeRoot: HTMLElement | undefined;
	let starting = false;

	const evidence = function(summary: PracticeTopicEvidence): TemplateResult {
		const { status, attempted, solved, total } = summary;
		return html`<span class="practice-status">${status}</span>
			<span class="practice-evidence">${attempted} facts practiced · ${solved}/${total} solved at least once</span>`;
	};

	const home = function(): TemplateResult {
		const progress = actions.getPracticeProgress();
		const previous = progress.lastSelection;
		const previousTopic = previous ? practiceTopic(previous.topicId) : undefined;
		return html`<h1 class="pond-title text-gold">Practice</h1>
			${previous && previousTopic ? html`<button type="button" class="btn-success practice-continue" data-practice-continue>
				<strong>Continue: ${previousTopic.label}</strong>
				<span>${previous.related ? 'Related facts on' : 'Related facts off'} · ${difficultyLabels[previous.pond]} pond · start a fresh session</span>
			</button>` : html`<p class="practice-empty">${Object.keys(progress.facts).length === 0 ? 'Choose your first topic below. No Practice attempts yet.' : 'Choose a topic below.'}</p>`}
			<div class="practice-operation-grid" role="group" aria-label="Practice operations">
				${OPERATIONS.map(function(item): TemplateResult {
					const topics = PRACTICE_TOPICS.filter(function(topic): boolean { return topic.operation === item; });
					const practiced = topics.filter(function(topic): boolean { return practiceTopicEvidence(progress, topic).status === 'Practiced'; }).length;
					return html`<button type="button" class="mode-card practice-operation" data-practice-operation=${item} data-operation=${item}>
						<span class="mode-symbol" aria-hidden="true">${SYMBOLS[item]}</span><strong>${operationLabels[item]}</strong>
						<span>${topics.length} topics · ${practiced} practiced</span>
					</button>`;
				})}
			</div>`;
	};

	const collection = function(): TemplateResult {
		const progress = actions.getPracticeProgress();
		return html`<h1 class="pond-title text-gold">${operationLabels[state.operation]}</h1>
			<p class="practice-topic-hint">Fill each ring by solving different facts.</p>
			<div class="practice-topic-grid" role="group" aria-label=${`${operationLabels[state.operation]} topics`}>
				${PRACTICE_TOPICS.filter(function(topic): boolean { return topic.operation === state.operation; }).map(function(topic) {
					return topicTile(topic, practiceTopicEvidence(progress, topic));
				})}
			</div>`;
	};

	const preview = function(topic: PracticeTopic): TemplateResult {
		const { related, pond } = state;
		const facts = practiceFacts(topic, related);
		const inverse = facts.find(function(fact): boolean { return fact.operation !== topic.operation; });
		const sample = inverse ? [...facts.slice(0, 2), inverse] : facts.slice(0, 3);
		const summary = practiceTopicEvidence(actions.getPracticeProgress(), topic, related);
		return html`<h1 class="pond-title text-gold">${topic.label}</h1>
			<div class="practice-preview-evidence">${evidence(summary)}</div>
			<div class="practice-examples" aria-label="Example equations">${sample.map(function(fact, index): TemplateResult { return html`<span>${practiceFactExample(topic, fact, index)}</span>`; })}</div>
			<button type="button" class="btn-secondary practice-option" data-practice-related aria-pressed=${String(related)}>
				<strong>Related facts: ${related ? 'On' : 'Off'}</strong><span>Include related ${RELATED_OPERATIONS[topic.operation]} problems</span>
			</button>
			<div class="practice-pond-summary"><button type="button" class="btn-secondary" data-practice-change-pond><span>Pond: <strong>${difficultyLabels[pond]}</strong></span><span>Change pond</span></button></div>
			${summary.attempts > 0 ? html`<p class="practice-note">Topic accuracy: ${summary.accuracy === null ? 'No attempts' : `${Math.round(summary.accuracy * 100)}%`} · ${summary.revisit.length} facts to revisit</p>` : ''}
			<button type="button" class="btn-success practice-start" data-practice-start>Start practice · ${PRACTICE_SESSION_LENGTH} equations</button>`;
	};

	const pondChooser = function(): TemplateResult {
		return html`<h1 class="pond-title text-gold">Choose your pond</h1>
			<div class="practice-pond-grid" role="group" aria-label="Practice pond difficulty">${PONDS.map(function(item): TemplateResult {
				const board = BOARD_SIZES[item];
				const enemies = GAME_CONFIG.MATH_PROGRESSION.ENEMY_COUNT[item];
				return html`<button type="button" class="difficulty-choice ${item} practice-pond" data-practice-pond=${item} aria-pressed=${String(state.pond === item)}>
					<strong>${difficultyLabels[item]}</strong><span>${board.width} × ${board.height} spaces</span><span>${enemies} ${enemies === 1 ? 'enemy' : 'enemies'}</span>
				</button>`;
			})}</div>
			<button type="button" class="btn-success" data-practice-pond-done>Done</button>`;
	};

	const contentForView = function(): TemplateResult {
		switch (state.view) {
			case 'home': return home();
			case 'collection': return collection();
			case 'preview': return preview(state.topic);
			case 'pond': return pondChooser();
		}
	};

	const refresh = function(root: HTMLElement, focusSelector?: string): void {
		const content = root.querySelector<HTMLElement>('[data-practice-content]');
		if (!content) return;
		render(html`<button type="button" class="btn-secondary setup-back" data-practice-back>‹ Back</button>
			${contentForView()}
			${persistenceNotice(actions)}`, content);
		if (focusSelector) focus(root, focusSelector);
	};

	const update = function(root: HTMLElement, action: PracticeSetupAction, focusSelector: string): void {
		state = updatePracticeSetup(state, action);
		refresh(root, focusSelector);
	};

	const back = function(root: HTMLElement): void {
		switch (state.view) {
			case 'home': actions.goToMenu(); return;
			case 'pond': update(root, { type: 'back' }, '[data-practice-change-pond]'); return;
			case 'preview': update(root, { type: 'back' }, `[data-practice-topic="${state.topic.id}"]`); return;
			case 'collection': update(root, { type: 'back' }, `[data-practice-operation="${state.operation}"]`); return;
		}
	};

	return {
		id: 'practice-screen', className: `${OVERLAY_BASE} app-background`,
		html: `<div class="practice-shell"><section class="practice-content" data-practice-content></section>${inputPromptsSlot()}</div>`,
		prompts: [{ action: 'select', label: 'Select' }, { action: 'back', label: 'Back' }], promptPlacement: 'panel',
		initialFocusSelector: '[data-practice-continue], [data-practice-operation]',
		wire: function(root): void {
			activeRoot = root;
			root.addEventListener('click', function(event): void {
				if (!(event.target instanceof Element)) return;
				const button = event.target.closest<HTMLButtonElement>('button');
				if (!button || !root.contains(button)) return;
				if (button.hasAttribute('data-practice-back')) { back(root); return; }
				const nextOperation = OPERATIONS.find(function(item): boolean { return item === button.dataset.practiceOperation; });
				if (nextOperation) { update(root, { type: 'operation', operation: nextOperation }, '[data-practice-topic]'); return; }
				const nextTopic = practiceTopic(button.dataset.practiceTopic);
				if (nextTopic) { update(root, { type: 'topic', topic: nextTopic }, '[data-practice-start]'); return; }
				if (button.hasAttribute('data-practice-continue')) {
					const selection = actions.getPracticeProgress().lastSelection;
					if (selection) update(root, { type: 'continue', selection }, '[data-practice-start]');
					return;
				}
				if (button.hasAttribute('data-practice-related')) { update(root, { type: 'related' }, '[data-practice-related]'); return; }
				if (button.hasAttribute('data-practice-change-pond')) { update(root, { type: 'openPond' }, `[data-practice-pond="${state.pond}"]`); return; }
				const nextPond = button.dataset.practicePond;
				if (isMathDifficulty(nextPond)) { update(root, { type: 'pond', pond: nextPond }, `[data-practice-pond="${nextPond}"]`); return; }
				if (button.hasAttribute('data-practice-pond-done')) { update(root, { type: 'closePond' }, '[data-practice-change-pond]'); return; }
				const selection = practiceSetupSelection(state);
				if (button.hasAttribute('data-practice-start') && selection && !starting) {
					starting = true; button.disabled = true;
					actions.startPractice(selection);
				}
			});
		},
		onShow: function(root): void { state = updatePracticeSetup(state, { type: 'reset' }); starting = false; refresh(root); },
		onCancel: function(): void { if (activeRoot) back(activeRoot); },
	};
};

export const createPracticeResultsScreenSpec = function(actions: ScreenSpecActions): ScreenSpec {
	return {
		id: 'practice-results-screen', className: `${OVERLAY_BASE} app-background`,
		html: `<div class="practice-results-layout"><section class="game-over-shell practice-results" data-practice-results></section>${inputPromptsSlot()}</div>`,
		prompts: [{ action: 'select', label: 'Select' }, { action: 'back', label: 'Main menu' }], promptPlacement: 'panel',
		initialFocusSelector: '[data-practice-again]',
		onShow: function(root): void {
			const content = root.querySelector<HTMLElement>('[data-practice-results]');
			if (!content) return;
			const session = actions.getPracticeSession();
			const topic = session ? practiceTopic(session.selection.topicId) : undefined;
			const summary = session ? summarizePracticeSession(session) : undefined;
			const attempts = summary?.attempts ?? 0;
			const revisit = summary?.revisit ?? [];
			render(html`<h1 class="game-over-title">${session?.outcome === 'completed' ? 'Practice complete' : 'Partial practice'}</h1>
				<p class="practice-results-topic">${topic?.label ?? 'Practice'}</p>
				<p class="run-result">${summary?.solved ?? 0}/${PRACTICE_SESSION_LENGTH} equations solved</p>
				<p>${!summary || summary.accuracy === null ? 'No submitted attempts yet.' : `${Math.round(summary.accuracy * 100)}% accuracy · ${summary.correct} correct of ${attempts} attempts`}</p>
				<section class="practice-revisit-panel" aria-labelledby="practice-revisit-heading">
					<h2 id="practice-revisit-heading">Facts to revisit</h2>
					${revisit.length ? html`<ul class="practice-revisit">${revisit.map(function(fact): TemplateResult { return html`<li>${practiceFactLabel(fact)}</li>`; })}</ul>` : html`<p>${attempts ? 'No wrong attempts in this session.' : 'Submit answers to build a revisit list.'}</p>`}
				</section>
				${persistenceNotice(actions)}
				<div class="game-over-actions"><button type="button" class="btn-success" data-practice-again ?disabled=${!session} @click=${actions.repeatPractice}>Practice again</button>
				<button type="button" class="btn-primary" @click=${actions.openPractice}>Choose another topic</button>
				<button type="button" class="btn-secondary" @click=${actions.goToMenu}>Main menu</button></div>`, content);
		},
		onCancel: actions.goToMenu,
	};
};
