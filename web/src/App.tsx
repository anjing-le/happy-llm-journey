import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type MouseEvent } from 'react';
import index from './generated/content.json';
import type { ContentData, ContentDocument, ContentNode } from './content-types';
import { base, decodeAnchor, documentLocation, documentUrl, hasDocument, rawUrl, repositoryUrl } from './navigation';
import { agentEntryPrompt, createDocumentCopy, publishedDocumentUrl } from './document-copy';
import { documentSections, type DocumentSection } from './document-outline';
import CopyButton from './CopyButton';
import ContentMap, { type MapEntry } from './ContentMap';
import Icon, { type IconName } from './Icons';

const content = index as ContentData;
const Reader = lazy(() => import('./Reader'));
const labels: Record<string, string> = { knowledge: '学习', practices: '最佳实践', activities: '活动', project: '项目' };
const moduleIcons: Record<string, IconName> = { knowledge: 'book', practices: 'practice', activities: 'activity', project: 'book' };
type Navigate = (path?: string, anchor?: string, trigger?: Element) => void;
type Expansion = { sequence: number; open: boolean };
type View = 'read' | 'map';
type ReaderComponentType = ComponentType<ComponentProps<typeof import('./Reader').default>>;

function shouldFollow(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function firstDocument(node: ContentNode): string | undefined {
  return node.documentPath || node.children.map(firstDocument).find(Boolean);
}

function findNode(nodes: ContentNode[], path: string): ContentNode | undefined {
  for (const node of nodes) {
    if (node.documentPath === path) return node;
    const child = findNode(node.children, path);
    if (child) return child;
  }
}

function TreeNode({ node, selected, navigate, expansion }: {
  node: ContentNode; selected: string; navigate: Navigate; expansion: Expansion;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (expansion.sequence) setOpen(expansion.open); }, [expansion]);
  useEffect(() => { if (node.type === 'directory' && selected.startsWith(node.id + '/')) setOpen(true); }, [selected, node.id, node.type]);
  const active = node.documentPath === selected;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldFollow(event)) return;
    event.preventDefault(); event.stopPropagation(); navigate(node.documentPath, '', event.currentTarget);
  };
  const copy = node.documentPath && <CopyButton className="node-copy" iconOnly label="复制全文" target={node.title} getText={() => createDocumentCopy(content.documents[node.documentPath!], content.documents)} />;
  if (node.type === 'directory') return <details className="tree-directory" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={`tree-row${active ? ' is-selected' : ''}`}>
      <span className="tree-chevron" aria-hidden="true">›</span><Icon name="folder" className="tree-icon" />
      <span className="tree-title">{node.title}</span>
      {node.documentPath && <a className="tree-open" href={documentUrl(node.documentPath)} aria-label={`阅读：${node.title}`} onClick={follow}><Icon name="file" /></a>}
    </summary>
    <div className="tree-children">{node.children.length ? node.children.map(child => <TreeNode key={child.id} node={child} selected={selected} navigate={navigate} expansion={expansion} />) : <span className="tree-empty">暂无条目</span>}</div>
  </details>;
  return <div className={`tree-row${active ? ' is-selected' : ''}`}>
    <a className="tree-link" href={documentUrl(node.documentPath!)} aria-current={active ? 'page' : undefined} onClick={follow}><Icon name="file" className="tree-icon" /><span className="tree-title">{node.title}</span></a>{copy}
  </div>;
}

