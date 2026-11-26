import type { SVGProps } from 'react';

export type IconName = 'book' | 'practice' | 'activity' | 'folder' | 'file' | 'search' | 'sun' | 'moon' | 'menu' | 'close' | 'arrow' | 'back' | 'map' | 'github' | 'expand' | 'collapse';

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths = {
    book: <><path d="M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1zM12 5v15" /></>,
    practice: <><rect x="5" y="3" width="15" height="19" rx="2" /><path d="m8 9 2 2 4-4M8 16h2M14 16h3M15 10h2" /></>,
    activity: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="m10 8 6 3-6 3zM8 22h8M12 18v4" /></>,
    folder: <path d="M3 6V4h7l2 3h9v13H3z" />,
    file: <><path d="M5 3h9l5 5v13H5zM14 3v6h5M9 13h6M9 17h5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    map: <><rect x="8" y="2" width="8" height="6" rx="1" /><rect x="2" y="17" width="8" height="5" rx="1" /><rect x="14" y="17" width="8" height="5" rx="1" /><path d="M12 8v5M6 17v-4h12v4" /></>,
    github: <><path d="M8 21v-3c-4 1-4-2-6-2M16 21v-4c0-1-.3-2-1-2 4-.5 6-2 6-6 0-2-1-3-1-3 0-1 0-2-.5-3-2 0-3 1-3 1a13 13 0 0 0-9 0S6 3 4 3c-.5 1-.5 2-.5 3 0 0-1 1-1 3 0 4 2 5.5 6 6-.7 0-1 1-1 2" /></>,
    expand: <path d="M5 8V3h5M14 3h5v5M19 16v5h-5M10 21H5v-5" />,
    collapse: <path d="M3 8h5V3M16 3v5h5M21 16h-5v5M8 21v-5H3" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
