import app from '../index.html';
import gameplayToasts from './fixtures/gameplayToasts.html';
import music from './fixtures/music.html';
import partialSelection from '../partial-selection-preview.html';

Bun.serve({
	port: 3002,
	routes: {
		'/': app,
		'/gameplay-toasts': gameplayToasts,
		'/music': music,
		'/partial-selection': partialSelection,
	},
	development: true,
});