export default function App({ initialPath, ReaderComponent = Reader }: { initialPath?: string; ReaderComponent?: ReaderComponentType } = {}) {
  const initialDocument = initialPath && hasDocument(content.documents, initialPath) ? content.documents[initialPath] : undefined;
  const [selected, setSelected] = useState<string | undefined>(initialDocument?.path);
  const [activeModule, setActiveModule] = useState<string>(initialDocument?.module !== 'project' && initialDocument?.module || 'knowledge');
  const [view, setView] = useState<View>(initialDocument ? 'read' : 'map');
  const [sectionId, setSectionId] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expansion, setExpansion] = useState<Expansion>({ sequence: 0, open: false });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchDialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const contextRef = useRef<HTMLElement>(null);
  const activeRoot = content.roots.find(node => node.id === activeModule) || content.roots[0];
  const currentDocument = selected && hasDocument(content.documents, selected) ? content.documents[selected] : content.documents[activeRoot.documentPath!];
  const currentNode = findNode(content.roots, currentDocument.path);
  const directoryChildren = currentNode?.type === 'directory' && currentNode.id === activeRoot.id ? currentNode.children : [];
  const sections = useMemo(() => documentSections(currentDocument.markdown), [currentDocument.markdown]);
  const activeSection = sections.find(section => section.id === sectionId) || sections[0];
  const directoryEntries: MapEntry[] = directoryChildren.flatMap(node => {
    const path = firstDocument(node);
    return path ? [{ id: node.id, title: node.title, description: node.description, href: documentUrl(path), icon: node.type === 'directory' ? 'folder' as const : 'file' as const }] : [];
  });
  const chapterEntries: MapEntry[] = sections.map(section => ({ id: section.id, title: section.title, href: documentUrl(currentDocument.path, section.id), icon: 'file' }));
  const isDirectoryMap = directoryEntries.length > 0;
  const mapEntries = isDirectoryMap ? directoryEntries : chapterEntries;
  const canMap = isDirectoryMap || sections.length > 1;
  const visibleView: View = view === 'map' && canMap ? 'map' : 'read';
  const search = query.trim().toLocaleLowerCase();
  const results = search ? Object.values(content.documents).filter(document => document.module !== 'project' && `${document.title}\n${document.markdown}`.toLocaleLowerCase().includes(search)) : [];

  const scrollToAnchor = (anchor: string) => requestAnimationFrame(() => {
    const target = anchor ? window.document.getElementById(anchor) || contentRef.current : contentRef.current;
    target?.scrollIntoView({ block: 'start' });
  });
  const selectModule = (module: string) => {
    const root = content.roots.find(node => node.id === module);
    if (!root?.documentPath) return;
    setActiveModule(module); setSelected(undefined); setView('map'); setSectionId(''); setUnknown(false); setSidebarOpen(false);
    window.history.pushState({ journeyView: 'map' }, '', documentUrl(root.documentPath));
    window.scrollTo({ top: 0 });
  };
  const navigate: Navigate = (path, anchor = '') => {
    if (!path) { selectModule(activeModule); return; }
    if (!hasDocument(content.documents, path)) return;
    const document = content.documents[path];
    setSelected(path); setView('read'); setSectionId(anchor); setUnknown(false); setSidebarOpen(false); setSearchOpen(false);
    if (document.module !== 'project') setActiveModule(document.module);
    window.history.pushState({ journeyView: 'read' }, '', documentUrl(path, anchor));
    if (anchor) scrollToAnchor(anchor); else window.scrollTo({ top: 0 });
  };
  const chooseSection = (section: DocumentSection) => {
    const nextView = isDirectoryMap ? 'read' : visibleView;
    setSelected(currentDocument.path);
    if (nextView !== visibleView) setView(nextView);
    setSectionId(section.id);
    window.history.pushState({ journeyView: nextView }, '', documentUrl(currentDocument.path, section.id));
    if (nextView === 'read') scrollToAnchor(section.id);
    else requestAnimationFrame(() => {
      contextRef.current?.scrollTo({ top: 0 });
      if (window.matchMedia('(max-width: 1100px)').matches) contextRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  const chooseView = (next: View) => {
    setView(next);
    window.history.replaceState({ ...window.history.state, journeyView: next }, '');
    if (next === 'read' && sectionId) scrollToAnchor(sectionId);
  };
  const chooseMapEntry = (entry: MapEntry) => {
    if (isDirectoryMap) {
      const node = directoryChildren.find(item => item.id === entry.id);
      const path = node && firstDocument(node);
      if (path) navigate(path);
    } else {
      const section = sections.find(item => item.id === entry.id);
      if (section) chooseSection(section);
    }
  };
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { window.localStorage.setItem('happy-llm-theme', next); } catch { /* Storage can be unavailable in private browsing. */ }
  };

  useEffect(() => {
    setEnhanced(true);
    try {
      const saved = window.localStorage.getItem('happy-llm-theme');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
      else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
    } catch { /* The default appearance remains usable without storage. */ }
  }, []);
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      const location = documentLocation(url, content.documents);
      const document = location.path && content.documents[location.path];
      const requested = url.searchParams.get('module');
      const module = document && document.module !== 'project' ? document.module : content.roots.some(node => node.id === requested) ? requested! : 'knowledge';
      setSelected(location.path); setUnknown(location.unknown); setActiveModule(module); setSidebarOpen(false); setSearchOpen(false);
      const savedView = window.history.state?.journeyView;
      const mode: View = savedView === 'map' || savedView === 'read' ? savedView : location.path ? 'read' : 'map';
      setView(mode); setSectionId(decodeAnchor(url.hash.slice(1)));
      if (mode === 'read' && url.hash) scrollToAnchor(decodeAnchor(url.hash.slice(1)));
    };
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => { window.document.title = selected ? `${currentDocument.title} · anjing-llm` : 'anjing-llm'; }, [currentDocument.title, selected]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !window.document.querySelector('.copy-fallback[open]')) {
        event.preventDefault(); setSearchOpen(open => !open);
      }
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const dialog = searchDialog.current;
    if (!dialog) return;
    if (searchOpen) {
      if (!dialog.open) dialog.showModal();
      searchInput.current?.focus();
    } else if (dialog.open) {
      dialog.close(); setQuery(''); searchTrigger.current?.focus({ preventScroll: true });
    }
  }, [searchOpen]);

  const sectionDocument = activeSection ? { ...currentDocument, title: activeSection.title, markdown: activeSection.markdown } : undefined;
  const copyDocument = () => createDocumentCopy(currentDocument, content.documents);
  const guide = content.documents['GUIDE.zh-CN.md'];
  const sectionIndex = activeSection ? sections.indexOf(activeSection) : 0;

  return <main className="journey-shell" data-module={activeModule} data-theme={theme} data-enhanced={enhanced ? 'true' : undefined} aria-label="学习、最佳实践与活动">
    <header className="app-header">
      <a className="brand" href={base} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); selectModule('knowledge'); } }}><img className="brand-mark" src={`${base}favicon-ai.png`} alt="" /><span>Happy <strong>LLM</strong> Journey</span></a>
      <nav className="module-tabs" aria-label="切换栏目">{content.roots.map(node => <a key={node.id} href={documentUrl(node.documentPath!)} aria-current={activeModule === node.id ? 'page' : undefined} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); selectModule(node.id); } }}><Icon name={moduleIcons[node.id]} /><span>{labels[node.id]}</span></a>)}</nav>
      <div className="header-tools">
        <button ref={searchTrigger} type="button" className="search-open" aria-label="搜索内容" aria-haspopup="dialog" onClick={() => setSearchOpen(true)}><Icon name="search" /><span>搜索内容…</span><kbd aria-hidden="true">⌘ K</kbd></button>
        <button className="theme-toggle" type="button" aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'} onClick={toggleTheme}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
        <CopyButton className="header-agent" label="交给 Agent" getText={() => agentEntryPrompt(guide)} />
        <a className="header-github" href={repositoryUrl} target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库"><Icon name="github" /></a>
      </div>
    </header>
    <div className="mobile-directory-bar"><button className="menu-toggle" type="button" aria-controls="content-directory" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)}><Icon name={sidebarOpen ? 'close' : 'menu'} /><span>{sidebarOpen ? '收起目录' : '打开目录'}</span></button><span>{labels[activeModule]}</span></div>
    <div className="app-layout">
      <aside id="content-directory" className={`sidebar${sidebarOpen ? ' is-open' : ''}`} aria-label={`${labels[activeModule]}目录`}>
        <div className="sidebar-head"><span><Icon name={moduleIcons[activeModule]} />{labels[activeModule]}目录</span><div className="sidebar-tools"><button type="button" aria-label="全部展开" onClick={() => setExpansion(value => ({ sequence: value.sequence + 1, open: true }))}><Icon name="expand" /></button><button type="button" aria-label="全部折叠" onClick={() => setExpansion(value => ({ sequence: value.sequence + 1, open: false }))}><Icon name="collapse" /></button></div></div>
        <div className="tree-root">{activeRoot.children.map(node => <TreeNode key={node.id} node={node} selected={currentDocument.path} navigate={navigate} expansion={expansion} />)}</div>
        <div className="sidebar-footer"><a href={documentUrl(activeRoot.documentPath!)} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); navigate(activeRoot.documentPath); } }}><Icon name="book" />本栏说明</a><a href={documentUrl('GUIDE.zh-CN.md')} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); navigate('GUIDE.zh-CN.md'); } }}><Icon name="file" />项目说明</a></div>
      </aside>

      <section className="reading-column" ref={contentRef} aria-labelledby="document-title">
        {unknown && <p className="not-found" role="status">这份文档不存在，请从目录选择。</p>}
        <div className="document-header">
          <div className="document-eyebrow"><span>{labels[currentDocument.module]}</span><span aria-hidden="true">/</span><span>{visibleView === 'map' ? '内容结构' : '正文'}</span></div>
          <div className="document-heading"><h1 id="document-title">{!selected ? labels[activeModule] : currentDocument.title}</h1>{canMap && <div className="view-switch" role="group" aria-label="查看方式"><button type="button" aria-pressed={visibleView === 'read'} onClick={() => chooseView('read')}><Icon name="book" />阅读</button><button type="button" aria-pressed={visibleView === 'map'} onClick={() => chooseView('map')}><Icon name="map" />图览</button></div>}</div>
          {!selected && <p className="document-subtitle">{currentDocument.description}</p>}
          <div className="document-actions" key={currentDocument.path}><CopyButton label="复制全文" target={currentDocument.title} getText={copyDocument} /><CopyButton label="复制链接" target={currentDocument.title} iconOnly link getText={() => publishedDocumentUrl(currentDocument.path)} /><a className="source-link" href={rawUrl(currentDocument.path)} target="_blank" rel="noreferrer">Markdown ↗</a></div>
        </div>

        <div className={`content-surface ${visibleView === 'read' ? 'reader-surface' : ''}`}>
          {visibleView === 'map' ? <ContentMap title={!selected ? labels[activeModule] : currentDocument.title} entries={mapEntries} selected={isDirectoryMap ? undefined : activeSection?.id} icon={moduleIcons[currentDocument.module]} onChoose={chooseMapEntry} /> : <Suspense fallback={<p className="reader-loading" role="status">加载正文…</p>}><ReaderComponent key={currentDocument.path} document={currentDocument} navigate={navigate} documents={content.documents} /></Suspense>}
        </div>
        {visibleView === 'map' && <p className="map-caption">{isDirectoryMap ? '选择一个节点，阅读对应内容。' : '选择一个章节，查看原文。'}</p>}
        {visibleView === 'map' && !isDirectoryMap && sections.length > 1 && <nav className="step-navigation" aria-label="章节顺序">{sections.map((section, position) => <button key={section.id} type="button" className={`step-chip${activeSection?.id === section.id ? ' is-active' : ''}`} aria-current={activeSection?.id === section.id ? 'step' : undefined} onClick={() => chooseSection(section)}><span>{position + 1}</span>{section.title}</button>)}</nav>}
      </section>

      <aside className="context-column" ref={contextRef} aria-label="本篇导航与使用">
        <div className="context-card">
          {visibleView === 'map' && !isDirectoryMap && sectionDocument ? <>
            <div className="context-label"><span>当前章节</span><span className="section-count">{sectionIndex + 1} / {sections.length}</span></div>
            <div className="section-reader"><Suspense fallback={<p className="reader-loading">加载章节…</p>}><ReaderComponent document={sectionDocument} navigate={navigate} documents={content.documents} focus={false} sectionAnchor={activeSection.id} /></Suspense></div>
            <div className="context-bottom"><div className="step-actions"><button type="button" aria-label="上一章节" disabled={sectionIndex <= 0} onClick={() => chooseSection(sections[sectionIndex - 1])}><Icon name="back" />上一步</button><button type="button" aria-label="下一章节" disabled={sectionIndex >= sections.length - 1} onClick={() => chooseSection(sections[sectionIndex + 1])}>下一步<Icon name="arrow" /></button></div></div>
          </> : <>
            <div className="context-label">{visibleView === 'map' ? '本栏说明' : '本篇目录'}</div>
            {visibleView === 'map' && <p className="context-summary">{currentDocument.description}</p>}
            <nav className="toc-list" aria-label="本篇章节">{sections.map(section => <a key={section.id} className={`toc-link${section.depth === 3 ? ' toc-level-3' : ''}${activeSection?.id === section.id ? ' is-active' : ''}`} href={documentUrl(currentDocument.path, section.id)} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); chooseSection(section); } }}>{section.title}</a>)}</nav>
            {visibleView === 'map' && <a className="read-overview" href={documentUrl(currentDocument.path)} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); chooseView('read'); } }}>阅读完整说明<Icon name="arrow" /></a>}
          </>}
        </div>
        <div className="context-card document-tools" key={currentDocument.path}><div className="context-label">带到你的 Agent</div><CopyButton label="复制全文" target={currentDocument.title} getText={copyDocument} /><a className="source-link" href={rawUrl(currentDocument.path)} target="_blank" rel="noreferrer"><Icon name="file" />打开 Markdown 原文 ↗</a></div>
      </aside>
    </div>

    <dialog ref={searchDialog} className="search-dialog" aria-label="搜索内容" onCancel={event => { event.preventDefault(); setSearchOpen(false); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSearchOpen(false);
    }}>
      <div className="search-dialog-head"><Icon name="search" /><input ref={searchInput} className="search-input" type="search" placeholder="搜索标题或正文…" aria-label="查找内容" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" className="search-close" aria-label="关闭搜索" onClick={() => setSearchOpen(false)}><Icon name="close" /></button></div>
      <div className="search-results">{!search ? <p className="search-empty">输入关键词，搜索已有内容。</p> : results.length ? results.map(document => <a className="search-result" key={document.path} href={documentUrl(document.path)} onClick={event => { if (shouldFollow(event)) { event.preventDefault(); navigate(document.path); } }}><span className="search-result-module">{labels[document.module]}</span><span>{document.title}</span><Icon name="arrow" /></a>) : <p className="search-empty" role="status">没有找到相关内容。</p>}</div>
    </dialog>
  </main>;
}
