import { copyFile, lstat, mkdir, readFile, readdir, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webRoot = path.join(repoRoot, 'web');
const rawRoot = path.join(webRoot, 'public/repository');
const generatedPath = path.join(webRoot, 'src/generated/content.json');
const manifestPath = path.join(rawRoot, '.content-manifest.json');
const generator = 'happy-llm-journey-content';
const modules = ['knowledge', 'practices', 'activities'];
const labels = {
  assignments: '候选题目', docs: '说明文档', templates: '作业模板',
  'student-repo': '学员仓库', 'student-visible': '公开题面',
  prompts: '阶段提示词', evidence: '验证证据', '.github': 'GitHub 协作',
};
const staticExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.pdf', '.mp3', '.m4a', '.ogg', '.wav', '.mp4', '.webm', '.mov',
]);
const documents = Object.create(null);
const resources = new Set();
const brokenLinks = [];
const unsafeReferences = [];

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isPublicPath(relative) {
  const parts = relative.split('/');
  return parts.every((part, index) => {
    if (!part || part === '.' || part === '..' || ['node_modules', 'dist', 'web'].includes(part)) return false;
    if (/^(?:credentials?|secrets?)(?:[._-]|$)/i.test(part)) return false;
    return !part.startsWith('.') || (part === '.github' && parts.slice(0, index).includes('templates'));
  });
}

// Reject symlinks in every component, including directories above the file.
async function noSymlinks(root, target, allowMissing = false) {
  if (!isWithin(root, target)) throw new Error(`Path outside ${root}: ${target}`);
  let current = root;
  const components = path.relative(root, target).split(path.sep).filter(Boolean);
  for (const component of ['', ...components]) {
    if (component) current = path.join(current, component);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink is not allowed: ${current}`);
    } catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function publicSource(relative) {
  if (!isPublicPath(relative)) throw new Error(`Non-public source path: ${relative}`);
  const absolute = path.resolve(repoRoot, relative);
  await noSymlinks(repoRoot, absolute);
  const canonical = await realpath(absolute);
  if (!isWithin(repoRoot, canonical) || !(await lstat(absolute)).isFile()) {
    throw new Error(`Not a repository file: ${relative}`);
  }
  return absolute;
}

function withoutCode(markdown) {
  return markdown.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '')
    .replace(/(`+)[^\n]*?\1/g, '');
}

function plain(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/^[ \t]*(?:>\s*|[-*+]\s+|\d+[.)]\s+|#{1,6}\s+)/gm, '')
    .replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
}

function excerpt(value) {
  const characters = Array.from(value);
  return characters.length > 180 ? `${characters.slice(0, 179).join('')}…` : value;
}

function description(markdown) {
  for (const paragraph of withoutCode(markdown).split(/\n\s*\n/)) {
    const raw = paragraph.trim();
    if (!raw || /^#{1,6}\s|^\||^\[[^\]]+\]:|^[-*_]{3,}$/.test(raw)) continue;
    const value = plain(raw);
    if (!value || /^(?:原创|共创)(?:\s*[·•|｜:：-].*)?$/.test(value)
      || /^(?:作者|署名|author)\s*[:：]/i.test(value)
      || /^状态\s*[:：]/.test(value)
      || /^\[?(?:返回|目标与维护规则)/.test(value)) continue;
    return excerpt(value);
  }
  return '';
}

async function loadDocument(relative, module) {
  const markdown = await readFile(await publicSource(relative), 'utf8');
  const heading = /^#\s+(.+)$/m.exec(markdown);
  const fallback = relative === 'README.md' ? 'Happy LLM Journey' : path.posix.basename(relative, '.md');
  const document = {
    path: relative, title: heading ? plain(heading[1]) : fallback,
    description: description(markdown), markdown, module,
  };
  documents[relative] = document;
  return document;
}

async function directory(relative, module) {
  const absolute = path.join(repoRoot, relative);
  await noSymlinks(repoRoot, absolute);
  const entries = (await readdir(absolute, { withFileTypes: true }))
    .filter((entry) => !entry.isSymbolicLink() && isPublicPath(`${relative}/${entry.name}`))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, 'en'));
  const readme = entries.find((entry) => entry.isFile() && entry.name === 'README.md');
  const document = readme ? await loadDocument(`${relative}/README.md`, module) : undefined;
  const children = [];
  for (const entry of entries) {
    const entryPath = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      const child = await directory(entryPath, module);
      if (child.documentPath || child.children.length) children.push(child);
    } else if (entry.isFile() && /\.md$/i.test(entry.name) && entry.name !== 'README.md') {
      const child = await loadDocument(entryPath, module);
      children.push({ id: entryPath, type: 'document', title: child.title,
        description: child.description, documentPath: entryPath, children: [] });
    }
  }
  return {
    id: relative, type: 'directory', title: document?.title || labels[path.posix.basename(relative)] || path.posix.basename(relative),
    description: document?.description || excerpt(children.length ? `包含：${children.map((child) => child.title).join('、')}` : ''),
    ...(document ? { documentPath: document.path } : {}), children,
  };
}

