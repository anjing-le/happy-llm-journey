"""Rebuild overview.html from the three Markdown modules: python3 scripts/build_overview.py."""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
GITHUB = 'https://github.com/anjing-le/happy-llm-journey/blob/main/'
LABELS = {'assignments': '候选题目', 'docs': '说明文档', 'templates': '作业模板',
          'student-repo': '学员仓库', 'student-visible': '公开题面',
          'prompts': '阶段提示词', 'evidence': '验证证据', '.github': 'GitHub 协作'}
SECTION_FILES = {'activities/01-learn-llm/README.md',
                 'activities/02-how-to-vibe-coding/DESIGN.md',
                 'activities/03-team-vibe-coding/README.md'}


def plain(text):
    text = re.sub(r'!?\[([^\]]+)\]\([^)]*\)', r'\1', text)
    return re.sub(r'[*`#>]', '', text).strip()


def excerpt(text):
    lines = []
    for line in text.splitlines():
        if lines and not line.strip():
            break
        if not line.strip() or line.startswith('#') or '返回' in line or line.startswith('|'):
            continue
        line = re.sub(r'^\s*(?:[-*]|\d+\.)\s+', '', line)
        lines.append(plain(line))
        if len(' '.join(lines)) >= 110:
            break
    value = ' '.join(lines)
    return value[:177] + '…' if len(value) > 180 else value


def md_node(path, kind='文档'):
    text = path.read_text()
    rel = path.relative_to(ROOT).as_posix()
    title = re.search(r'^# (.+)$', text, re.M)
    node = {'title': plain(title[1]) if title else path.stem,
            'description': excerpt(text), 'path': rel, 'kind': kind,
            'url': GITHUB + quote(rel), 'children': []}
    if rel in SECTION_FILES:
        sections = re.split(r'^## (.+)\n', text, flags=re.M)
        for i in range(1, len(sections), 2):
            name, body = sections[i:i + 2]
            section = {'title': name, 'description': excerpt(body), 'path': rel,
                       'kind': '章节', 'url': node['url'], 'children': []}
            for match in re.finditer(r'^(?:- |\d+\. )\*\*(.+?)\*\*[：:]\s*(.+)$', body, re.M):
                section['children'].append({'title': match[1], 'description': plain(match[2]),
                                            'path': rel, 'kind': '要点', 'url': node['url'], 'children': []})
            node['children'].append(section)
    return node


def directory(path):
    readme = path / 'README.md'
    node = md_node(readme, '目录') if readme.exists() else {
        'title': LABELS.get(path.name, path.name), 'description': '',
        'path': path.relative_to(ROOT).as_posix(), 'kind': '目录', 'url': '', 'children': []}
    for entry in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name)):
        if entry.is_dir() and any(entry.rglob('*.md')):
            node['children'].append(directory(entry))
        elif entry.suffix == '.md' and entry.name != 'README.md':
            node['children'].append(md_node(entry))
    if not readme.exists():
        node['description'] = '包含：' + '、'.join(child['title'] for child in node['children'])
    return node


def inline_md(value):
    value = html.escape(value)
    def link(match):
        label, url = match.groups()
        if not url.startswith(('https://', 'http://')):
            url = GITHUB + quote(url, safe='/#')
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
    value = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', value)
    return re.sub(r'`(.+?)`', r'<code>\1</code>', value)


def reference_sections():
    sections = re.split(r'^## (.+)\n', (ROOT / 'README.md').read_text(), flags=re.M)
    output = []
    for i in range(1, len(sections), 2):
        title, body = sections[i:i+2]
        parts = []
        in_list = False
        for line in body.strip().splitlines():
            if line.startswith('- '):
                if not in_list:
                    parts.append('<ul>')
                    in_list = True
                line = re.sub(r'^- \[ \] ', '', line) if line.startswith('- [ ] ') else line[2:]
                parts.append('<li>' + inline_md(line) + '</li>')
            else:
                if in_list:
                    parts.append('</ul>')
                    in_list = False
                if line.strip():
                    parts.append('<p>' + inline_md(line) + '</p>')
        if in_list:
            parts.append('</ul>')
        output.append('<details class="reference"><summary>' + html.escape(title) + '</summary><div>' + ''.join(parts) + '</div></details>')
    return '\n'.join(output)


data = [directory(ROOT / name) for name in ('knowledge', 'practices', 'activities')]
template = (ROOT / 'scripts/overview.template.html').read_text()
payload = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
(ROOT / 'overview.html').write_text(template.replace('/*__TREE_DATA__*/[]', payload).replace('<!--__REFERENCE__-->', reference_sections()))
print('Generated overview.html from knowledge/, practices/, activities/.')
