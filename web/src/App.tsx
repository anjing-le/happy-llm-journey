import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type ComponentType, type MouseEvent } from 'react';
import index from './generated/content.json';
import type { ContentData, ContentDocument, ContentNode } from './content-types';
import { base, decodeAnchor, documentLocation, documentUrl, hasDocument, rawUrl, repositoryUrl } from './navigation';
import CopyButton from './CopyButton';
import { agentEntryPrompt, createDocumentCopy, publishedDocumentUrl } from './document-copy';

const content = index as ContentData;
const Reader = lazy(() => import('./Reader'));
const labels: Record<string, string> = { knowledge: '学习', practices: '最佳实践', activities: '活动' };
type Navigate = (path?: string, anchor?: string, trigger?: HTMLElement) => void;
type Tip = { id: string; title: string; description: string; module: string; left: number; top: number };
type Expansion = { sequence: number; open: boolean };
type ReaderComponentType = ComponentType<ComponentProps<typeof import('./Reader').default>>;

function shouldFollow(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function DocumentIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h7l3 3v11H5zM12 3v4h3M8 10h4M8 13h4" /></svg>;
}

function TreeNode({ node, selected, navigate, expansion, showTip, hideTip }: {
  node: ContentNode; selected?: string; navigate: Navigate; expansion: Expansion;
  showTip: (element: HTMLElement, node: ContentNode) => void; hideTip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const directory = node.type === 'directory';
  useEffect(() => { if (expansion.sequence) setOpen(expansion.open); }, [expansion]);
  useEffect(() => { if (directory && selected !== node.documentPath && selected?.startsWith(node.id + '/')) setOpen(true); }, [directory, selected, node.id, node.documentPath]);
  const active = Boolean(node.documentPath && node.documentPath === selected);
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldFollow(event)) return;
    event.preventDefault(); event.stopPropagation(); hideTip(); navigate(node.documentPath, '', event.currentTarget);
  };
  const detail = node.documentPath && (directory
    ? <a className="detail-link" href={documentUrl(node.documentPath)} aria-label={`阅读：${node.title}`} aria-haspopup="dialog" aria-controls="document-detail" onClick={follow}><DocumentIcon /></a>
    : <CopyButton className="detail-link" iconOnly label="复制全文" target={node.title} beforeCopy={hideTip}
      getText={() => createDocumentCopy(content.documents[node.documentPath!], content.documents)} />);
  const events = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => showTip(event.currentTarget, node),
    onMouseLeave: hideTip,
    onFocus: (event: React.FocusEvent<HTMLElement>) => showTip(event.currentTarget, node),
    onBlur: hideTip,
  };
  return directory ? <details className="tree-directory" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className={`block directory-block${active ? ' is-selected' : ''}`} aria-describedby="node-description" {...events}>
      <span className="chevron" aria-hidden="true">›</span><span className="block-title">{node.title}</span>{detail}
    </summary>
    <div className="tree-children">{node.children.length ? node.children.map((child) => <TreeNode key={child.id} node={child} selected={selected} navigate={navigate} expansion={expansion} showTip={showTip} hideTip={hideTip} />) : <p className="empty-directory">暂无条目</p>}</div>
  </details> : <div className={`block${active ? ' is-selected' : ''}`} {...events}>
    <a className="block-open" href={documentUrl(node.documentPath!)} aria-describedby="node-description" aria-haspopup="dialog" aria-controls="document-detail" onClick={follow}><span className="block-dot" aria-hidden="true" /><span className="block-title">{node.title}</span></a>{detail}
  </div>;
}

function resultNode(document: ContentDocument): ContentNode {
  return { id: document.path, type: 'document', title: document.title, description: document.description, documentPath: document.path, children: [] };
}

