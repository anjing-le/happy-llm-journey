import { useEffect, useRef, type MouseEvent } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { ContentDocument } from './content-types';
import { base, decodeAnchor, documentLocation, rawUrl, repositoryUrl, resolveMarkdownUrl } from './navigation';

type Navigate = (path?: string, anchor?: string) => void;
function shouldFollow(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function Reader({ document, navigate, documents }: { document: ContentDocument; navigate: Navigate; documents: Record<string, ContentDocument> }) {
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    articleRef.current?.focus({ preventScroll: true });
    const anchor = decodeAnchor(window.location.hash.slice(1));
    if (anchor) requestAnimationFrame(() => window.document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  }, [document.path]);
  return <section className="reader" aria-label={document.title}>
    <nav className="reader-tools" aria-label="文档操作">
      <a href={rawUrl(document.path)} target="_blank" rel="noreferrer">Markdown 原文 ↗</a>
      <a href={`${repositoryUrl}/blob/main/${document.path}`} target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>
    <article className="markdown" tabIndex={-1} ref={articleRef}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} urlTransform={(url) => defaultUrlTransform(resolveMarkdownUrl(url, document.path, documents))} components={{
        a: ({ href, children, node: _node, ...props }) => {
          const internal = href?.startsWith(`${base}read/`) || href?.startsWith('?doc=');
          return <a {...props} href={href} target={internal || href?.startsWith('#') ? undefined : '_blank'} rel={internal ? undefined : 'noreferrer'} onClick={(event) => {
            if (!internal || !shouldFollow(event)) return;
            event.preventDefault();
            const target = new URL(href!, 'https://repository.invalid/');
            const location = documentLocation(target, documents);
            if (location.path) navigate(location.path, decodeAnchor(target.hash.slice(1)));
          }}>{children}</a>;
        },
        img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
        table: ({ node: _node, ...props }) => <div className="table-scroll"><table {...props} /></div>,
      }}>{document.markdown}</Markdown>
    </article>
  </section>;
}
