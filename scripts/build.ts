import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import tailwind from 'bun-plugin-tailwind';

const projectRoot = resolve(import.meta.dir, '..');
const distRoot = resolve(projectRoot, 'dist');
const basePath = Bun.env.BASE_PATH ?? '/math-marsh/';
const pwaFiles = ['math-marsh-pwa-192.png', 'math-marsh-pwa-512.png'] as const;

function withBasePath(path: string): string {
  return `${basePath.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;
}

async function build(): Promise<void> {
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  const result = await Bun.build({
    entrypoints: [resolve(projectRoot, 'index.html')],
    outdir: distRoot,
    minify: true,
    sourcemap: 'external',
    publicPath: withBasePath('/'),
    plugins: [tailwind],
  });

  if (!result.success) throw new Error('Browser bundle failed');

  await Promise.all(pwaFiles.map(file => copyFile(
    resolve(projectRoot, 'src/assets/icons', file),
    resolve(distRoot, file),
  )));

  const manifest = {
    id: withBasePath('/'),
    name: 'Math Marsh',
    short_name: 'Math Marsh',
    description: 'An arithmetic game set in a lively pond.',
    start_url: withBasePath('/'),
    scope: withBasePath('/'),
    display: 'fullscreen',
    background_color: '#07170f',
    theme_color: '#1f8395',
    icons: [192, 512].map(size => ({
      src: withBasePath(`/math-marsh-pwa-${size}.png`),
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
  };
  await writeFile(resolve(distRoot, 'manifest.webmanifest'), JSON.stringify(manifest));

  const htmlPath = resolve(distRoot, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  const pwaHead = `<link rel="manifest" href="${withBasePath('/manifest.webmanifest')}">`;
  const registration = `<script>if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', () => { navigator.serviceWorker.register('${withBasePath('/sw.js')}').catch(console.error); }); }</script>`;
  await writeFile(htmlPath, html.replace('</head>', `${pwaHead}${registration}</head>`));

  const files = (await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: distRoot, onlyFiles: true })))
    .filter(file => !file.endsWith('.map') && file !== 'sw.js')
    .sort();
  const workerTemplate = await readFile(resolve(projectRoot, 'scripts/pwa-worker.js'), 'utf8');
  const fileHashes = await Promise.all(files.map(async file => [
    file,
    createHash('sha256').update(await readFile(resolve(distRoot, file))).digest('hex'),
  ]));
  const version = createHash('sha256')
    .update(JSON.stringify(fileHashes))
    .update(workerTemplate)
    .digest('hex')
    .slice(0, 16);
  await writeFile(resolve(distRoot, 'sw.js'), workerTemplate
    .replace('__CACHE_VERSION__', version)
    .replace('__PRECACHE_FILES__', JSON.stringify(files)));
}

await build();