export default function App({ initialPath, ReaderComponent = Reader }: { initialPath?: string; ReaderComponent?: ReaderComponentType } = {}) {
  const initialDocument = initialPath && hasDocument(content.documents, initialPath) ? content.documents[initialPath] : undefined;
  const [selected, setSelected] = useState<string | undefined>(initialDocument?.path);
  const [unknown, setUnknown] = useState(false);
  const [query, setQuery] = useState('');
  const [activeModule, setActiveModule] = useState<string>(initialDocument?.module !== 'project' && initialDocument?.module || 'knowledge');
  const [compact, setCompact] = useState(false);
  const [expansion, setExpansion] = useState<Expansion>({ sequence: 0, open: false });
  const [tip, setTip] = useState<Tip>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLAnchorElement>(null);
  const returnUrl = useRef(base);
  const opener = useRef<HTMLElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentDocument = selected && hasDocument(content.documents, selected) ? content.documents[selected] : undefined;

  const hideTip = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip(undefined), 100);
  };
  const clearTip = () => { clearTimeout(hideTimer.current); setTip(undefined); };
  const showTip = (element: HTMLElement, node: ContentNode) => {
    if (!window.matchMedia('(hover: hover)').matches && !window.document.activeElement?.matches(':focus-visible')) return;
    clearTimeout(hideTimer.current);
    const rect = element.getBoundingClientRect();
    setTip({ id: node.id, title: node.title, description: node.description || '暂无说明。', module: node.id.split('/')[0], left: Math.max(12, Math.min(rect.left + 16, window.innerWidth - 352)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 250)) });
  };
  const selectModule = (module: string) => setActiveModule(module);
  const scrollToAnchor = (anchor: string) => {
    if (!anchor) { scrollRef.current?.scrollTo({ top: 0 }); return; }
    requestAnimationFrame(() => window.document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  };
  const navigate: Navigate = (path, anchor = '', trigger) => {
    if (path && !hasDocument(content.documents, path)) return;
    if (path && !currentDocument) {
      returnUrl.current = window.location.pathname + window.location.search;
      opener.current = trigger || window.document.activeElement as HTMLElement;
    }
    const url = new URL(path ? documentUrl(path, anchor) : returnUrl.current, window.location.origin);
    window.history.pushState({}, '', url);
    setSelected(path); setUnknown(false); clearTip();
    const module = path && content.documents[path].module;
    if (module && module !== 'project') selectModule(module);
    setTimeout(() => scrollToAnchor(anchor), 0);
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 720px), (max-width: 1024px) and (hover: none) and (pointer: coarse)');
    const sync = () => setCompact(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      const location = documentLocation(url, content.documents);
      setSelected(location.path); setUnknown(location.unknown); clearTip();
      const module = location.path && content.documents[location.path].module;
      if (module && module !== 'project') selectModule(module);
      setTimeout(() => scrollToAnchor(decodeAnchor(url.hash.slice(1))), 0);
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => { window.document.title = currentDocument ? `${currentDocument.title} · anjing-llm` : 'anjing-llm'; }, [currentDocument]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (currentDocument) {
      // Static article pages start visibly open; promote them to a native modal after hydration.
      if (dialog.open && !dialog.matches(':modal')) dialog.close();
      if (!dialog.open) { dialog.showModal(); closeRef.current?.focus({ preventScroll: true }); }
      window.document.body.classList.add('detail-open');
      scrollToAnchor(decodeAnchor(window.location.hash.slice(1)));
    } else {
      dialog.close(); window.document.body.classList.remove('detail-open');
      const target = opener.current;
      const module = target?.closest<HTMLElement>('.column')?.dataset.module;
      if (module) selectModule(module);
    }
  }, [currentDocument]);
  useEffect(() => {
    if (currentDocument) return;
    const target = opener.current;
    const module = target?.closest<HTMLElement>('.column')?.dataset.module;
    // Focus only after React has removed inert from the entry column.
    if (target?.isConnected && (!compact || !module || activeModule === module)) {
      target.focus({ preventScroll: true });
      const rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      opener.current = null;
    }
  }, [currentDocument, activeModule, compact]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') clearTip(); };
    const close = () => clearTip();
    window.addEventListener('keydown', keyboard); window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    return () => {
      clearTimeout(hideTimer.current); window.document.body.classList.remove('detail-open');
      window.removeEventListener('keydown', keyboard); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close);
    };
  }, []);

  const search = query.trim().toLocaleLowerCase();
  const results = search ? Object.values(content.documents).filter((item) => item.module !== 'project' && `${item.title}\n${item.markdown}`.toLocaleLowerCase().includes(search)) : [];
  return <main className="workspace" data-active={compact ? activeModule : undefined} aria-label="学习、最佳实践与活动">
    <nav className="level-switch" aria-label="切换栏目">{content.roots.map((node) => <button key={node.id} type="button" data-module={node.id} aria-current={activeModule === node.id ? 'true' : undefined} onClick={() => { clearTip(); selectModule(node.id); }}>{labels[node.id]}</button>)}</nav>
    {unknown && <p className="not-found" role="status">这份文档不存在，请从目录选择。</p>}
    <div className="board">
      {content.roots.map((node) => <section className="column" key={node.id} data-module={node.id} data-active={activeModule === node.id ? 'true' : undefined} aria-label={labels[node.id]} inert={compact && activeModule !== node.id ? true : undefined}>
        <a className="column-label" href={documentUrl(node.documentPath!)} aria-describedby="node-description" onMouseEnter={(event) => showTip(event.currentTarget, node)} onMouseLeave={hideTip} onFocus={(event) => showTip(event.currentTarget, node)} onBlur={hideTip} onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); navigate(node.documentPath, '', event.currentTarget); } }}>{labels[node.id]}</a>
        <div className="slots">{(search ? results.filter((item) => item.module === node.id).map(resultNode) : node.children).map((child) => <TreeNode key={child.id} node={child} selected={selected} navigate={navigate} expansion={expansion} showTip={showTip} hideTip={hideTip} />)}</div>
      </section>)}
    </div>
    <footer className="workspace-tools">
      <button type="button" aria-label="全部展开" onClick={() => { clearTip(); setExpansion({ sequence: expansion.sequence + 1, open: true }); }}>展开</button>
      <button type="button" aria-label="全部折叠" onClick={() => { clearTip(); setExpansion({ sequence: expansion.sequence + 1, open: false }); }}>收起</button>
      <details className="search-panel" onToggle={(event) => { if (!event.currentTarget.open) setQuery(''); }}><summary>查找</summary><input type="search" aria-label="查找内容" placeholder="查找内容" value={query} onChange={(event) => { setQuery(event.target.value); clearTip(); }} /></details>
      <a href={documentUrl('README.md')} onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); navigate('README.md', '', event.currentTarget); } }}>项目</a>
      <CopyButton label="交给 Agent" getText={() => agentEntryPrompt(content.documents['README.md'])} beforeCopy={clearTip} />
      <a className="repository-link" href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
    </footer>
    {tip && <aside id="node-description" className="tooltip" data-module={tip.module} role="tooltip" aria-label={`${tip.title}说明`} style={{ left: tip.left, top: tip.top }} onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={hideTip}><p>{tip.description}</p><button type="button" aria-label="关闭说明" onClick={clearTip}>×</button></aside>}
    <dialog className="detail" id="document-detail" data-module={currentDocument?.module} ref={dialogRef} open={Boolean(initialDocument) || undefined} aria-label={currentDocument?.title || '文档正文'} onCancel={(event) => { if (event.target !== event.currentTarget) return; event.preventDefault(); navigate(); }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) navigate();
    }}>
      {currentDocument && <>
        <div className="detail-top">
          <span className="document-name">{currentDocument.title}</span>
          <div className="detail-actions" key={currentDocument.path}>
            <CopyButton label="复制全文" target={currentDocument.title} getText={() => createDocumentCopy(currentDocument, content.documents)} />
            <CopyButton label="复制链接" target={currentDocument.title} iconOnly link getText={() => publishedDocumentUrl(currentDocument.path)} />
            <a className="raw-link" href={rawUrl(currentDocument.path)} target="_blank" rel="noreferrer">Markdown ↗</a>
          </div>
          <a className="close-detail" ref={closeRef} href={base} aria-label="关闭正文" onClick={(event) => { if (shouldFollow(event)) { event.preventDefault(); navigate(); } }}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></a>
        </div>
        <div className="detail-scroll" ref={scrollRef}><Suspense fallback={<p className="reader-loading" role="status">加载文档…</p>}><ReaderComponent key={currentDocument.path} document={currentDocument} navigate={navigate} documents={content.documents} /></Suspense></div>
      </>}
    </dialog>
  </main>;
}
