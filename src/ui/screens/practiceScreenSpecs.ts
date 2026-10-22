import { html, nothing, render, type TemplateResult } from 'lit-html';
import { GAME_CONFIG } from '../../config';
import { BOARD_SIZES } from '../../ecs/boardGeometry';
import { PRACTICE_SESSION_LENGTH, practiceFactExample, type PracticeSelection } from '../../ecs/practiceSession';
import { practiceTopicEvidence, practiceTopicStatus } from '../../ecs/practiceProgress';
import { PRACTICE_TOPICS, practiceTopic, practiceFacts, practiceFactLabel, type PracticeTopic } from '../../math/practiceTopics';
import type { EquationOperation, MathDifficulty } from '../../ecs/types';
import { difficultyLabels, isMathDifficulty, operationLabels } from '../labels';
import type { ScreenSpec } from '../screenTypes';
import { inputPromptsSlot, OVERLAY_BASE, type ScreenSpecActions } from './shared';

const OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];
const SYMBOLS: Record<EquationOperation, string> = { multiply: '×', divide: '÷', add: '+', subtract: '−' };
const PONDS: readonly MathDifficulty[] = ['easy', 'medium', 'expert'];
type PracticeView = 'home' | 'collection' | 'preview' | 'pond';

const persistenceCopy = function(actions: ScreenSpecActions): string {
	return actions.getPracticePersistence() === 'persistent'
		? 'Practice progress is saved for this player.'
		: 'Practice progress lasts for this session only. Device saving is unavailable.';
};

