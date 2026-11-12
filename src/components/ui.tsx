import { createContext, useContext, type ReactNode } from 'react';
import type { ClubData, GameDetail, NewsItem, TeamData } from '../../shared/types';
import { dateParts, teamColor, useNow } from '../data';

export interface AppCtx {
  club: ClubData;
  team: TeamData | null;
  news: NewsItem[];
  live: GameDetail | null;
  openGame: (gameId: string) => void;
  openPlayer: (name: string) => void;
  go: (tab: Tab) => void;
}
export type Tab = 'home' | 'games' | 'table' | 'stats' | 'squad' | 'news';
export const Ctx = createContext<AppCtx>(null as never);
export const useApp = () => useContext(Ctx);

const paths: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  games: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 2v4M16 2v4',
  table: 'M4 6h16M4 12h16M4 18h16M9 6v12',
  stats: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  squad: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M17 9.5a2.5 2.5 0 1 0 0-5M17 12c3 0 5 2 5 5',
  news: 'M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  auto: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18',
  cal: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M12 13v5M9.5 15.5h5',
  pin: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  close: 'M6 6l12 12M18 6 6 18',
  chev: 'M9 6l6 6-6 6',
  insta: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01',
  fb: 'M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5v4h3v7h4v-7h3l1-4h-4V7.5A1 1 0 0 1 13 6.5h2z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9z',
  youth: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 22l2-8-3-2 4-3h6l4 3-3 2 2 8',
};
export function Icon({ name, size = 22 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export function Crest({ size = 36 }: { size?: number }) {
  return <img className="crest" src={`${import.meta.env.BASE_URL}icons/crest.png`} width={size} height={size * 1.08} alt="HC Wettern" />;
}

export function Badge({ team, size = 44 }: { team: string; size?: number }) {
  const { club, team: td } = useApp();
  const ours = team === club.name;
  if (ours) return <span className="badge ours" style={{ width: size, height: size }}><Crest size={size * 0.72} /></span>;
  const abbr = td?.abbreviations[team] ?? team.slice(0, 3).toUpperCase();
  return (
    <span className="badge" style={{ width: size, height: size, background: teamColor(team, false), fontSize: size * 0.3 }}>
      {abbr}
    </span>
  );
}

export function Card({ title, right, children, className = '', onClick }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <section className={`card ${className}`} onClick={onClick}>
      {(title || right) && (
        <header className="ct">
          <span>{title}</span>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function LinkBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="linkbtn" onClick={(e) => (e.stopPropagation(), onClick())}>
      {children}
    </button>
  );
}

export function DateBox({ iso }: { iso: string }) {
  const p = dateParts(iso);
  return (
    <div className="date">
      <span>{p.wd}</span>
      <b>{p.day}</b>
      <span>{p.mon}</span>
    </div>
  );
}

export function Countdown({ to }: { to: number }) {
  const now = useNow();
  let s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const parts: [number, string][] = [
    [d, 'dagar'],
    [h, 'tim'],
    [Math.floor(s / 60), 'min'],
    [s % 60, 'sek'],
  ];
  return (
    <div className="cd">
      {parts.map(([v, l]) => (
        <div key={l}>
          {String(v).padStart(2, '0')}
          <small>{l}</small>
        </div>
      ))}
    </div>
  );
}

export function FormDots({ form }: { form: ('W' | 'L' | 'O')[] }) {
  const t = { W: 'Vinst', O: 'Förlust efter förlängning', L: 'Förlust' };
  return (
    <span className="form">
      {form.map((f, i) => (
        <i key={i} className={`f-${f}`} title={t[f]} />
      ))}
    </span>
  );
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <button className="sheet-x" onClick={onClose} aria-label="Stäng">
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;
