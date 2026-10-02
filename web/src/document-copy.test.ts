import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore Node's strip-types runner resolves the explicit TypeScript extension.
import { agentEntryPrompt, createDocumentCopy, publishedDocumentUrl } from './document-copy.ts';
import type { ContentDocument } from './content-types';

const raw = 'https://happy-llm.anjing.cc/repository/';

function document(path: string, markdown = ''): ContentDocument {
  return { path, markdown, title: '标题', description: '', module: 'project' };
}

function copy(markdown: string, path = 'practices/nested/article.md', documents: Record<string, ContentDocument> = {}) {
  return createDocumentCopy(document(path, markdown), documents);
}

test('copies the complete source including hidden heading, attribution and draft status', () => {
  const markdown = '# 文章\n\n**原创**\n\n作者：[安静](https://example.com/author)\n\n状态：草稿，尚未试用。\n\n- 一条经验\n\n![原始图片](../../assets/poster.png)\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n${markdown.replace('../../assets/poster.png', raw + 'assets/poster.png')}`);
});

test('resolves nested links, images, directory indexes and query/fragment suffixes', () => {
  const markdown = '[知识](../../knowledge/?mode=raw#待办)\n![图](../../assets/图.png?size=2#图示)\n[同级](./other.md?a=1&b=2#part)\n[根目录](/README.md)\n[本页](#定制个人-Skill)\n';
  const documents = { 'knowledge/README.md': document('knowledge/README.md') };
  assert.equal(copy(markdown, undefined, documents), `来源：${raw}practices/nested/article.md\n\n[知识](${raw}knowledge/README.md?mode=raw#%E5%BE%85%E5%8A%9E)\n![图](${raw}assets/%E5%9B%BE.png?size=2#%E5%9B%BE%E7%A4%BA)\n[同级](${raw}practices/nested/other.md?a=1&b=2#part)\n[根目录](${raw}README.md)\n[本页](${raw}practices/nested/article.md#%E5%AE%9A%E5%88%B6%E4%B8%AA%E4%BA%BA-Skill)\n`);
});

test('preserves angle brackets, link titles, indentation and CRLF while encoding spaces', () => {
  const markdown = '> 😀 [带空格](<../file name.md?x=1#章节> "保持标题")\r\n> ![图](<../../assets/image name.png> \'图片说明\')\r\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n> 😀 [带空格](<${raw}practices/file%20name.md?x=1#%E7%AB%A0%E8%8A%82> "保持标题")\r\n> ![图](<${raw}assets/image%20name.png> \'图片说明\')\r\n`);
});

test('rewrites reference definitions without changing reference labels or surrounding format', () => {
  const markdown = '[文档][ref]、![图][image]、[ref]、[ref][]\n\n[ref]:\n  <../guide name.md?raw=1#section>\n  "文档标题"\n[image]: ../../assets/pic.png \'图片标题\'\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n[文档][ref]、![图][image]、[ref]、[ref][]\n\n[ref]:\n  <${raw}practices/guide%20name.md?raw=1#section>\n  "文档标题"\n[image]: ${raw}assets/pic.png \'图片标题\'\n`);
});

test('leaves fenced, inline and indented code, ordinary text and HTML unchanged', () => {
  const markdown = '[真链接](../real.md)\n\n```md\n[代码](../fake.md)\n[fake]: ../fake.md\n![图](../fake.png)\n```\n\n`[行内](../fake.md)` 和 ``[ref]: ../fake.md``\n\n    [缩进代码](../fake.md)\n\n纯文本 ../fake.md 和 <a href="../fake.md">HTML</a>\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n${markdown.replace('[真链接](../real.md)', `[真链接](${raw}practices/real.md)`)}`);
});

test('handles nested image links and escaped or balanced parentheses without disturbing labels', () => {
  const markdown = '[![嵌套图](../../assets/image\\(1\\).png)](../guide(1).md "外层标题")\n[含代码 `](../fake.md)`](../guide.md)\n[锚点](#a\\))\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n[![嵌套图](${raw}assets/image%281%29.png)](${raw}practices/guide%281%29.md "外层标题")\n[含代码 \`](../fake.md)\`](${raw}practices/guide.md)\n[锚点](${raw}practices/nested/article.md#a%29)\n`);
});

test('keeps all existing absolute URLs and autolinks byte-for-byte unchanged', () => {
  const markdown = '[外部](https://example.com/a?x=1&amp;y=2#片段) [相对协议](//example.com/a) [邮箱](mailto:a@example.com)\n![远端图片](https://example.com/image.png)\n<https://example.com>\n<a@example.com>\n[绝对定义]: https://example.com/guide\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n${markdown}`);
});

test('resolves empty destinations and retains empty query and fragment markers', () => {
  const markdown = '[空]() ![空图](<>) [带标题](<> "标题") [问号](other.md?) [空锚点](#)\n';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n[空](${raw}practices/nested/article.md) ![空图](<${raw}practices/nested/article.md>) [带标题](<${raw}practices/nested/article.md> "标题") [问号](${raw}practices/nested/other.md?) [空锚点](${raw}practices/nested/article.md#)\n`);
});

test('maps the repository root directory to its known README', () => {
  const documents = { 'README.md': document('README.md') };
  assert.equal(copy('[根](../../?view=raw#目标)', undefined, documents), `来源：${raw}practices/nested/article.md\n\n[根](${raw}README.md?view=raw#%E7%9B%AE%E6%A0%87)`);
});

test('keeps the URL meaning when decoded Markdown contains entity-like text or backslashes', () => {
  const markdown = '[参数](../guide.md?value=&amp;copy;&other=1#path\\\\tail)';
  assert.equal(copy(markdown), `来源：${raw}practices/nested/article.md\n\n[参数](${raw}practices/guide.md?value=&amp;copy;&other=1#path%5Ctail)`);
});

test('uses only own document entries to map directories', () => {
  const documents = Object.create({ 'knowledge/README.md': document('knowledge/README.md') }) as Record<string, ContentDocument>;
  assert.equal(copy('[知识](../../knowledge/)', undefined, documents), `来源：${raw}practices/nested/article.md\n\n[知识](${raw}knowledge/)`);
});

test('publishes canonical article URLs with encoded path segments', () => {
  assert.equal(publishedDocumentUrl('practices/个人 Skill.md'), 'https://happy-llm.anjing.cc/read/practices/%E4%B8%AA%E4%BA%BA%20Skill.html');
  assert.equal(publishedDocumentUrl('activities/.github/guide(1).MD'), 'https://happy-llm.anjing.cc/read/activities/.github/guide%281%29.html');
});

test('extracts only the first text fence from README and uses its current content', () => {
  const readme = document('README.md', '# 项目\n\n```sh\nnpm run build\n```\n\n```text\n入口第一行\n入口第二行 <填写目标>\n```\n\n```text\n不应提取这个块\n```\n');
  assert.equal(agentEntryPrompt(readme), '入口第一行\n入口第二行 <填写目标>');
  assert.equal(agentEntryPrompt({ ...readme, markdown: readme.markdown.replace('入口第一行', '已修订入口') }), '已修订入口\n入口第二行 <填写目标>');
  assert.equal(agentEntryPrompt(document('README.md', '只有正文，没有入口提示。')), '');
});
