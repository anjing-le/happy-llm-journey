import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';

function CopyIcon({ link = false, copied = false }: { link?: boolean; copied?: boolean }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true">{copied
    ? <path d="m4 10 4 4 8-9" />
    : link ? <><path d="m8 12 4-4M7 13l-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0M13 7l1-1a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0" /></>
      : <><rect x="7" y="7" width="9" height="10" rx="1.5" /><path d="M5 13H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1" /></>}
  </svg>;
}

export default function CopyButton({ getText, label, target, iconOnly = false, link = false, className = '', beforeCopy }: {
  getText: () => string; label: string; target?: string; iconOnly?: boolean; link?: boolean;
  className?: string; beforeCopy?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string>();
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();
  const name = `${label}${target ? `：${target}` : ''}`;

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);
  useEffect(() => {
    if (manual === undefined) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    textareaRef.current?.focus({ preventScroll: true });
    textareaRef.current?.select();
  }, [manual]);

  const closeManual = () => {
    dialogRef.current?.close(); setManual(undefined);
    buttonRef.current?.focus({ preventScroll: true });
  };
  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); beforeCopy?.(); setCopied(false); setError('');
    let text = '';
    try {
      text = getText();
      if (!text) throw new Error('Empty copy text');
      // Start the browser write in the click handler, preserving the user gesture on Safari.
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      if (text) setManual(text);
      else setError('暂时无法复制，请打开 Markdown 原文。');
    }
  };

  return <>
    <button ref={buttonRef} className={`copy-button ${className}`} type="button" disabled={!ready}
      aria-label={error || (copied ? `已复制：${target || label}` : name)} title={error || (copied ? '已复制' : name)} onClick={copy}>
      {error ? <span aria-hidden="true">!</span> : <CopyIcon link={link} copied={copied} />}{!iconOnly && <span>{copied ? '已复制' : error ? '未复制' : label}</span>}
    </button>
    <span className="visually-hidden" role="status">{copied ? `已复制${target || label}` : error}</span>
    {manual !== undefined && <dialog ref={dialogRef} className="copy-fallback" aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); closeManual(); }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeManual();
      }}>
      <div className="copy-fallback-top"><span id={headingId}>手动复制</span><button type="button" aria-label="关闭手动复制" onClick={closeManual}>×</button></div>
      <p>浏览器未允许自动复制。请在下面全选并复制。</p>
      <textarea ref={textareaRef} readOnly value={manual} aria-label={name} />
      <button type="button" className="select-copy" onClick={() => { textareaRef.current?.focus(); textareaRef.current?.select(); }}>全选文本</button>
    </dialog>}
  </>;
}
