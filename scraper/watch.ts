// Matchbevakning med push-notiser.
//   npm run watch                    – bevakar om en match pågår nu (eller börjar inom 60 min), annars avslutas den direkt
//   npm run watch -- --within 90     – startar om en match börjar inom 90 minuter
//   npm run watch -- --game 1118651  – spelar upp en färdig match (test av notistexterna, skickar inget)
// Körs av GitHub Actions (.github/workflows/live.yml) några gånger per kväll.
import { appendFileSync } from 'node:fs';
import type { TeamData } from '../shared/types';
import { config, fetchGame, findGameId, gameInWindow, log, minutesBetween, nowLocal, read, sleep, write } from './core';
import { diffGame, type WatchState } from './notify';
import { publishLive, sendPush } from './push';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const POLL_MS = 30_000;
const appUrl = (process.env.APP_URL || config.appUrl || './').replace(/\/?$/, '/');

async function replay(gameId: string) {
  const g = await fetchGame(gameId);
  const goals = g.events.filter((e) => e.type === 'goal').length;
  let state: WatchState | null = { gameId, started: false, final: false, goals: [] };
  for (let n = 0; n <= g.events.length; n++) {
    const events = g.events.slice(0, n);
    const isLast = n === g.events.length;
    const r = diffGame(state, { ...g, events, status: isLast ? 'final' : 'live' }, config.name, appUrl);
    state = r.state;
    for (const m of r.messages) console.log(`[${m.kind}] ${m.title}\n        ${m.body}`);
  }
  log(`Uppspelning klar (${goals} mål)`);
}

async function watch() {
  const within = Number(arg('within') ?? 60);
  for (const team of config.teams) {
    const data = read<TeamData>(`teams/${team.key}.json`);
    if (!data) continue;
    const g = gameInWindow(data.games, within, 200);
    if (!g) continue;

    log(`Bevakar ${g.home} – ${g.away} (${g.date.replace('T', ' ')})`);
    const wait = minutesBetween(nowLocal(), g.date) - 5;
    if (wait > 0) {
      log(`Väntar ${Math.round(wait)} min till strax före nedsläpp`);
      await sleep(wait * 60_000);
    }

    const stateFile = `watch/${g.scheduleId}.json`;
    let state = read<WatchState>(stateFile);
    let gameId = state?.gameId;
    const deadline = Date.now() + 4 * 3600_000;
    let finalSeenAt = 0;

    while (Date.now() < deadline) {
      try {
        gameId ??= await findGameId(g, data.seriesId);
        if (!gameId) {
          log('Matchen har inte startat i swehockey ännu');
        } else {
          const detail = await fetchGame(gameId);
          const r = diffGame(state, detail, config.name, appUrl);
          await sendPush(r.messages);
          if (JSON.stringify(r.state) !== JSON.stringify(state) || r.messages.length) {
            state = r.state;
            write(stateFile, state);
          }
          write(`games/${gameId}.json`, detail);
          write('live.json', { game: detail, updatedAt: new Date().toISOString() });
          await publishLive(detail);
          log(`${detail.home} ${detail.homeScore}–${detail.awayScore} ${detail.away} · ${detail.statusText}`);
          if (detail.status === 'final') {
            // Vänta några minuter efter slutsignal ifall swehockey rättar något, sedan klart
            finalSeenAt ||= Date.now();
            if (Date.now() - finalSeenAt > 5 * 60_000) break;
          }
        }
      } catch (e) {
        log('Fel:', (e as Error).message);
      }
      await sleep(POLL_MS);
    }
    log('Bevakningen avslutad');
    // Talar om för GitHub Actions att tabellen ska uppdateras och appen publiceras om
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'watched=true\n');
    return true;
  }
  log(`Ingen match nu eller inom ${within} min – inget att bevaka`);
  return false;
}

const replayId = arg('game');
if (replayId) await replay(replayId);
else await watch();
