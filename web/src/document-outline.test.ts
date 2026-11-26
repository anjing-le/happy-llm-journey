import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
// @ts-ignore Node's strip-types runner resolves the explicit TypeScript extension.
import { documentSections } from './document-outline.ts';

function readerHeadingIds(markdown: string) {
  const html = renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug], children: markdown }));
  return Array.from(html.matchAll(/<h([1-6]) id="([^"]*)"/g), ([, depth, id]) => ({ depth: Number(depth), id }));
}

test('keeps the original title, attribution and draft status together in the intro', () => {
  const intro = '# vibe coding\n\n**原创**\n\n作者：安静\n\n状态：草稿，尚未试用。\n\n';
  const first = '## 如何使用\n\n先了解目标。\n\n';
  const second = '### 定制个人 Skill\n\n保留用户的约定。\n';
  assert.deepEqual(documentSections(intro + first + second), [
    { id: 'vibe-coding', title: '导读', depth: 1, markdown: intro },
    { id: '如何使用', title: '如何使用', depth: 2, markdown: first },
    { id: '定制个人-skill', title: '定制个人 Skill', depth: 3, markdown: second },
  ]);
});

test('shares the Reader slug sequence across Chinese duplicate headings and all depths', () => {
  const markdown = '# 重复\n\n## 重复\n\n#### 重复\n\n### 重复\n\n## 重复\n';
  const sections = documentSections(markdown);
  assert.deepEqual(sections.map(({ id }) => id), ['重复', '重复-1', '重复-3', '重复-4']);
  assert.deepEqual(readerHeadingIds(markdown).filter(({ depth }) => depth <= 3).map(({ id }) => id), sections.map(({ id }) => id));
  assert.equal(sections.map(({ markdown }) => markdown).join(''), markdown);
});

test('extracts formatted heading labels and matches actual Reader plugin IDs', () => {
  const markdown = '# 总览\n\n## 用 **Codex**、`Agent` 与 [协作](./README.md)\n\n### ~~已删除~~ 与 *新增* &amp; 正文\n\n## 图 ![标识](./assets/a.png)\n\n## <em>原生</em> HTML\n';
  const sections = documentSections(markdown);
  assert.deepEqual(sections.map(({ title }) => title), ['导读', '用 Codex、Agent 与 协作', '已删除 与 新增 & 正文', '图', '原生 HTML']);
  assert.deepEqual(sections.map(({ id }) => id), readerHeadingIds(markdown).map(({ id }) => id));
  assert.equal(sections.map(({ markdown }) => markdown).join(''), markdown);
});

test('ignores fake headings in fenced and indented code while retaining complete tables and code', () => {
  const intro = '# 示例\n\n```md\n## 代码中的标题\n# 示例\n```\n\n';
  const first = '## 表格\n\n| 名称 | 说明 |\n| --- | --- |\n| # 字符 | 保留 |\n\n~~~text\n### 也是代码\n~~~\n\n    ## 缩进代码\n\n';
  const second = '## 示例\n\n正文。\n';
  assert.deepEqual(documentSections(intro + first + second), [
    { id: '示例', title: '导读', depth: 1, markdown: intro },
    { id: '表格', title: '表格', depth: 2, markdown: first },
    { id: '示例-1', title: '示例', depth: 2, markdown: second },
  ]);
});

test('uses source offsets to retain CRLF, blank lines and setext heading delimiters', () => {
  const intro = '# 😀 文档\r\n\r\n**原创**\r\n\r\n';
  const first = '中文标题\r\n--------\r\n\r\n第一段。\r\n\r\n';
  const second = '### 末节\r\n\r\n最后一行，没有末尾换行';
  const sections = documentSections(intro + first + second);
  assert.deepEqual(sections.map(({ markdown }) => markdown), [intro, first, second]);
  assert.deepEqual(sections.map(({ id }) => id), readerHeadingIds(intro + first + second).map(({ id }) => id));
});

test('keeps a whole document as intro when it has no selectable H2/H3 sections', () => {
  const withTitle = '# 只有标题\n\n原创与状态都在这里。\n\n#### 更细的小节\n\n正文。\n';
  assert.deepEqual(documentSections(withTitle), [{ id: '只有标题', title: '导读', depth: 1, markdown: withTitle }]);
  const withoutTitle = '**原创**\n\n没有任何标题的正文。\n';
  assert.deepEqual(documentSections(withoutTitle), [{ id: 'document-intro', title: '导读', depth: 1, markdown: withoutTitle }]);
  assert.deepEqual(documentSections(''), []);
});

test('does not invent empty intro content before an initial H2/H3', () => {
  const markdown = '\n\n## 第一节\n\n正文。\n';
  assert.deepEqual(documentSections(markdown), [{ id: '第一节', title: '第一节', depth: 2, markdown }]);
});

test('keeps headings inside containers intact but counts them for duplicate Reader slugs', () => {
  const markdown = '# 文档\n\n> ## 引用\n> 引用内的正文。\n\n- 列表\n  ### 引用\n\n## 引用\n\n正文章节。\n';
  const sections = documentSections(markdown);
  assert.deepEqual(sections.map(({ id }) => id), ['文档', '引用-2']);
  assert.equal(sections[0].markdown, '# 文档\n\n> ## 引用\n> 引用内的正文。\n\n- 列表\n  ### 引用\n\n');
  assert.equal(sections.map(({ markdown }) => markdown).join(''), markdown);
  assert.equal(sections[1].id, readerHeadingIds(markdown).at(-1)?.id);
});

test('matches multiline heading text and resets duplicate counters for each document', () => {
  const markdown = '# 文档\n\n第一行  \n第二行\n---\n\n## 第一行第二行\n';
  const expectedIds = readerHeadingIds(markdown).map(({ id }) => id);
  assert.deepEqual(documentSections(markdown).map(({ id }) => id), expectedIds);
  assert.deepEqual(documentSections(markdown).map(({ id }) => id), expectedIds);
});
