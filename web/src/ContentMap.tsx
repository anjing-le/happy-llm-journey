import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Icon, { type IconName } from './Icons';

export interface MapEntry {
  id: string;
  title: string;
  description?: string;
  href: string;
  icon?: IconName;
}

function titleLines(title: string) {
  const characters = Array.from(title);
  if (characters.length <= 12) return [title];
  return [characters.slice(0, 12).join(''), characters.slice(12, characters.length > 24 ? 23 : 24).join('') + (characters.length > 24 ? '…' : '')];
}

type MapObject = 'book' | 'folder' | 'computer' | 'note' | 'picture' | 'chip';

function objectFor(title: string, icon: IconName): MapObject {
  if (/算法/.test(title)) return 'chip';
  if (/coding|工程|agent|infra/i.test(title) || icon === 'activity') return 'computer';
  if (/aigc/i.test(title)) return 'picture';
  if (icon === 'book') return 'book';
  return icon === 'folder' ? 'folder' : 'note';
}

function Miniature({ kind }: { kind: MapObject }) {
  const ink = 'var(--ink)';
  const paper = 'var(--surface-raised)';
  const color = 'var(--map-top)';
  return <g className="map-object" fill={paper} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    {kind === 'computer' && <>
      <path d="m-44-39 66-31q5-2 5 3v51l-71 34Z" fill="var(--map-side)" />
      <path d="m-39-36 61-28v46l-61 29Z" />
      <path d="m-32-29 47-22v10l-47 22Z" fill={color} stroke="none" />
      <path d="m-31-10 19-9m-19 15 34-16" stroke="var(--line-strong)" strokeWidth="2.2" />
      <path d="m-44 18 71-34 32 18q3 3-1 5l-67 33q-4 2-8 0l-27-15q-3-3 0-7Z" fill="var(--map-side)" />
      <path d="m-42 17 69-32 29 17-68 33Z" />
      <path d="m-30 0 47-22m-36 28 47-22m-36 29 47-23m-44-7 24 14m-12-20 23 14m-10-20 22 13" transform="translate(5 17) scale(.72 .62)" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="m-3 21 16-8 10 5-16 8Z" fill="var(--accent-soft)" strokeWidth="1" />
      <circle cx="25" cy="-61" r="1" fill={ink} stroke="none" />
    </>}
    {kind === 'book' && <>
      <path d="m-51-29 7-6 42 18 45-25 8 5v45l-52 29-50-25Z" fill="var(--map-side)" />
      <path d="M-47-35q23-2 46 18v47Q-24 10-47 11Z" />
      <path d="M-1-17q23-21 48-25V4Q21 9-1 30Z" />
      <path d="M-40-26q15 2 30 14m-30-3q15 2 30 14m-30-3q15 2 30 14M7-11q15-13 31-19M7 0q15-13 31-19M7 11q15-13 31-19" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="m25-35 10-4v24l-5-2-5 7Z" fill={color} strokeWidth="1" />
    </>}
    {kind === 'folder' && <>
      <path d="m-46-25 27-13 17 7 42-18q6-3 6 4V7l-86 40q-6 2-6-4Z" fill="var(--map-side)" />
      <path d="m-32-24 59-28 6 43-65 31Z" />
      <path d="m-24-18 41-19m-38 28 38-18" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="m-46-8 86-40q7-3 6 4L39 9l-81 38q-6 3-5-4l-4-42q0-6 5-9Z" fill={color} />
      <path d="m-33 2 55-26" stroke="var(--surface-raised)" strokeOpacity=".7" strokeWidth="2" />
      <rect x="-6" y="-4" width="19" height="12" rx="3" transform="rotate(-25)" fill={paper} strokeWidth="1" />
    </>}
    {kind === 'note' && <>
      <path d="m-33-43 53-18q5-2 7 4l13 75q1 5-4 7l-54 19q-5 2-6-4l-14-76q-1-5 5-7Z" fill="var(--map-side)" />
      <path d="m-37-45 53-19q5-2 6 3l13 76q1 5-4 7l-53 19q-5 2-6-4l-14-76q-1-4 5-6Z" />
      <path d="m-17-52 22-8 3 14-22 8Z" fill={color} />
      <path d="m-24-20 4 3 6-10m1 1 22-8M-20 0l4 3 6-10m1 1 22-8M-16 20l4 3 6-10m1 1 22-8" fill="none" strokeWidth="2.2" />
    </>}
    {kind === 'picture' && <>
      <path d="m-43-37 72-30q5-2 6 4l9 69q1 5-4 7l-72 30q-5 2-6-4l-10-69q-1-5 5-7Z" fill="var(--map-side)" />
      <path d="m-47-40 72-30q5-2 6 4l10 68q1 5-4 7l-72 30q-5 2-6-4l-11-68q-1-5 4-7Z" />
      <path d="m-38-30 59-24 8 53-59 24Z" fill="var(--accent-soft)" strokeWidth="1" />
      <path d="m-33 11 15-32 18 12 10-21 16 28-57 22Z" fill={color} strokeWidth="1" />
      <ellipse cx="8" cy="-39" rx="6" ry="7" fill="#e9bc78" strokeWidth="1" />
    </>}
    {kind === 'chip' && <>
      <path d="m-36-13 41-23 38 20v16L2 24l-38-21Z" fill="var(--map-side)" />
      <path d="m-36-13 41-23 38 20L2 8Z" fill={color} />
      <path d="m-23-16 28-15 25 14L2-1Z" />
      <path d="m-36-7-13-7m13 17-13-7m60-25 10-7m1 13 11-7M-20 12v10m14-3v10m20-11v10m14-19v10" strokeWidth="4" />
      <path d="m-3-20 10-5 9 5-10 5Z" fill="var(--accent-soft)" strokeWidth="1" />
    </>}
  </g>;
}

