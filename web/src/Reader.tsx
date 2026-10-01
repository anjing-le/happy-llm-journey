import { useEffect, useRef, type MouseEvent } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import type { ContentDocument } from './content-types';
import { base, decodeAnchor, documentLocation, resolveMarkdownUrl } from './navigation';

type Navigate = (path?: string, anchor?: string) => void;
function shouldFollow(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function isDecorativeImage(src: string) {
  try { return new URL(src, 'https://repository.invalid/').pathname.endsWith('/assets/journey-poster.png'); }
  catch { return false; }
}

export default function Reader({ document, navigate, documents }: { document: ContentDocument; navigate: Navigate; documents: Record<string, ContentDocument> }) {
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    articleRef.current?.focus({ preventScroll: true });
    const anchor = decodeAnchor(window.location.hash.slice(1));
    if (anchor) requestAnimationFrame(() => window.document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  }, [document.path]);
  return <section className="reader" aria-label={document.title}>
    <article className="markdown" tabIndex={-1} ref={articleRef}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} urlTransform={(url) => defaultUrlTransform(resolveMarkdownUrl(url, document.path, documents))} components={{
        h1: ({ id }) => <span id={id} className="heading-anchor" aria-hidden="true" style={{ display: 'block', height: 0, overflow: 'hidden' }} />,
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
        img: ({ node: _node, ...props }) => typeof props.src === 'string' && isDecorativeImage(props.src) ? null : <img {...props} loading="lazy" />,
        table: ({ node: _node, ...props }) => <div className="table-scroll"><table {...props} /></div>,
      }}>{document.markdown}</Markdown>
    </article>
  </section>;
}
