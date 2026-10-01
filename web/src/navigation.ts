import type { ContentDocument } from './content-types';

export const repositoryUrl = 'https://github.com/anjing-le/happy-llm-journey';
export const base = import.meta.env.BASE_URL;

export function decodeAnchor(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function hasDocument(documents: Record<string, ContentDocument>, path: string) {
  return Object.hasOwn(documents, path);
}

export function documentUrl(path: string, anchor = '') {
  const route = path.replace(/\.md$/i, '.html').split('/').map(encodeURIComponent).join('/');
  return `${base}read/${route}${anchor ? '#' + encodeURIComponent(anchor) : ''}`;
}

export function documentLocation(url: URL, documents: Record<string, ContentDocument>): { path?: string; unknown: boolean } {
  // A legacy query overrides the physical page, including an invalid query.
  const legacy = url.searchParams.get('doc');
  if (legacy) return hasDocument(documents, legacy) ? { path: legacy, unknown: false } : { unknown: true };
  const prefix = `${base}read/`;
  if (!url.pathname.startsWith(prefix)) return { unknown: false };
  // Pages hosting may redirect .html requests to the same extensionless route.
  const route = decodeAnchor(url.pathname.slice(prefix.length)).replace(/\/$/, '').replace(/\.html$/i, '');
  const document = Object.keys(documents).find((candidate) => candidate.replace(/\.md$/i, '') === route);
  return document ? { path: document, unknown: false } : { unknown: true };
}

export function rawUrl(path: string) {
  return base + 'repository/' + path.split('/').map(encodeURIComponent).join('/');
}

export function resolveMarkdownUrl(url: string, current: string, documents: Record<string, ContentDocument>) {
  // The renderer filters unsafe protocols after resolving repository links.
  const safe = url;
  if (!safe || safe.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(safe)) return safe;
  const resolved = new URL(safe, `https://repository.invalid/${current}`);
  const path = decodeAnchor(resolved.pathname).replace(/^\//, '');
  const directoryReadme = path.replace(/\/$/, '') + '/README.md';
  const document = hasDocument(documents, path) ? path : hasDocument(documents, directoryReadme) ? directoryReadme : null;
  if (document) return documentUrl(document, decodeAnchor(resolved.hash.slice(1)));
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|ico|mp3|m4a|ogg|wav|mp4|webm|mov|pdf)$/i.test(path)) return rawUrl(path) + resolved.search + resolved.hash;
  return repositoryUrl + '/blob/main/' + path.split('/').map(encodeURIComponent).join('/') + resolved.hash;
}
