import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const page = new URL('../../dist/index.html', import.meta.url);
const { render } = await import('../.ssr/entry-server.js');
const template = await readFile(page, 'utf8');
if (!template.includes('<!--app-html-->')) throw new Error('Prerender marker missing.');
if (!template.includes('<div id="root">')) throw new Error('Prerender root missing.');
const content = JSON.parse(await readFile(new URL('../src/generated/content.json', import.meta.url), 'utf8'));
const outputRoot = fileURLToPath(new URL('../../dist/', import.meta.url));

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function renderPage(document) {
  const title = document ? `${document.title} · anjing-llm` : 'anjing-llm';
  const markup = await render(document?.path);
  return template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace('<div id="root">', `<div id="root" data-document="${encodeURIComponent(document?.path || '')}">`)
    .replace('<!--app-html-->', () => markup);
}

const html = await renderPage();
await writeFile(page, html);
await writeFile(new URL('../../dist/overview.html', import.meta.url), html);
const outputs = new Set();
for (const document of Object.values(content.documents)) {
  const target = path.resolve(outputRoot, 'read', document.path.replace(/\.md$/i, '.html'));
  if (!target.startsWith(path.join(outputRoot, 'read') + path.sep) || outputs.has(target)) {
    throw new Error(`Invalid or duplicate article output: ${document.path}`);
  }
  outputs.add(target);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await renderPage(document));
}
await rm(new URL('../.ssr/', import.meta.url), { recursive: true, force: true });
console.log(`Rendered directory, overview.html compatibility entry, and ${outputs.size} complete article pages.`);
