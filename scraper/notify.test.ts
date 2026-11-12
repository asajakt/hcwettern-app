import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { diffGame, prettyName, type WatchState } from './notify';
import { parseGame } from './parse';

const html = readFileSync(fileURLToPath(new URL('./fixtures/game.html', import.meta.url)), 'utf8');
const full = parseGame(cheerio.load(html), '1118651');
const at = (n: number, status: 'live' | 'final' = 'live') => ({ ...full, events: full.events.slice(0, n), status });

describe('notiser', () => {
  it('formaterar namn', () => {
    expect(prettyName('21. Lindqvist, Oliver (6)')).toBe('Oliver Lindqvist');
  });

  it('skickar start, ett meddelande per mål och slutresultat', () => {
    let state: WatchState | null = null;
    const all: string[] = [];
    // Första läget: matchen har precis börjat
    let r = diffGame(state, at(1), 'HC Wettern', 'https://app/');
    state = r.state;
    all.push(...r.messages.map((m) => m.kind));
    for (let n = 2; n <= full.events.length; n++) {
      r = diffGame(state, at(n), 'HC Wettern', 'https://app/');
      state = r.state;
      all.push(...r.messages.map((m) => m.kind));
    }
    r = diffGame(state, at(full.events.length, 'final'), 'HC Wettern', 'https://app/');
    all.push(...r.messages.map((m) => m.kind));
    expect(all.filter((k) => k === 'start')).toHaveLength(1);
    expect(all.filter((k) => k === 'goal')).toHaveLength(13);
    expect(all.at(-1)).toBe('final');
    expect(r.messages[0].title).toBe('Slut: HC Wettern 7–6 Rydaholms SK');
    expect(r.messages[0].url).toBe('https://app/?game=1118651');
  });

  it('skriver ut våra mål med målskytt och assist', () => {
    const before = diffGame(null, at(0), 'HC Wettern', '/').state;
    const firstGoal = full.events.findIndex((e) => e.type === 'goal') + 1;
    const r = diffGame(before, at(firstGoal), 'HC Wettern', '/');
    const goal = r.messages.find((m) => m.kind === 'goal')!;
    expect(goal.title).toBe('MÅL! HC Wettern 1–0 Rydaholms SK');
    expect(goal.body).toBe('Wiggo Kadebro (Axel Appelqvist, Noak Kamperhaug) i powerplay · 1:a perioden 02:31');
  });

  it('skickar inte gamla mål om bevakningen startar mitt i matchen', () => {
    const r = diffGame(null, at(20), 'HC Wettern', '/');
    expect(r.messages.filter((m) => m.kind === 'goal')).toHaveLength(0);
    expect(r.state.goals.length).toBeGreaterThan(0);
  });
});
