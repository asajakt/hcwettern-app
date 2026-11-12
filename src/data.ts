import { useEffect, useRef, useState } from 'react';
import type { Game, GameDetail, LiveData } from '../shared/types';

const BASE = `${import.meta.env.BASE_URL}data/`;

/** Hämtar JSON från public/data och hämtar om med jämna mellanrum. */
export function useJson<T>(path: string | null, refreshMs = 5 * 60_000): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      fetch(/^https?:/.test(path) ? path : `${BASE}${path}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setData(d))
        .catch(() => {});
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, refreshMs]);
  return data;
}

/**
 * Livematch. Läser live.json var 30:e sekund.
 * Med ?demo=live i adressen spelas den senaste matchrapporten upp som om den pågick – bra för att visa funktionen.
 */
export function useLive(lastGameId?: string, api?: string): GameDetail | null {
  const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === 'live';
  // Med API (Cloudflare Worker) uppdateras ställningen var 15:e sekund, annars från live.json
  const fromApi = useJson<LiveData>(!demo && api ? `${api}/api/live` : null, 15_000);
  const fromFile = useJson<LiveData>(!demo && !api ? 'live.json' : null, 30_000);
  const real = fromApi ?? fromFile;
  const report = useJson<GameDetail>(demo && lastGameId ? `games/${lastGameId}.json` : null, 3_600_000);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!demo || !report) return;
    const id = setInterval(() => setStep((s) => (s >= report.events.length + 3 ? 0 : s + 1)), 2500);
    return () => clearInterval(id);
  }, [demo, report]);
  if (!demo) {
    // Visa bara fullständig livedata (skyddar mot trasiga eller halvskrivna svar)
    const g = real?.game;
    return g && Array.isArray(g.events) && Array.isArray(g.shots) && typeof g.homeScore === 'number' ? g : null;
  }
  if (!report) return null;
  const events = report.events.slice(0, step);
  const lastGoal = [...events].reverse().find((e) => e.type === 'goal');
  const [h, a] = (lastGoal?.score ?? '0-0').split('-').map(Number);
  const done = step >= report.events.length;
  const last = events.at(-1);
  return {
    ...report,
    events,
    homeScore: h,
    awayScore: a,
    status: done ? 'final' : 'live',
    statusText: done ? 'Slutresultat' : `${last?.period ?? '1:a perioden'} · ${last?.time ?? '00:00'}`,
  };
}

/** Anropar onGoal när ställningen ändras (för notis i appen). */
export function useGoalWatcher(game: GameDetail | null, onGoal: (g: GameDetail) => void) {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (!game) return;
    const key = `${game.gameId}:${game.homeScore}-${game.awayScore}`;
    if (prev.current && prev.current !== key && prev.current.startsWith(game.gameId)) onGoal(game);
    prev.current = key;
  }, [game, onGoal]);
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return m;
}

/* ---------- formatering ---------- */
const toDate = (iso: string) => new Date(iso.length <= 16 ? `${iso}:00` : iso);
export const fmtDay = (iso: string) => toDate(iso).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => iso.slice(11, 16);
export const dateParts = (iso: string) => {
  const d = toDate(iso);
  return {
    wd: d.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', ''),
    day: d.getDate(),
    mon: d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', ''),
  };
};
export const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min sedan`;
  if (s < 86400) return `${Math.round(s / 3600)} tim sedan`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'i går' : d < 7 ? `${d} dagar sedan` : new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
};
export const startsAt = (g: Game) => toDate(g.date).getTime();

export const epLink = (name: string) => `https://www.eliteprospects.com/search/player?q=${encodeURIComponent(name)}`;
export const mapsLink = (venue: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;

/** Laddar ner en .ics-fil så att matchen hamnar i telefonens kalender. */
export function downloadIcs(g: Game, club: string) {
  const d = (iso: string, addH = 0) => {
    const t = toDate(iso);
    t.setHours(t.getHours() + addH);
    return t.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  };
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${club}//Klubbapp//SV`,
    'BEGIN:VEVENT',
    `UID:${g.scheduleId}@hcwettern-app`,
    `DTSTAMP:${d(new Date().toISOString().slice(0, 16))}`,
    `DTSTART:${d(g.date)}`,
    `DTEND:${d(g.date, 3)}`,
    `SUMMARY:${g.home} – ${g.away}`,
    `LOCATION:${g.venue}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `${g.home}-${g.away}.ics`.replace(/\s+/g, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Stabil färg per motståndarlag. */
export function teamColor(name: string, ours: boolean) {
  if (ours) return 'var(--brand)';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}
