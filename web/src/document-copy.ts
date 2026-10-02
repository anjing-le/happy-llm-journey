import { fromMarkdown, type CompileContext, type Extension, type Token } from 'mdast-util-from-markdown';
import type { ContentDocument } from './content-types';

const canonicalOrigin = 'https://happy-llm.anjing.cc';
const repositoryBase = `${canonicalOrigin}/repository/`;
const sourceOrigin = 'https://repository.invalid';
type MarkdownNode = CompileContext['stack'][number];
type Destination = { start: number; end: number };
type Replacement = Destination & { value: string };

function encodePath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}

function markdownUrl(path: string) {
  return repositoryBase + encodePath(path);
}

export function publishedDocumentUrl(path: string) {
  return `${canonicalOrigin}/read/${encodePath(path.replace(/\.md$/i, '.html'))}`;
}

function absoluteDestination(url: string, current: string, documents: Record<string, ContentDocument>) {
  // Existing absolute URLs, including protocol-relative links, remain byte-for-byte unchanged.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return undefined;
  const resolved = new URL(url, `${sourceOrigin}/${encodePath(current)}`);
  let path = resolved.pathname.slice(1);
  try { path = decodeURIComponent(path); } catch { /* Preserve a literal malformed percent escape. */ }
  const directory = path.replace(/\/$/, '');
  const directoryReadme = `${directory ? directory + '/' : ''}README.md`;
  if (!Object.hasOwn(documents, path) && Object.hasOwn(documents, directoryReadme)) path = directoryReadme;
  // href retains even empty '?' and '#' markers; search/hash alone would discard them.
  const suffix = resolved.href.slice(resolved.origin.length + resolved.pathname.length);
  // Markdown punctuation/character references must not change the resolved URL on a second parse.
  return (markdownUrl(path) + suffix)
    .replace(/[()\\]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/&(?=(?:#(?:\d+|[xX][\da-fA-F]+)|[a-zA-Z][\da-zA-Z]+);)/g, '&amp;');
}

function visit(node: MarkdownNode, callback: (node: MarkdownNode) => void) {
  callback(node);
  if ('children' in node) for (const child of node.children) visit(child, callback);
}

export function createDocumentCopy(document: ContentDocument, documents: Record<string, ContentDocument>) {
  const source = document.markdown;
  const destinations = new WeakMap<MarkdownNode, Destination>();
  function captureDestination(this: CompileContext, token: Token) {
    const node = this.stack[this.stack.length - 1];
    let start = token.start.offset;
    let end = token.end.offset;
    // Keep the original angle brackets and all spacing outside the URL itself.
    if (source[start] === '<') { start += 1; end -= 1; }
    destinations.set(node, { start, end });
  }
  const positions: Extension = {
    enter: {
      resource(token) {
        // An empty inline destination has no destination token; insert just after '('.
        destinations.set(this.stack[this.stack.length - 1], { start: token.start.offset + 1, end: token.start.offset + 1 });
      },
    },
    exit: {
      resourceDestination: captureDestination,
      definitionDestination: captureDestination,
    },
  };
  const tree = fromMarkdown(source, { mdastExtensions: [positions] });
  const replacements: Replacement[] = [];
  visit(tree, (node) => {
    if (node.type !== 'link' && node.type !== 'image' && node.type !== 'definition') return;
    const destination = destinations.get(node);
    if (!destination) return;
    const value = absoluteDestination(node.url, document.path, documents);
    if (value !== undefined) replacements.push({ ...destination, value });
  });
  // Apply backwards so earlier source offsets remain valid, including nested image links.
  let markdown = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    markdown = markdown.slice(0, replacement.start) + replacement.value + markdown.slice(replacement.end);
  }
  return `来源：${markdownUrl(document.path)}\n\n${markdown}`;
}

export function agentEntryPrompt(readme: ContentDocument) {
  let prompt: string | undefined;
  visit(fromMarkdown(readme.markdown), (node) => {
    if (prompt === undefined && node.type === 'code' && node.lang === 'text') prompt = node.value;
  });
  return prompt ?? '';
}
