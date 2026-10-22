import type { EquationOperation, MathDifficulty } from '../ecs/types';
import type { PracticeSelection } from '../ecs/practiceSession';
import { practiceTopic, type PracticeTopic } from '../math/practiceTopics';

/** Setup views belong to the existing Practice screen; gameplay uses ECSpresso screens. */
export type PracticeSetupState = Readonly<{
	operation: EquationOperation;
	related: boolean;
	pond: MathDifficulty;
}> & (
	| Readonly<{ view: 'home' | 'collection'; topic: PracticeTopic | undefined }>
	| Readonly<{ view: 'preview' | 'pond'; topic: PracticeTopic }>
);

export type PracticeSetupAction =
	| Readonly<{ type: 'operation'; operation: EquationOperation }>
	| Readonly<{ type: 'topic'; topic: PracticeTopic }>
	| Readonly<{ type: 'continue'; selection: PracticeSelection }>
	| Readonly<{ type: 'related' | 'openPond' | 'closePond' | 'back' | 'reset' }>
	| Readonly<{ type: 'pond'; pond: MathDifficulty }>;

export const createPracticeSetupState = function(): PracticeSetupState {
	return { view: 'home', operation: 'add', topic: undefined, related: false, pond: 'easy' };
};

export const updatePracticeSetup = function(state: PracticeSetupState, action: PracticeSetupAction): PracticeSetupState {
	switch (action.type) {
		case 'operation':
			return { ...state, view: 'collection', operation: action.operation };
		case 'topic':
			return { ...state, view: 'preview', topic: action.topic, operation: action.topic.operation,
				related: state.topic?.id === action.topic.id ? state.related : false };
		case 'continue': {
			const topic = practiceTopic(action.selection.topicId);
			return topic ? { view: 'preview', topic, operation: topic.operation,
				related: action.selection.related, pond: action.selection.pond } : state;
		}
		case 'related':
			return state.view === 'preview' ? { ...state, related: !state.related } : state;
		case 'openPond':
			return state.view === 'preview' ? { ...state, view: 'pond' } : state;
		case 'pond':
			return state.view === 'pond' ? { ...state, pond: action.pond } : state;
		case 'closePond':
			return state.view === 'pond' ? { ...state, view: 'preview' } : state;
		case 'back':
			if (state.view === 'pond') return { ...state, view: 'preview' };
			if (state.view === 'preview') return { ...state, view: 'collection' };
			return state.view === 'collection' ? { ...state, view: 'home' } : state;
		case 'reset':
			return { ...state, view: 'home', topic: undefined, related: false };
	}
};

export const practiceSetupSelection = function(state: PracticeSetupState): PracticeSelection | undefined {
	return state.view === 'preview' ? { topicId: state.topic.id, related: state.related, pond: state.pond } : undefined;
};