function Tile({ title, icon, root = false }: { title: string; icon: IconName; root?: boolean }) {
  const label = root ? title.match(/^第[一二三四五六七八九十]+期/)?.[0] || title : title;
  const lines = titleLines(label);
  const labelWidth = Math.min(190, Math.max(64, Array.from(lines[0]).reduce((width, character) => width + (/[^\x00-\x7f]/.test(character) ? 14 : 8), 0) + 24));
  return <g className="map-tile">
    <ellipse className="map-shadow" cx="1" cy="47" rx="83" ry="15" fill="var(--shadow)" stroke="none" opacity=".8" />
    <path className="map-base" d="m-82-8 76-31q6-3 12 0L82-8q7 3 7 10v18q0 6-7 9L6 60q-6 3-12 0l-76-31q-7-3-7-9V2q0-7 7-10Z" fill="var(--map-side)" stroke="var(--ink)" strokeWidth="1.6" />
    <path d="m-82-10 76-31q6-3 12 0l76 31q10 4 0 8L6 29q-6 3-12 0L-82-2q-10-4 0-8Z" fill={root ? 'var(--accent-soft)' : 'var(--surface-raised)'} stroke="var(--ink)" strokeWidth="1.6" />
    <path className="map-tile-highlight" d="m-78-7 73-29q5-2 10 0L78-7M-82 8v11q0 5 7 8L-6 55q6 2 12 0l69-28" fill="none" stroke="var(--surface-raised)" strokeOpacity=".65" strokeWidth="1.7" />
    <path d="M0 32v25" stroke="var(--ink)" strokeOpacity=".35" strokeWidth="1" />
    <g transform="translate(0 -15)"><Miniature kind={objectFor(title, icon)} /></g>
    <rect className="map-label-plate" x={-labelWidth / 2} y="73" width={labelWidth} height={lines.length > 1 ? 51 : 32} rx="15" fill="var(--surface-raised)" stroke="var(--line-strong)" strokeWidth="1.1" />
    <text className="map-node-text" textAnchor="middle" fill="var(--ink)" y="94">{lines.map((line, index) => <tspan key={index} x="0" dy={index ? '18' : '0'}>{line}</tspan>)}</text>
  </g>;
}

export default function ContentMap({ title, entries, selected, icon = 'book', onChoose }: {
  title: string;
  entries: MapEntry[];
  selected?: string;
  icon?: IconName;
  onChoose: (entry: MapEntry) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([record]) => setWidth(Math.max(240, record.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columns = width < 600 ? 1 : width < 800 ? 2 : 3;
  const rows = Math.ceil(entries.length / columns);
  const height = Math.max(490, 340 + (rows - 1) * 230 + 150);
  const positions = entries.map((_, index) => {
    const row = Math.floor(index / columns);
    const rowCount = Math.min(columns, entries.length - row * columns);
    return { x: columns === 1 ? width / 2 + 18 : width * ((index % columns) + 1) / (rowCount + 1), y: 340 + row * 230 };
  });
  const follow = (event: MouseEvent<Element>, entry: MapEntry) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onChoose(entry);
  };
  return <div className="map-surface" ref={container}>
    {entries.length ? <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="group" aria-label={`${title}内容结构`}>
      <title>{`${title}内容结构`}</title>
      <desc>选择一个节点，阅读对应文档或章节。连线表示目录归属。</desc>
      <g aria-hidden="true">
        <path className="map-edge" d={`M${width / 2} 224 V236 H20 V${positions.at(-1)!.y - 104}`} fill="none" stroke="var(--line-strong)" />
        {Array.from({ length: rows }, (_, row) => {
          const rowNodes = positions.slice(row * columns, (row + 1) * columns);
          return <path key={row} className="map-edge" d={`M20 ${rowNodes[0].y - 104} H${rowNodes.at(-1)!.x}`} fill="none" stroke="var(--line-strong)" />;
        })}
        {positions.map((position, index) => <path key={entries[index].id} className="map-edge" d={`M${position.x} ${position.y - 104} V${position.y - 86}`} fill="none" stroke="var(--line-strong)" />)}
      </g>
      <g className="map-root" transform={`translate(${width / 2} 88)`} aria-hidden="true"><Tile title={title} icon={icon} root /></g>
      {entries.map((entry, index) => <g key={entry.id} transform={`translate(${positions[index].x} ${positions[index].y})`}>
        <a className={`map-node${selected === entry.id ? ' is-selected' : ''}`} href={entry.href} aria-label={entry.title} aria-current={selected === entry.id ? 'true' : undefined} onClick={(event) => follow(event, entry)}>
          <title>{entry.description ? `${entry.title}：${entry.description}` : entry.title}</title>
          <Tile title={entry.title} icon={entry.icon || 'file'} />
        </a>
      </g>)}
    </svg> : <div className="map-empty"><Icon name="book" /><p>暂无可展开的章节。</p></div>}
  </div>;
}
