// Jämför två lägen av en match och tar fram vilka notiser som ska skickas.
// Ren logik utan nätverk, så att den går att testa.
import type { GameDetail, GameEvent, PushMessage } from '../shared/types';

export interface WatchState {
  gameId: string;
  started: boolean;
  final: boolean;
  goals: string[]; // nycklar för redan notifierade mål
}

const goalKey = (e: GameEvent) => `${e.period}|${e.time}|${e.score}`;
/** "21. Lindqvist, Oliver (6)" -> "Oliver Lindqvist" */
export const prettyName = (s = '') =>
  s
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^(.+?),\s*(.+)$/, '$2 $1')
    .trim();

const strengthText: Record<string, string> = { PP1: 'i powerplay', PP2: 'i powerplay', SH1: 'i boxplay', SH2: 'i boxplay', EN: 'i tom bur', PS: 'på straff' };

export function diffGame(prev: WatchState | null, g: GameDetail, club: string, appUrl: string): { messages: PushMessage[]; state: WatchState } {
  const state: WatchState = prev && prev.gameId === g.gameId ? { ...prev, goals: [...prev.goals] } : { gameId: g.gameId, started: false, final: false, goals: [] };
  const messages: PushMessage[] = [];
  const url = `${appUrl}?game=${g.gameId}`;
  const ourAbbr = g.home === club ? g.homeAbbr : g.awayAbbr;
  const scoreline = `${g.home} ${g.homeScore}–${g.awayScore} ${g.away}`;

  if (!state.started && (g.status === 'live' || g.events.length > 0)) {
    state.started = true;
    // Startnotis bara om vi ser matchen tidigt (inte om bevakningen startar mitt i matchen)
    if (g.events.filter((e) => e.type === 'goal').length === 0)
      messages.push({ kind: 'start', title: `Nedsläpp! ${g.home} – ${g.away}`, body: `Följ matchen live i appen · ${g.venue}`, tag: `start-${g.gameId}`, url });
  }

  for (const e of g.events.filter((x) => x.type === 'goal')) {
    const k = goalKey(e);
    if (state.goals.includes(k)) continue;
    state.goals.push(k);
    if (prev === null) continue; // bevakningen startade mitt i matchen: skicka inte gamla mål
    const ours = e.team === ourAbbr;
    const [h, a] = (e.score ?? '').split('-');
    const who = prettyName(e.player);
    const assists = (e.assists ?? []).map(prettyName).filter(Boolean);
    messages.push({
      kind: 'goal',
      title: ours ? `MÅL! ${g.home} ${h}–${a} ${g.away}` : `Mål för ${e.team === g.homeAbbr ? g.home : g.away} · ${h}–${a}`,
      body: `${who}${assists.length ? ` (${assists.join(', ')})` : ''} ${strengthText[e.strength ?? ''] ?? ''} · ${e.period} ${e.time}`.replace(/\s+/g, ' ').trim(),
      tag: `goal-${g.gameId}-${k}`,
      url,
    });
  }

  if (!state.final && g.status === 'final') {
    state.final = true;
    if (prev !== null) {
      const us = g.home === club ? g.homeScore : g.awayScore;
      const them = g.home === club ? g.awayScore : g.homeScore;
      const verdict = us > them ? 'Seger! 🎉' : us < them ? 'Förlust' : 'Oavgjort';
      messages.push({
        kind: 'final',
        title: `Slut: ${scoreline}`,
        body: `${verdict}${g.periods ? ` · Perioder ${g.periods}` : ''} · Läs matchrapporten`,
        tag: `final-${g.gameId}`,
        url,
      });
    }
  }
  return { messages, state };
}
