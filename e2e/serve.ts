import app from '../index.html';
import gameplayToasts from './fixtures/gameplayToasts.html';

Bun.serve({
	port: 3002,
	routes: {
		'/': app,
		'/gameplay-toasts': gameplayToasts,
	},
	development: true,
});
