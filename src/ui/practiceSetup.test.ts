import { expect, test } from 'bun:test';
import { practiceTopic } from '../math/practiceTopics';
import { createPracticeSetupState, practiceSetupSelection, updatePracticeSetup } from './practiceSetup';

const make5 = practiceTopic('add-make-5');
const make6 = practiceTopic('add-make-6');
if (!make5 || !make6) throw new Error('Missing Practice topics');

test('Back preserves topic options; changing topics resets related facts and retains the pond', function() {
	const initial = createPracticeSetupState();
	let state = updatePracticeSetup(initial, { type: 'operation', operation: 'add' });
	state = updatePracticeSetup(state, { type: 'topic', topic: make5 });
	state = updatePracticeSetup(state, { type: 'related' });
	state = updatePracticeSetup(state, { type: 'openPond' });
	expect(practiceSetupSelection(state)).toBeUndefined();
	state = updatePracticeSetup(state, { type: 'pond', pond: 'expert' });
	state = updatePracticeSetup(state, { type: 'back' });
	expect(practiceSetupSelection(state)).toEqual({ topicId: make5.id, related: true, pond: 'expert' });
	state = updatePracticeSetup(state, { type: 'back' });
	state = updatePracticeSetup(state, { type: 'topic', topic: make5 });
	expect(practiceSetupSelection(state)).toEqual({ topicId: make5.id, related: true, pond: 'expert' });
	state = updatePracticeSetup(state, { type: 'back' });
	state = updatePracticeSetup(state, { type: 'topic', topic: make6 });
	expect(practiceSetupSelection(state)).toEqual({ topicId: make6.id, related: false, pond: 'expert' });
	expect(initial).toEqual(createPracticeSetupState());
});

test('Continue restores saved options and Back returns to the matching collection and operation', function() {
	const selection = { topicId: 'divide-table-7', related: true, pond: 'medium' } as const;
	let state = updatePracticeSetup(createPracticeSetupState(), { type: 'continue', selection });
	expect(practiceSetupSelection(state)).toEqual(selection);
	state = updatePracticeSetup(state, { type: 'back' });
	expect(state).toMatchObject({ view: 'collection', operation: 'divide' });
	state = updatePracticeSetup(state, { type: 'back' });
	expect(state).toMatchObject({ view: 'home', operation: 'divide' });
	expect(practiceSetupSelection(state)).toBeUndefined();
	expect(updatePracticeSetup(state, { type: 'continue', selection: { ...selection, topicId: 'retired' } })).toBe(state);
});

test('reopening setup clears topic options while retaining the current pond preference', function() {
	const state = updatePracticeSetup(createPracticeSetupState(), {
		type: 'continue', selection: { topicId: make5.id, related: true, pond: 'expert' },
	});
	const reopened = updatePracticeSetup(state, { type: 'reset' });
	expect(reopened).toMatchObject({ view: 'home', topic: undefined, related: false, pond: 'expert' });
	expect(practiceSetupSelection(reopened)).toBeUndefined();
	for (const type of ['related', 'openPond', 'closePond'] as const) {
		expect(updatePracticeSetup(reopened, { type })).toBe(reopened);
	}
});
