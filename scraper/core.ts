// Gemensamma hjälpfunktioner för insamlaren (run.ts) och matchbevakningen (watch.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import type { Game, GameDetail } from '../shared/types';
import { fetchText } from './http';
import { parseGame } from './parse';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, 'public', 'data');
export const config = JSON.parse(readFileSync(join(ROOT, 'config', 'club.json'), 'utf8'));
export const BASE: string = config.swehockey.base;

export const write = (rel: string, data: unknown) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 1));
};
export const read = <T>(rel: string): T | null => {
  const p = join(OUT, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
};
export const page = async (path: string) => cheerio.load(await fetchText(`${BASE}${path}`));
export const log = (...a: unknown[]) => console.log(new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm' }), ...a);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Svensk lokal tid som "YYYY-MM-DDTHH:mm" (samma format som swehockeys tider). */
export const nowLocal = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T').slice(0, 16);
export const addMin = (iso: string, m: number) => {
  const d = new Date(`${iso}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + m);
  return d.toISOString().slice(0, 16);
};
/** Minuter från a till b (båda i formatet ovan). */
export const minutesBetween = (a: string, b: string) => (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60_000;

export const isOurs = (g: Game) => g.home === config.name || g.away === config.name;

/** Vår match som pågår eller börjar inom `beforeMin` minuter (och startade för högst `afterMin` minuter sedan). */
export const gameInWindow = (games: Game[], beforeMin = 15, afterMin = 180) => {
  const now = nowLocal();
  return games.find((g) => isOurs(g) && g.status !== 'final' && addMin(g.date, -beforeMin) <= now && now <= addMin(g.date, afterMin));
};

/** Hittar swehockeys match-id för en match (finns först när matchen startat i deras system). */
export async function findGameId(g: Game, seriesId: number): Promise<string | undefined> {
  if (g.gameId) return g.gameId;
  for (const path of [`/ScheduleAndResults/Live/${seriesId}`, `/ScheduleAndResults/Overview/${seriesId}`]) {
    const $ = await page(path);
    let id: string | undefined;
    $('a[href*="Game/Events"]').each((_, a) => {
      const row = $(a).closest('tr').text();
      if (!id && row.includes(g.home) && row.includes(g.away)) id = $(a).attr('href')!.match(/Events\/(\d+)/)?.[1];
    });
    if (id) return id;
  }
  return undefined;
}

export const fetchGame = async (gameId: string): Promise<GameDetail> => parseGame(await page(`/Game/Events/${gameId}`), gameId);
