import { mkdir } from 'node:fs/promises';

const result = await Bun.build({
	entrypoints: ['src/dev/music-options/preview.ts'],
	target: 'browser',
	minify: true,
});
if (!result.success) throw new AggregateError(result.logs, 'Music preview build failed');
const script = result.outputs[0];
if (!script) throw new Error('Music preview bundle is missing');
const template = await Bun.file('music-options-preview.html').text();
const bundle = (await script.text()).replaceAll('</script', '<\\/script');
const html = template.replace('<script type="module" src="./src/dev/music-options/preview.ts"></script>', function(): string {
	return `<script type="module">${bundle}</script>`;
});
await mkdir('output/music-options', { recursive: true });
await Bun.write('output/music-options/index.html', html);
console.log('Built self-contained audition: output/music-options/index.html');
