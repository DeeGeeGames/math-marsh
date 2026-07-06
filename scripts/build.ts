import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import tailwind from 'bun-plugin-tailwind';

const projectRoot = resolve(import.meta.dir, '..');
const distRoot = resolve(projectRoot, 'dist');
const basePath = Bun.env.BASE_PATH ?? '/math-marsh/';

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
}

await build();
