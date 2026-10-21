import preview from '../splash-preview.html';
import game from '../index.html';

const server = Bun.serve({
	hostname: '0.0.0.0',
	port: 3000,
	development: { hmr: true, console: true },
	routes: { '/': preview, '/splash-preview.html': preview, '/game': game },
});
console.log(`Splash review available on port ${server.port}; game at /game`);
