import app from '../index.html';
import uiLifecycle from './fixtures/uiLifecycle.html';
import gameplayToasts from './fixtures/gameplayToasts.html';
import music from './fixtures/music.html';
import partialSelection from '../partial-selection-preview.html';
import demoArcade from './fixtures/demoArcade.html';

Bun.serve({
	port: 3002,
	routes: {
		'/': app,
    '/ui-lifecycle': uiLifecycle,
		'/gameplay-toasts': gameplayToasts,
		'/music': music,
		'/partial-selection': partialSelection,
    '/demo-arcade': demoArcade,
	},
	development: true,
});
