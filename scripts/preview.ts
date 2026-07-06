import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const distRoot = resolve(projectRoot, 'dist');
const port = Number(Bun.env.PORT ?? '3000');
const basePath = Bun.env.BASE_PATH ?? '/math-marsh/';

function notFound(): Response {
  return new Response('Not found', { status: 404 });
}

function serverError(error: unknown): Response {
  console.error(error);
  return new Response('Internal server error', { status: 500 });
}

function normalizedBasePath(): string {
  return `/${basePath.replace(/^\/?/, '').replace(/\/?$/, '/')}`;
}

function distPathname(pathname: string): string | null {
  const normalizedBase = normalizedBasePath();
  if (pathname === normalizedBase) return '/';
  if (pathname.includes('..')) return null;
  if (!pathname.startsWith(normalizedBase)) return pathname;
  return `/${pathname.slice(normalizedBase.length)}`;
}

function distFilePath(pathname: string): string | null {
  const distPath = distPathname(pathname);
  if (distPath === null) return null;
  if (distPath === '/' || distPath === '/index.html') return resolve(distRoot, 'index.html');
  return resolve(distRoot, distPath.replace(/^\//, ''));
}

Bun.serve({
  port,
  fetch: async function fetch(request): Promise<Response> {
    try {
      const filePath = distFilePath(new URL(request.url).pathname);
      if (filePath === null) return notFound();
      const file = Bun.file(filePath);
      if (!(await file.exists())) return notFound();
      return new Response(file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } });
    } catch (error) {
      return serverError(error);
    }
  },
});

console.log(`Serving dist at http://localhost:${port}`);
