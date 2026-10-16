import preview from '../asset-preview.html';
import musicMixer from '../music-options-preview.html';

const server = Bun.serve({
	hostname: '0.0.0.0',
	port: 3001,
	development: { hmr: true, console: true },
	routes: {
		'/': preview,
		'/asset-preview.html': preview,
		'/music-options.html': musicMixer,
	},
});

console.log(`Asset preview available on the local network at port ${server.port}`);