// Inline links/images, reference definitions and HTML href/src cover the source
// documents without treating code examples as links. Titles are not destinations.
function destinations(markdown) {
  const text = withoutCode(markdown);
  const values = [];
  const patterns = [
    /!?\[(?:\\.|[^\]\\])*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
    /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm,
    /<(?:a|img|source|video|audio)\b[^>]*?\b(?:href|src|poster)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) values.push(match[1] ?? match[2]);
  }
  return [...new Set(values)];
}

function resolveReference(documentPath, destination) {
  if (!destination || destination.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) return undefined;
  let decoded;
  try { decoded = decodeURIComponent(destination.split(/[?#]/, 1)[0]); } catch { return undefined; }
  if (!decoded) return undefined;
  const absolute = decoded.startsWith('/')
    ? path.resolve(repoRoot, `.${decoded}`)
    : path.resolve(repoRoot, path.dirname(documentPath), decoded);
  if (!isWithin(repoRoot, absolute)) return null;
  return path.relative(repoRoot, absolute).split(path.sep).join('/');
}

async function validateReferences() {
  let markdownLinks = 0;
  for (const document of Object.values(documents)) {
    for (const destination of destinations(document.markdown)) {
      const relative = resolveReference(document.path, destination);
      if (relative === undefined) continue;
      if (relative === null || !isPublicPath(relative)) {
        unsafeReferences.push(`${document.path} → ${destination}`);
        continue;
      }
      if (/\.md$/i.test(relative)) {
        markdownLinks += 1;
        if (!documents[relative]) brokenLinks.push(`${document.path} → ${destination}`);
      } else if (staticExtensions.has(path.extname(relative).toLowerCase())) {
        try {
          await publicSource(relative);
          resources.add(relative);
        } catch (error) {
          unsafeReferences.push(`${document.path} → ${destination}: ${error.message}`);
        }
      }
    }
  }
  if (brokenLinks.length || unsafeReferences.length) {
    for (const value of brokenLinks) console.error(`Unmapped Markdown link: ${value}`);
    for (const value of unsafeReferences) console.error(`Unavailable local reference: ${value}`);
    throw new Error('Content contains unresolved or non-public local references.');
  }
  return markdownLinks;
}

function ownedPath(relative) {
  if (typeof relative !== 'string' || !isPublicPath(relative)) throw new Error('Invalid generated-file manifest entry.');
  const target = path.resolve(rawRoot, relative);
  if (!isWithin(rawRoot, target)) throw new Error('Generated-file manifest path escapes its output directory.');
  return target;
}

async function writeGenerated(roots) {
  await noSymlinks(repoRoot, rawRoot, true);
  await noSymlinks(repoRoot, generatedPath, true);
  await mkdir(rawRoot, { recursive: true });
  await noSymlinks(repoRoot, manifestPath, true);
  let previousFiles = [];
  try {
    const previous = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (previous.generator !== generator || previous.version !== 1 || !Array.isArray(previous.files)) {
      throw new Error('Unrecognized generated-file manifest.');
    }
    previousFiles = previous.files;
    previousFiles.forEach(ownedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const files = [...new Set([...Object.keys(documents), ...resources])].sort();
  const fileSet = new Set(files);
  for (const relative of previousFiles) {
    if (fileSet.has(relative)) continue;
    const target = ownedPath(relative);
    await noSymlinks(rawRoot, target, true);
    try { await unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const relative of files) {
    const target = ownedPath(relative);
    await noSymlinks(rawRoot, target, true);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(await publicSource(relative), target);
  }
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(generatedPath, `${JSON.stringify({ roots, documents }, null, 2)}\n`);
  await writeFile(manifestPath, `${JSON.stringify({ generator, version: 1, files }, null, 2)}\n`);
}

const roots = [];
for (const module of modules) roots.push(await directory(module, module));
for (const relative of ['README.md', 'AGENTS.md']) await loadDocument(relative, 'project');
const markdownLinks = await validateReferences();
await writeGenerated(roots);
console.log(`Generated ${Object.keys(documents).length} documents, ${resources.size} local resources; ${markdownLinks} relative Markdown links mapped.`);
