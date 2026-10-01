import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type ComponentType, type MouseEvent } from 'react';
import index from './generated/content.json';
import type { ContentData, ContentNode } from './content-types';
import { base, decodeAnchor, documentLocation, documentUrl, hasDocument, repositoryUrl } from './navigation';

const content = index as ContentData;
const Reader = lazy(() => import('./Reader'));
type Navigate = (path?: string, anchor?: string) => void;
type Tip = { title: string; description: string; left: number; top: number };
type Expansion = { sequence: number; open: boolean };
type ReaderComponentType = ComponentType<ComponentProps<typeof import('./Reader').default>>;

function shouldFollow(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function TreeNode({ node, depth, selected, navigate, expansion, showTip, hideTip }: {
  node: ContentNode; depth: number; selected?: string; navigate: Navigate;
  expansion: Expansion; showTip: (element: HTMLElement, node: ContentNode) => void; hideTip: () => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const directory = node.type === 'directory';
  useEffect(() => {
    if (expansion.sequence) setOpen(expansion.open);
  }, [expansion]);
  useEffect(() => {
    if (directory && selected?.startsWith(node.id + '/')) setOpen(true);
  }, [directory, selected, node.id]);
  const active = Boolean(node.documentPath && node.documentPath === selected);
  const label = node.documentPath ? <a className="tree-label" href={documentUrl(node.documentPath)} aria-current={active ? 'page' : undefined} onClick={(event) => {
    if (!shouldFollow(event)) return;
    event.preventDefault(); event.stopPropagation(); hideTip(); navigate(node.documentPath);
  }}>{node.title}</a> : <span className="tree-label">{node.title}</span>;
  const row = <>
    <span className="chevron" aria-hidden="true">{directory ? '›' : '·'}</span>
    {depth === 0 && <span className={`module-dot module-dot--${node.id}`} aria-hidden="true" />}
    {label}
    <button className="info-button" type="button" aria-label={`查看说明：${node.title}`} onClick={(event) => {
      event.preventDefault(); event.stopPropagation(); showTip(event.currentTarget, node);
    }}>i</button>
  </>;
  const events = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => showTip(event.currentTarget, node),
    onMouseLeave: hideTip,
    onFocus: (event: React.FocusEvent<HTMLElement>) => showTip(event.currentTarget, node),
    onBlur: hideTip,
  };
  return directory ? <details className={depth === 0 ? 'tree-module' : 'tree-directory'} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className={`tree-row${active ? ' is-selected' : ''}`} {...events}>{row}</summary>
    <div className="tree-children">{node.children.length ? node.children.map((child) => <TreeNode key={child.id} node={child} depth={depth + 1} selected={selected} navigate={navigate} expansion={expansion} showTip={showTip} hideTip={hideTip} />) : <p className="empty-directory">暂无条目</p>}</div>
  </details> : <div className={`tree-row tree-leaf${active ? ' is-selected' : ''}`} {...events}>{row}</div>;
}


export default function App({ initialPath, ReaderComponent = Reader }: { initialPath?: string; ReaderComponent?: ReaderComponentType } = {}) {
  const [selected, setSelected] = useState<string | undefined>(() => initialPath && hasDocument(content.documents, initialPath) ? initialPath : undefined);
  const [unknown, setUnknown] = useState(false);
  const [query, setQuery] = useState('');
  const [expansion, setExpansion] = useState<Expansion>({ sequence: 0, open: true });
  const [tip, setTip] = useState<Tip>();
  const [mobileDirectory, setMobileDirectory] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const document = selected && hasDocument(content.documents, selected) ? content.documents[selected] : undefined;

  const hideTip = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip(undefined), 100);
  };
  const showTip = (element: HTMLElement, node: ContentNode) => {
    clearTimeout(hideTimer.current);
    const rect = element.getBoundingClientRect();
    setTip({ title: node.title, description: node.description || '暂无说明。', left: Math.max(12, Math.min(rect.left + 25, window.innerWidth - 352)), top: Math.min(rect.bottom + 8, window.innerHeight - 190) });
  };
  const scrollToAnchor = (anchor: string) => {
    if (!anchor) { window.scrollTo({ top: 0 }); readerRef.current?.scrollTo({ top: 0 }); return; }
    requestAnimationFrame(() => window.document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  };
  const navigate: Navigate = (path, anchor = '') => {
    const url = new URL(path ? documentUrl(path, anchor) : base, window.location.origin);
    window.history.pushState({}, '', url);
    setSelected(path); setUnknown(false); setMobileDirectory(false); setTip(undefined);
    setTimeout(() => scrollToAnchor(anchor), 0);
  };

  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      const location = documentLocation(url, content.documents);
      setSelected(location.path);
      setUnknown(location.unknown);
      setTip(undefined); setMobileDirectory(false);
      setTimeout(() => scrollToAnchor(decodeAnchor(url.hash.slice(1))), 0);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    window.document.title = document ? `${document.title} · anjing-llm` : 'anjing-llm';
  }, [document]);
  useEffect(() => {
    const close = () => setTip(undefined);
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  const search = query.trim().toLocaleLowerCase();
  const results = search ? Object.values(content.documents).filter((item) => item.module !== 'project' && `${item.title}\n${item.markdown}`.toLocaleLowerCase().includes(search)) : [];
  return <main className={`journey${document ? ' journey--reading' : ''}`}>
    <header className="site-tools">
      <a className="home-link" href={base} onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); setQuery(''); navigate(); } }}>目录</a>
      <a className="repository-link" href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
    </header>
    {document && <button type="button" className="mobile-directory-button" aria-expanded={mobileDirectory} onClick={() => { setMobileDirectory(!mobileDirectory); setTip(undefined); }}>{mobileDirectory ? '收起目录' : '展开目录'} <span aria-hidden="true">⌄</span></button>}
    <div className="layout">
      <aside className={`directory${mobileDirectory ? ' directory--mobile-open' : ''}`} aria-label="内容目录">
        <div className="search-field"><span aria-hidden="true">⌕</span><input type="search" aria-label="查找内容" placeholder="查找内容" value={query} onChange={(event) => { setQuery(event.target.value); setTip(undefined); }} /></div>
        {unknown && <p className="not-found" role="status">这份文档不存在，请从目录选择。</p>}
        <div className="tree" aria-label="知识、最佳实践与活动目录">
          {search ? <div className="search-results" aria-live="polite">
            <p className="result-count">{results.length ? `找到 ${results.length} 份文档` : '暂无匹配文档'}</p>
            {results.map((item) => <a key={item.path} className="search-result" href={documentUrl(item.path)} onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); navigate(item.path); } }}><strong>{item.title}</strong><span>{item.description}</span></a>)}
          </div> : content.roots.map((node) => <TreeNode key={node.id} node={node} depth={0} selected={selected} navigate={navigate} expansion={expansion} showTip={showTip} hideTip={hideTip} />)}
        </div>
        {!search && <nav className="tree-tools" aria-label="目录操作">
          <button type="button" onClick={() => { setTip(undefined); setExpansion({ sequence: expansion.sequence + 1, open: true }); }}>全部展开</button>
          <button type="button" onClick={() => { setTip(undefined); setExpansion({ sequence: expansion.sequence + 1, open: false }); }}>全部折叠</button>
        </nav>}
        <nav className="project-links" aria-label="项目说明">
          {['目标', '维护规则', '待办'].map((name) => <a key={name} href={documentUrl('README.md', name)} onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); navigate('README.md', name); } }}>{name}</a>)}
        </nav>
      </aside>
      {document && <div className="reader-container" ref={readerRef}><Suspense fallback={<p className="reader-loading" role="status">加载文档…</p>}><ReaderComponent key={document.path} document={document} navigate={navigate} documents={content.documents} /></Suspense></div>}
    </div>
    {tip && <aside className="tooltip" role="tooltip" style={{ left: tip.left, top: Math.max(12, tip.top) }} onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={hideTip}>
      <strong>{tip.title}</strong><p>{tip.description}</p>
      <button type="button" aria-label="关闭说明" onClick={() => setTip(undefined)}>×</button>
    </aside>}
  </main>;
}
