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

function Tile({ title, icon, root = false }: { title: string; icon: IconName; root?: boolean }) {
  const lines = titleLines(title);
  return <>
    <ellipse className="map-shadow" cx="0" cy="54" rx="83" ry="10" fill="var(--shadow)" opacity=".45" />
    <path className="map-base" d="M-86 3 0-29 86 3v22L0 58-86 25Z" fill="var(--map-side)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M-86 3 0-29 86 3 0 36Z" fill={root ? 'var(--accent-soft)' : 'var(--map-top)'} stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M0 36v22" stroke="var(--line-strong)" strokeWidth="1.2" />
    <g transform="translate(-20 -55)" className="map-icon"><rect x="0" y="0" width="40" height="44" rx="9" fill="var(--surface-raised)" stroke="var(--ink)" strokeWidth="1.4" /><Icon name={icon} x="9" y="10" width="22" height="22" /></g>
    <text className="map-node-text" textAnchor="middle" fill="var(--ink)" y="82">{lines.map((line, index) => <tspan key={index} x="0" dy={index ? '19' : '0'}>{line}</tspan>)}</text>
  </>;
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
  const columns = width < 540 ? 1 : width < 790 ? 2 : 3;
  const rows = Math.ceil(entries.length / columns);
  const height = Math.max(410, 280 + (rows - 1) * 195 + 120);
  const positions = entries.map((_, index) => {
    const row = Math.floor(index / columns);
    const rowCount = Math.min(columns, entries.length - row * columns);
    return { x: columns === 1 ? width / 2 + 18 : width * ((index % columns) + 1) / (rowCount + 1), y: 280 + row * 195 };
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
        <path className="map-edge" d={`M${width / 2} 203 V206 H20 V${positions.at(-1)!.y - 74}`} fill="none" stroke="var(--line-strong)" />
        {Array.from({ length: rows }, (_, row) => {
          const rowNodes = positions.slice(row * columns, (row + 1) * columns);
          return <path key={row} className="map-edge" d={`M20 ${rowNodes[0].y - 74} H${rowNodes.at(-1)!.x}`} fill="none" stroke="var(--line-strong)" />;
        })}
        {positions.map((position, index) => <path key={entries[index].id} className="map-edge" d={`M${position.x} ${position.y - 74} V${position.y - 54}`} fill="none" stroke="var(--line-strong)" />)}
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
