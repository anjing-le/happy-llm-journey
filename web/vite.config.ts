import { defineConfig } from 'vite';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  plugins: [{
    name: 'repository-markdown',
    configureServer(server) {
      const sources = ['knowledge', 'practices', 'activities', 'README.md', 'AGENTS.md'];
      server.watcher.add(sources.map((source) => path.join(repository, source)));
      let timer: ReturnType<typeof setTimeout>;
      const rebuild = (filename: string) => {
        const relative = path.relative(repository, filename).replaceAll(path.sep, '/');
        if (!relative.endsWith('.md') || !sources.some((source) => relative === source || relative.startsWith(source + '/'))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          execFile(process.execPath, [path.join(repository, 'web/scripts/build-content.mjs')], (error, stdout, stderr) => {
            if (error) server.config.logger.error(stderr || error.message);
            else {
              server.config.logger.info(stdout.trim());
              server.ws.send({ type: 'full-reload' });
            }
          });
        }, 120);
      };
      server.watcher.on('change', rebuild).on('add', rebuild).on('unlink', rebuild);
    },
  }],
});
