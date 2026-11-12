// Hämtar HC Wetterns data från stats.swehockey.se och svenskalag.se och skriver JSON till public/data/.
//   npm run scrape               – full hämtning (tabell, schema, trupp, statistik, matchrapporter, nyheter)
//   npm run scrape -- --quick    – kollar bara om en match pågår och sparar live.json
// Livebevakning med push-notiser sköts av watch.ts (npm run watch).
import type { ClubData, GameDetail, LiveData, TeamData } from '../shared/types';
import { config, fetchGame, findGameId, gameInWindow, isOurs, log, page, read, write } from './core';
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

type TeamCfg = { key: string; name: string; league: string; seriesId: number };

export async function scrapeTeam(team: TeamCfg) {
  const id = team.seriesId;
  log(`Hämtar ${team.name} (${team.league})`);
  const $sched = await page(`/ScheduleAndResults/Schedule/${id}`);
  const games = parseSchedule($sched);
  const standings = parseStandings(await page(`/ScheduleAndResults/Overview/${id}`));
  const { leaders, abbreviations } = parseScoringLeaders(await page(`/Players/Statistics/ScoringLeaders/${id}`));
  const { skaters, goalies } = parsePlayersByTeam(await page(`/Teams/Info/PlayersByTeam/${id}`), config.name);
  const roster = parseRoster(await page(`/Teams/Info/TeamRoster/${id}`), config.name);

  const abbr = (t: string) => abbreviations[t] ?? t.replace(/^(HC|IK|IF|SK|HK|AIF)\s+/i, '').slice(0, 3).toUpperCase();
  for (const r of standings) {
    r.abbr = abbr(r.team);
    r.form = computeForm(games, r.team);
    abbreviations[r.team] ??= r.abbr;
  }

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
    if (read<GameDetail>(`games/${g.gameId}.json`)?.status === 'final') continue;
    write(`games/${g.gameId}.json`, parseGame(await page(`/Game/Events/${g.gameId}`), g.gameId!));
    log(`  Matchrapport ${g.home} – ${g.away}`);
  }
}

async function scrapeLive(data: TeamData): Promise<LiveData> {
  const g = gameInWindow(data.games);
  const none = { game: null, updatedAt: new Date().toISOString() };
  if (!g) return none;
  const gameId = await findGameId(g, data.seriesId);
  if (!gameId) return none;
  const detail = await fetchGame(gameId);
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
    api: (process.env.HCW_API_URL || config.api || '').replace(/\/$/, '') || undefined,
    updatedAt: new Date().toISOString(),
  };
  write('club.json', club);
}

export async function scrapeAll(full = true) {
  writeClub();
  for (const team of config.teams as TeamCfg[]) {
    let data = read<TeamData>(`teams/${team.key}.json`);
    if (full || !data) {
      data = await scrapeTeam(team);
      await scrapeGameReports(data);
    }
    const live = await scrapeLive(data);
    if (team.key === config.teams[0].key) write('live.json', live);
  }
  if (full) await scrapeNews();
}

// Körs direkt från kommandoraden (inte när filen importeras)
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scraper/run.ts')) {
  await scrapeAll(!process.argv.includes('--quick'));
}
