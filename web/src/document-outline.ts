import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Heading, Nodes } from 'mdast';

export type DocumentSection = {
  id: string;
  title: string;
  depth: number;
  markdown: string;
};

function headingText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return '\n';
  // rehype-slug uses heading text descendants, excluding image alt and raw HTML.
  return 'children' in node ? node.children.map(headingText).join('') : '';
}

export function documentSections(markdown: string): DocumentSection[] {
  if (!markdown) return [];
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const slugger = new GithubSlugger();
  const headings: { node: Heading; id: string; offset: number }[] = [];
  function collect(node: Nodes) {
    if (node.type === 'heading') {
      headings.push({ node, id: slugger.slug(headingText(node)), offset: node.position?.start.offset ?? 0 });
    }
    if ('children' in node) for (const child of node.children) collect(child);
  }
  // Every heading consumes a slug, including H1/H4-H6 and headings in block quotes/lists.
  collect(tree);
  const topLevel = new Set(tree.children);
  // Never split a block quote or list container in the middle of its original Markdown.
  const chapters = headings.filter(({ node }) => topLevel.has(node) && (node.depth === 2 || node.depth === 3));
  const introEnd = chapters[0]?.offset ?? markdown.length;
  const prefix = markdown.slice(0, introEnd);
  const hasIntro = prefix.trim().length > 0 || chapters.length === 0;
  const sections: DocumentSection[] = [];
  if (hasIntro) {
    sections.push({
      id: headings.find(({ node, offset }) => node.depth === 1 && offset < introEnd)?.id ?? 'document-intro',
      title: '导读',
      depth: 1,
      markdown: prefix,
    });
  }
  for (const [index, chapter] of chapters.entries()) {
    sections.push({
      id: chapter.id,
      title: headingText(chapter.node).trim() || '未命名章节',
      depth: chapter.node.depth,
      // Retain leading whitespace without creating a content-free intro card.
      markdown: markdown.slice(index === 0 && !hasIntro ? 0 : chapter.offset, chapters[index + 1]?.offset ?? markdown.length),
    });
  }
  return sections;
}
