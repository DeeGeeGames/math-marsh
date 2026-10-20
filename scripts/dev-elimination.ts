import preview from '../enemy-elimination-preview.html';
import game from '../index.html';

const server = Bun.serve({
	hostname: '0.0.0.0',
	port: 3000,
	development: { hmr: true, console: true },
	routes: { '/': preview, '/enemy-elimination-preview.html': preview, '/game': game },
});
console.log(`Elimination review available on port ${server.port}; game at /game`);