const focus = function(root: HTMLElement, selector: string): void {
	const target = root.querySelector<HTMLButtonElement>(selector);
	target?.focus();
	target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

export const createPracticeScreenSpec = function(actions: ScreenSpecActions): ScreenSpec {
	let view: PracticeView = 'home';
	let operation: EquationOperation = 'add';
	let selectedTopic: PracticeTopic | undefined;
	let related = false;
	let pond: MathDifficulty = 'easy';
	let activeRoot: HTMLElement | undefined;
	let starting = false;

	const evidence = function(topic: PracticeTopic, includeRelated = false): TemplateResult {
		const progress = actions.getPracticeProgress();
		const summary = practiceTopicEvidence(progress, topic, includeRelated);
		const status = practiceTopicStatus(progress, topic, includeRelated);
		const total = practiceFacts(topic, includeRelated).length;
		const detail = view === 'collection'
			? `${summary.attempted} practiced · ${summary.solved}/${total} solved`
			: `${summary.attempted} facts practiced · ${summary.solved}/${total} solved at least once`;
		return html`${view === 'collection' && status === 'New' ? nothing : html`<span class="practice-status">${status}</span>`}
			<span class="practice-evidence">${detail}</span>`;
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
					const practiced = topics.filter(function(topic): boolean { return practiceTopicStatus(actions.getPracticeProgress(), topic) === 'Practiced'; }).length;
					return html`<button type="button" class="mode-card practice-operation" data-practice-operation=${item} data-operation=${item}>
						<span class="mode-symbol" aria-hidden="true">${SYMBOLS[item]}</span><strong>${operationLabels[item]}</strong>
						<span>${topics.length} topics · ${practiced} practiced</span>
					</button>`;
				})}
			</div>`;
	};

	const collection = function(): TemplateResult {
		return html`<h1 class="pond-title text-gold">${operationLabels[operation]}</h1>
			<div class="practice-topic-grid" role="group" aria-label=${`${operationLabels[operation]} topics`}>
				${PRACTICE_TOPICS.filter(function(topic): boolean { return topic.operation === operation; }).map(function(topic): TemplateResult {
					return html`<button type="button" class="practice-topic" data-practice-topic=${topic.id}>
						<strong>${topic.label}</strong>${evidence(topic)}
					</button>`;
				})}
			</div>`;
	};

	const preview = function(topic: PracticeTopic): TemplateResult {
		const facts = practiceFacts(topic, related);
		const inverse = facts.find(function(fact): boolean { return fact.operation !== topic.operation; });
		const sample = inverse ? [...facts.slice(0, 2), inverse] : facts.slice(0, 3);
		const summary = practiceTopicEvidence(actions.getPracticeProgress(), topic, related);
		return html`<h1 class="pond-title text-gold">${topic.label}</h1>
			<div class="practice-preview-evidence">${evidence(topic, related)}</div>
			<div class="practice-examples" aria-label="Example equations">${sample.map(function(fact, index): TemplateResult { return html`<span>${practiceFactExample(topic, fact, index)}</span>`; })}</div>
			<button type="button" class="btn-secondary practice-option" data-practice-related aria-pressed=${String(related)}>
				<strong>Related facts: ${related ? 'On' : 'Off'}</strong><span>Include related ${topic.operation === 'multiply' ? 'division' : topic.operation === 'divide' ? 'multiplication' : topic.operation === 'add' ? 'subtraction' : 'addition'} problems</span>
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
				return html`<button type="button" class="difficulty-choice ${item} practice-pond" data-practice-pond=${item} aria-pressed=${String(pond === item)}>
					<strong>${difficultyLabels[item]}</strong><span>${board.width} × ${board.height} spaces</span><span>${enemies} ${enemies === 1 ? 'enemy' : 'enemies'}</span>
				</button>`;
			})}</div>
			<button type="button" class="btn-success" data-practice-pond-done>Done</button>`;
	};

	const refresh = function(root: HTMLElement, focusSelector?: string): void {
		const content = root.querySelector<HTMLElement>('[data-practice-content]');
		if (!content) return;
		render(html`<button type="button" class="btn-secondary setup-back" data-practice-back>‹ Back</button>
			${view === 'home' ? home() : view === 'collection' ? collection() : view === 'pond' ? pondChooser() : selectedTopic ? preview(selectedTopic) : home()}
			${actions.getPracticePersistence() === 'session-only' ? html`<p class="practice-save-status" role="status">${persistenceCopy(actions)}</p>` : nothing}`, content);
		if (focusSelector) focus(root, focusSelector);
	};

	const back = function(root: HTMLElement): void {
		if (view === 'home') { actions.goToMenu(); return; }
		if (view === 'pond') { view = 'preview'; refresh(root, '[data-practice-change-pond]'); return; }
		if (view === 'preview') {
			view = 'collection';
			refresh(root, selectedTopic ? `[data-practice-topic="${selectedTopic.id}"]` : '[data-practice-topic]');
			return;
		}
		view = 'home';
		refresh(root, `[data-practice-operation="${operation}"]`);
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
				if (nextOperation) { operation = nextOperation; view = 'collection'; refresh(root, '[data-practice-topic]'); return; }
				const nextTopic = practiceTopic(button.dataset.practiceTopic);
				if (nextTopic) {
					if (selectedTopic?.id !== nextTopic.id) related = false;
					selectedTopic = nextTopic; view = 'preview'; refresh(root, '[data-practice-start]'); return;
				}
				if (button.hasAttribute('data-practice-continue')) {
					const previous = actions.getPracticeProgress().lastSelection;
					const previousTopic = previous ? practiceTopic(previous.topicId) : undefined;
					if (!previous || !previousTopic) return;
					selectedTopic = previousTopic; operation = previousTopic.operation; related = previous.related; pond = previous.pond;
					view = 'preview'; refresh(root, '[data-practice-start]'); return;
				}
				if (button.hasAttribute('data-practice-related')) { related = !related; refresh(root, '[data-practice-related]'); return; }
				if (button.hasAttribute('data-practice-change-pond')) { view = 'pond'; refresh(root, `[data-practice-pond="${pond}"]`); return; }
				const nextPond = button.dataset.practicePond;
				if (isMathDifficulty(nextPond)) { pond = nextPond; refresh(root, `[data-practice-pond="${pond}"]`); return; }
				if (button.hasAttribute('data-practice-pond-done')) { view = 'preview'; refresh(root, '[data-practice-change-pond]'); return; }
				if (button.hasAttribute('data-practice-start') && selectedTopic && !starting) {
					starting = true; button.disabled = true;
					const selection: PracticeSelection = { topicId: selectedTopic.id, related, pond };
					actions.startPractice(selection);
				}
			});
		},
		onShow: function(root): void { view = 'home'; selectedTopic = undefined; related = false; starting = false; refresh(root); },
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
			const attempts = session?.attempts ?? [];
			const correct = attempts.filter(function(attempt): boolean { return attempt.correct; }).length;
			const wrongIds = new Set(attempts.filter(function(attempt): boolean { return !attempt.correct; }).map(function(attempt): string { return attempt.factId; }));
			const revisit = topic && session ? practiceFacts(topic, session.selection.related).filter(function(fact): boolean { return wrongIds.has(fact.id); }) : [];
			render(html`<h1 class="game-over-title">${session?.outcome === 'completed' ? 'Practice complete' : 'Partial practice'}</h1>
				<p class="practice-results-topic">${topic?.label ?? 'Practice'}</p>
				<p class="run-result">${session?.solved ?? 0}/${PRACTICE_SESSION_LENGTH} equations solved</p>
				<p>${attempts.length === 0 ? 'No submitted attempts yet.' : `${Math.round(correct / attempts.length * 100)}% accuracy · ${correct} correct of ${attempts.length} attempts`}</p>
				<p class="practice-note">${session?.outcome === 'completed' ? 'Completed answers add to topic evidence.' : 'Completed answers and attempts still add to topic evidence.'} No mastery or speed rating.</p>
				<h2>Facts to revisit</h2>
				${revisit.length ? html`<ul class="practice-revisit">${revisit.map(function(fact): TemplateResult { return html`<li>${practiceFactLabel(fact)}</li>`; })}</ul>` : html`<p>${attempts.length ? 'No wrong attempts in this session.' : 'Submit answers to build a revisit list.'}</p>`}
				<p class="practice-save-status" role="status">${persistenceCopy(actions)}</p>
				<div class="game-over-actions"><button type="button" class="btn-success" data-practice-again ?disabled=${!session} @click=${actions.repeatPractice}>Practice again</button>
				<button type="button" class="btn-primary" @click=${actions.openPractice}>Choose another topic</button>
				<button type="button" class="btn-secondary" @click=${actions.goToMenu}>Main menu</button></div>`, content);
		},
		onCancel: actions.goToMenu,
	};
};
