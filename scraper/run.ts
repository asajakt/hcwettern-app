// Hämtar HC Wetterns data från stats.swehockey.se och svenskalag.se och skriver JSON till public/data/.
//   npm run scrape          – en körning
//   npm run scrape:watch    – kör i loop: varannan minut när klubben spelar, annars var 15:e minut
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import type { ClubData, Game, GameDetail, LiveData, TeamData } from '../shared/types';
import { fetchText } from './http';
import {
  computeForm,
  parseGame,
  parsePlayersByTeam,
  parseRoster,
  parseRss,
  parseSchedule,
  parseScoringLeaders,
  parseStandings,
  sourceUpdated,
} from './parse';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');
const config = JSON.parse(readFileSync(join(ROOT, 'config', 'club.json'), 'utf8'));
const BASE: string = config.swehockey.base;

const write = (rel: string, data: unknown) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 1));
};
const read = <T>(rel: string): T | null => {
  const p = join(OUT, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
};
const page = async (path: string) => cheerio.load(await fetchText(`${BASE}${path}`));
const log = (...a: unknown[]) => console.log(new Date().toLocaleTimeString('sv-SE'), ...a);

/** Lokal svensk tid som "YYYY-MM-DDTHH:mm" för jämförelse med swehockeys tider. */
const nowLocal = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T').slice(0, 16);
const addMin = (iso: string, m: number) => {
  const d = new Date(`${iso}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + m);
  return d.toISOString().slice(0, 16);
};
const isOurs = (g: Game) => g.home === config.name || g.away === config.name;
/** Pågår en av våra matcher (från 15 min före start till 3 h efter)? */
const liveWindow = (games: Game[]) => {
  const now = nowLocal();
  return games.find((g) => isOurs(g) && g.status !== 'final' && addMin(g.date, -15) <= now && now <= addMin(g.date, 180));
};

async function scrapeTeam(team: { key: string; name: string; league: string; seriesId: number }) {
  const id = team.seriesId;
  log(`Hämtar ${team.name} (${team.league})`);
  const $sched = await page(`/ScheduleAndResults/Schedule/${id}`);
  const games = parseSchedule($sched);
  const $over = await page(`/ScheduleAndResults/Overview/${id}`);
  const standings = parseStandings($over);
  const $score = await page(`/Players/Statistics/ScoringLeaders/${id}`);
  const { leaders, abbreviations } = parseScoringLeaders($score);
  const $pbt = await page(`/Teams/Info/PlayersByTeam/${id}`);
  const { skaters, goalies } = parsePlayersByTeam($pbt, config.name);
  const $roster = await page(`/Teams/Info/TeamRoster/${id}`);
  const roster = parseRoster($roster, config.name);

  const abbr = (t: string) => abbreviations[t] ?? t.replace(/^(HC|IK|IF|SK|HK|AIF)\s+/i, '').slice(0, 3).toUpperCase();
  for (const r of standings) {
    r.abbr = abbr(r.team);
    r.form = computeForm(games, r.team);
  }
  for (const s of standings) abbreviations[s.team] ??= s.abbr;

  const data: TeamData = {
    key: team.key,
    name: team.name,
    league: team.league,
    seriesId: id,
    updatedAt: new Date().toISOString(),
    sourceUpdatedAt: sourceUpdated($sched),
    standings,
    games,
    roster,
    skaters,
    goalies,
    leagueLeaders: leaders.slice(0, 15),
    abbreviations,
  };
  write(`teams/${team.key}.json`, data);
  log(`  ${standings.length} lag i tabellen, ${games.length} matcher, ${roster.length} i truppen`);
  return data;
}

/** Matchrapporter för våra spelade matcher (cachas – en färdig match hämtas bara en gång). */
async function scrapeGameReports(data: TeamData, max = 6) {
  const done = data.games.filter((g) => isOurs(g) && g.status === 'final' && g.gameId).slice(-max);
  for (const g of done) {
    const cached = read<GameDetail>(`games/${g.gameId}.json`);
    if (cached?.status === 'final') continue;
    const $g = await page(`/Game/Events/${g.gameId}`);
    write(`games/${g.gameId}.json`, parseGame($g, g.gameId!));
    log(`  Matchrapport ${g.home} – ${g.away}`);
  }
}

/** Live: leta upp matchens id via serie-sidan och läs händelserna. */
async function scrapeLive(data: TeamData): Promise<LiveData> {
  const g = liveWindow(data.games);
  if (!g) return { game: null, updatedAt: new Date().toISOString() };
  let gameId = g.gameId;
  if (!gameId) {
    for (const path of [`/ScheduleAndResults/Live/${data.seriesId}`, `/ScheduleAndResults/Overview/${data.seriesId}`]) {
      const $ = await page(path);
      $('a[href*="Game/Events"]').each((_, a) => {
        const row = $(a).closest('tr').text();
        if (row.includes(g.home) && row.includes(g.away)) gameId ??= $(a).attr('href')!.match(/Events\/(\d+)/)?.[1];
      });
      if (gameId) break;
    }
  }
  if (!gameId) {
    log('  Matchen har inte startat i swehockey ännu');
    return { game: null, updatedAt: new Date().toISOString() };
  }
  const detail = parseGame(await page(`/Game/Events/${gameId}`), gameId);
  write(`games/${gameId}.json`, detail);
  log(`  LIVE ${detail.home} ${detail.homeScore}–${detail.awayScore} ${detail.away} (${detail.statusText})`);
  return { game: detail, updatedAt: new Date().toISOString() };
}

async function scrapeNews() {
  try {
    const news = parseRss(await fetchText(config.newsRss));
    write('news.json', news);
    log(`Nyheter: ${news.length}`);
  } catch (e) {
    log('Nyheter kunde inte hämtas:', (e as Error).message);
  }
}

function writeClub() {
  const club: ClubData = {
    name: config.name,
    short: config.short,
    town: config.town,
    homeArena: config.homeArena,
    website: config.website,
    social: config.social,
    youthPolicy: config.youthPolicy,
    teams: config.teams,
    updatedAt: new Date().toISOString(),
  };
  write('club.json', club);
}

async function once(full: boolean) {
  writeClub();
  let live = false;
  for (const team of config.teams) {
    let data = read<TeamData>(`teams/${team.key}.json`);
    if (full || !data) {
      data = await scrapeTeam(team);
      await scrapeGameReports(data);
    }
    const l = await scrapeLive(data);
    if (team.key === config.teams[0].key) write('live.json', l);
    if (l.game && l.game.status === 'live') live = true;
    // När en livematch just tagit slut: hämta om tabellen direkt
    if (l.game?.status === 'final' && !full) await scrapeTeam(team);
  }
  if (full) await scrapeNews();
  return live || config.teams.some((t: { key: string }) => {
    const d = read<TeamData>(`teams/${t.key}.json`);
    return d && liveWindow(d.games);
  });
}

const loop = process.argv.includes('--loop');
// --quick: kolla bara om en match pågår (används av den täta schemalagda körningen)
const quick = process.argv.includes('--quick');
if (!loop) {
  await once(!quick);
} else {
  let lastFull = 0;
  for (;;) {
    const full = Date.now() - lastFull > 15 * 60_000;
    let liveNow = false;
    try {
      liveNow = await once(full);
      if (full) lastFull = Date.now();
    } catch (e) {
      log('Fel:', (e as Error).message);
    }
    const ms = liveNow ? 120_000 : 15 * 60_000;
    log(liveNow ? 'Match pågår – nästa koll om 2 min' : 'Nästa koll om 15 min');
    await new Promise((r) => setTimeout(r, ms));
  }
}
