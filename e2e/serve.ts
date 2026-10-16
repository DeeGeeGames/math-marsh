import app from '../index.html';
import gameplayToasts from './fixtures/gameplayToasts.html';
import music from './fixtures/music.html';

Bun.serve({
	port: 3002,
	routes: {
		'/': app,
		'/gameplay-toasts': gameplayToasts,
		'/music': music,
	},
	development: true,
});
