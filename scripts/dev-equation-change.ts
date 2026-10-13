import preview from '../equation-change-preview.html';
import game from '../index.html';

const server = Bun.serve({
	hostname: '0.0.0.0',
	port: 3002,
	development: { hmr: true, console: true },
	routes: { '/': preview, '/game': game },
});
console.log(`Equation change review: http://localhost:${server.port}`);
