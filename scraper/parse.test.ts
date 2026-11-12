// Tester mot sparade swehockey-sidor (scraper/fixtures). Om swehockey ändrar sin HTML
// sparar man en ny kopia av sidan här och ser direkt vad som gått sönder.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import {
  computeForm,
  parseClubSeries,
  parseGame,
  parsePlayersByTeam,
  parseRoster,
  parseRss,
  parseSchedule,
  parseScoringLeaders,
  parseStandings,
} from './parse';

const fx = (f: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url)), 'utf8');
const load = (f: string) => cheerio.load(fx(f));

describe('swehockey-parser', () => {
  it('läser tabellen', () => {
    const s = parseStandings(load('overview.html'));
    expect(s).toHaveLength(10);
    expect(s[0]).toMatchObject({ rank: 1, team: 'HC Wettern', gp: 9, w: 8, t: 1, l: 0, gf: 58, ga: 26, pts: 26 });
  });

  it('läser spelschemat med resultat och kommande matcher', () => {
    const g = parseSchedule(load('schedule.html'));
    expect(g.length).toBeGreaterThan(100);
    const first = g[0];
    expect(first).toMatchObject({ round: 1, date: '2026-09-27T16:00', home: 'HC Wettern', away: 'Linköping Mighty Ravens HC', homeScore: 11, awayScore: 1, status: 'final', venue: 'Vadstena Ishall' });
    expect(first.gameId).toBe('1118616');
    expect(g.some((x) => x.status === 'scheduled')).toBe(true);
    const ot = g.find((x) => x.gameId === '1118651');
    expect(ot?.overtime).toBe(true);
    expect(computeForm(g, 'HC Wettern').length).toBe(5);
  });

  it('läser truppen', () => {
    const r = parseRoster(load('roster.html'), 'HC Wettern');
    expect(r.length).toBeGreaterThan(15);
    expect(r[0]).toMatchObject({ number: '1', name: 'Hjalmar Lax', pos: 'GK' });
  });

  it('läser spelar- och målvaktsstatistik per lag', () => {
    const { skaters, goalies } = parsePlayersByTeam(load('playersbyteam.html'), 'HC Wettern');
    expect(skaters.length).toBeGreaterThan(10);
    expect(skaters[0].tp).toBeGreaterThan(0);
    expect(goalies[0]).toMatchObject({ number: '30', name: 'Melvin Johansson' });
    expect(goalies[0].svsPct).toBeGreaterThan(50);
  });

  it('läser seriens poängliga och lagförkortningar', () => {
    const { leaders, abbreviations } = parseScoringLeaders(load('scoring.html'));
    expect(leaders[0]).toMatchObject({ rank: 1, name: 'Isak Ekelund', abbr: 'VAL', team: 'Valdemarsviks IF' });
    expect(abbreviations['HC Wettern']).toBe('WET');
  });

  it('läser matchhändelser', () => {
    const d = parseGame(load('game.html'), '1118651');
    expect(d).toMatchObject({ home: 'HC Wettern', away: 'Rydaholms SK', homeAbbr: 'WET', awayAbbr: 'RYD', homeScore: 7, awayScore: 6, status: 'final', spectators: 193 });
    expect(d.shots).toEqual([44, 27]);
    const goals = d.events.filter((e) => e.type === 'goal');
    expect(goals).toHaveLength(13);
    expect(goals.at(-1)).toMatchObject({ team: 'WET', score: '7-6', player: '21. Lindqvist, Oliver' });
    const withAssist = goals.find((e) => e.score === '6-6');
    expect(withAssist?.assists).toEqual(['2. Bengtsson, Albin']);
  });

  it('hittar klubbens serier', () => {
    const s = parseClubSeries(load('club.html'), 'HCWettern');
    expect(s.find((x) => x.seriesId === 21407)?.name).toBe('HockeyTrean');
  });

  it('läser nyheter från RSS', () => {
    const n = parseRss(fx('rss.xml'));
    expect(n.length).toBeGreaterThan(3);
    expect(n[0].title).toBe('Bingolotter');
    expect(n[0].url).not.toContain('utm_');
    expect(n[0].date).toBe('2026-11-09T20:51:50.000Z');
  });
});
