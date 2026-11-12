// Tolkar HTML-sidor från stats.swehockey.se till vår datamodell.
// Allt bygger på tabellernas rubriker (th.tdHeader) i stället för kolumnpositioner,
// så att parsern tål mindre layoutändringar.
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  Game,
  GameDetail,
  GameEvent,
  GoalieStat,
  LeagueLeader,
  NewsItem,
  RosterPlayer,
  SkaterStat,
  StandingRow,
} from '../shared/types';

type $ = cheerio.CheerioAPI;
type Rec = Record<string, string>;

export const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const int = (s: string | undefined) => {
  const n = parseInt(clean(s).replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const num = (s: string | undefined) => {
  const n = parseFloat(clean(s).replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
/** "Lindqvist, Oliver" -> "Oliver Lindqvist" */
export const flipName = (s: string) => {
  const t = clean(s);
  const i = t.indexOf(',');
  return i < 0 ? t : `${t.slice(i + 1).trim()} ${t.slice(0, i).trim()}`;
};

/** Läser en tblContent-tabell till poster nycklade på kolumnrubrik. */
function records($: $, table: cheerio.Cheerio<AnyNode>): { headers: string[]; rows: { rec: Rec; tr: cheerio.Cheerio<AnyNode> }[] } {
  const headers: string[] = [];
  table.find('> tbody > tr, > tr').each((_, tr) => {
    const ths = $(tr).children('th.tdHeader, th.tdHeaderTeam');
    if (ths.length && !headers.length) ths.each((i, th) => void headers.push(clean($(th).text()) || `_${i}`));
  });
  const rows: { rec: Rec; tr: cheerio.Cheerio<AnyNode> }[] = [];
  table.find('> tbody > tr, > tr').each((_, tr) => {
    const tds = $(tr).children('td');
    if (!headers.length || tds.length !== headers.length) return;
    const rec: Rec = {};
    tds.each((i, td) => void (rec[headers[i]] = clean($(td).text())));
    rows.push({ rec, tr: $(tr) });
  });
  return { headers, rows };
}

function tableByTitle($: $, re: RegExp) {
  return $('table.tblContent')
    .filter((_, t) => re.test(clean($(t).find('h2').first().text())))
    .first();
}

export function sourceUpdated($: $): string | undefined {
  const m = $('body').text().match(/Last update:\s*(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
  return m?.[1];
}

/* ---------------- Tabell ---------------- */
export function parseStandings($: $): StandingRow[] {
  const t = tableByTitle($, /Standings/i);
  return records($, t).rows
    .filter((r) => /^\d+$/.test(r.rec.RK ?? ''))
    .map(({ rec }) => {
      const [gf, ga] = (rec['GF:GA (GD)'] ?? '0:0').split(/[:(]/).map(int);
      return {
        rank: int(rec.RK),
        team: rec.Team,
        abbr: '',
        gp: int(rec.GP),
        w: int(rec.W),
        t: int(rec.T),
        l: int(rec.L),
        otw: int(rec.OTW),
        otl: int(rec.OTL),
        gf,
        ga,
        gd: gf - ga,
        pts: int(rec.TP),
        form: [],
      };
    });
}

/* ---------------- Spelschema & resultat ---------------- */
export function parseSchedule($: $): Game[] {
  const t = tableByTitle($, /Schedule and Results/i);
  const { rows } = records($, t);
  let round: number | undefined;
  const games: Game[] = [];
  for (const { rec, tr } of rows) {
    if (/^\d+$/.test(rec.Round ?? '')) round = int(rec.Round);
    const dm = (rec.Date ?? '').match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);
    const gm = (rec.Game ?? '').split(' - ');
    if (!dm || gm.length < 2) continue;
    const href = tr.find('a[href*="Game/Events"]').attr('href') ?? '';
    const gameId = href.match(/Game\/Events\/(\d+)/)?.[1];
    const sm = (rec.Result ?? '').match(/(\d+)\s*-\s*(\d+)/);
    const periodCell = tr.children('td').eq(4).text();
    const periods = clean(periodCell).replace(/[()]/g, '').trim();
    const g: Game = {
      scheduleId: tr.find('span.lnkTooltip').attr('title') ?? `${dm[0]}-${rec.Game}`,
      gameId,
      round,
      date: `${dm[1]}T${dm[2] ?? '00:00'}`,
      home: clean(gm[0]),
      away: clean(gm.slice(1).join(' - ')),
      venue: rec.Venue ?? '',
      status: sm ? 'final' : 'scheduled',
    };
    if (sm) {
      g.homeScore = int(sm[1]);
      g.awayScore = int(sm[2]);
      g.periods = periods || undefined;
      g.overtime = periods ? periods.split(',').length > 3 : false;
      const spec = int(rec.Spectators);
      if (spec) g.spectators = spec;
    }
    games.push(g);
  }
  return games;
}

/** Senaste fem matcherna per lag: W = vinst, O = förlust efter förlängning/straffar, L = förlust */
export function computeForm(games: Game[], team: string): ('W' | 'L' | 'O')[] {
  return games
    .filter((g) => g.status === 'final' && (g.home === team || g.away === team))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5)
    .map((g) => {
      const us = g.home === team ? g.homeScore! : g.awayScore!;
      const them = g.home === team ? g.awayScore! : g.homeScore!;
      if (us > them) return 'W';
      return g.overtime ? 'O' : 'L';
    });
}

/* ---------------- Trupp & spelarstatistik (en tabell per lag) ---------------- */
function teamSections($: $) {
  // Går igenom alla tblContent i dokumentordning. En tabell med th.tdTitle startar ett nytt lag.
  const out: { team: string; sub: string; table: cheerio.Cheerio<AnyNode> }[] = [];
  let team = '';
  $('table.tblContent').each((_, el) => {
    const t = $(el);
    const title = clean(t.find('th.tdTitle').first().text()).replace('[Top]', '').trim();
    if (title) team = title;
    const sub = clean(t.find('th.tdSubTitle').first().text());
    if (team) out.push({ team, sub, table: t });
  });
  return out;
}

export function parseRoster($: $, team: string): RosterPlayer[] {
  const sec = teamSections($).find((s) => s.team === team && /Roster/i.test(s.sub));
  if (!sec) return [];
  return records($, sec.table).rows
    .filter((r) => r.rec.Name)
    .map(({ rec }) => ({
      number: rec.No ?? '',
      name: flipName(rec.Name),
      pos: rec.Position ?? '',
      shoots: rec['L/R'] ?? '',
      height: int(rec.Height) || undefined,
      weight: int(rec.Weight) || undefined,
      youthClub: rec['Youth club'] || undefined,
    }));
}

export function parsePlayersByTeam($: $, team: string): { skaters: SkaterStat[]; goalies: GoalieStat[] } {
  const secs = teamSections($).filter((s) => s.team === team);
  const sk = secs.find((s) => /Playing Statistics/i.test(s.sub));
  const gk = secs.find((s) => /Goalkeeping/i.test(s.sub));
  const skaters = sk
    ? records($, sk.table).rows.map(({ rec }) => ({
        number: rec.No ?? '',
        name: flipName(rec.Name),
        pos: rec.Pos ?? '',
        gp: int(rec.GP),
        g: int(rec.G),
        a: int(rec.A),
        tp: int(rec.TP),
        pim: int(rec.PIM),
        ppg: int(rec.PPG),
        gwg: int(rec.GWG),
      }))
    : [];
  const goalies = gk
    ? records($, gk.table).rows.map(({ rec }) => ({
        number: rec.No ?? '',
        name: flipName(rec.Name),
        gpi: int(rec.GPI),
        ga: int(rec.GA),
        svs: int(rec.SVS),
        sog: int(rec.SOG),
        svsPct: num(rec['SVS%']),
        gaa: num(rec.GAA),
        so: int(rec.SO),
      }))
    : [];
  return { skaters, goalies };
}

/* ---------------- Seriens poängliga (ger även lagförkortningar) ---------------- */
export function parseScoringLeaders($: $): { leaders: LeagueLeader[]; abbreviations: Record<string, string> } {
  const t = tableByTitle($, /Scoring Leaders/i);
  const abbreviations: Record<string, string> = {};
  const leaders = records($, t).rows.map(({ rec, tr }) => {
    const span = tr.find('span[title]').filter((_, s) => clean($(s).text()) === rec.Team).first();
    const full = span.attr('title') ?? rec.Team;
    abbreviations[full] = rec.Team;
    return {
      rank: int(rec.Rk),
      number: rec.No ?? '',
      name: flipName(rec.Name),
      abbr: rec.Team,
      team: full,
      pos: rec.Pos ?? '',
      gp: int(rec.GP),
      g: int(rec.G),
      a: int(rec.A),
      tp: int(rec.TP),
    };
  });
  return { leaders, abbreviations };
}

/* ---------------- Matchsida (händelser) ---------------- */
export function parseGame($: $, gameId: string): GameDetail {
  const head = $('table.tblContent').first();
  const [home, away] = clean(head.find('h2').first().text()).split(' - ').map(clean);
  const h3 = head.find('h3');
  const date = clean(h3.eq(0).text()).replace(' ', 'T');
  const venue = clean(h3.eq(2).text());
  const info = head.find('td.tdInfoArea');
  const divs = info.find('div');
  const sm = clean(divs.eq(0).text()).match(/(\d+)\s*-\s*(\d+)/);
  const periods = clean(divs.eq(1).text()).replace(/[()]/g, '').trim();
  const statusText = clean(divs.eq(2).text());
  const spectators = int(clean(divs.eq(3).text()).replace(/\D+/g, '')) || undefined;

  const stat = (label: string): [number, number] => {
    const cells = head.find('td').filter((_, td) => clean($(td).text()) === label);
    return [int(cells.eq(0).next().text()), int(cells.eq(1).next().text())];
  };

  const events: GameEvent[] = [];
  let period = '';
  const actions = $('table.tblContent').filter((_, t) => /Actions/.test(clean($(t).find('h2').first().text()))).first();
  actions.find('tr').each((_, tr) => {
    const r = $(tr);
    const sub = r.children('th.tdSubTitle');
    if (sub.length) {
      period = clean(sub.text());
      return;
    }
    const tds = r.children('td');
    const time = clean(tds.eq(0).text());
    if (!/^\d{1,3}:\d{2}$/.test(time) || /Goalkeeper Summary/i.test(period)) return;
    const kind = clean(tds.eq(1).text());
    const team = clean(tds.eq(2).text());
    const who = tds.eq(3);
    const player = clean(who.clone().children().remove().end().text());
    const assists = who.find('div').map((_, d) => clean($(d).text())).get();
    const detail = clean(tds.eq(4).text()) || undefined;
    const goal = kind.match(/^(\d+-\d+)\s*\(([^)]+)\)/);
    const ev: GameEvent = { period: svPeriod(period), time, team, type: 'other' };
    if (goal) Object.assign(ev, { type: 'goal', score: goal[1], strength: goal[2], player, assists });
    else if (/min/i.test(kind)) Object.assign(ev, { type: 'penalty', player, detail: `${kind} · ${detail ?? ''}`.trim() });
    else if (/^TO$/i.test(kind)) Object.assign(ev, { type: 'timeout' });
    else if (/GK/i.test(kind)) Object.assign(ev, { type: 'goalie', player, detail: kind });
    else Object.assign(ev, { player, detail: kind });
    events.push(ev);
  });
  events.reverse(); // sidan listar senaste först

  const abbrs = [...new Set(events.map((e) => e.team).filter((t) => /^[A-ZÅÄÖ]{2,4}$/.test(t)))];
  const title = clean($('title').text()); // "WET - RYD (7-6)"
  const tm = title.match(/^([A-ZÅÄÖ]{2,4})\s*-\s*([A-ZÅÄÖ]{2,4})/);
  const final = /Final/i.test(statusText);
  return {
    gameId,
    home,
    away,
    homeAbbr: tm?.[1] ?? abbrs[0] ?? '',
    awayAbbr: tm?.[2] ?? abbrs[1] ?? '',
    date,
    venue,
    status: final ? 'final' : sm ? 'live' : 'scheduled',
    statusText: svStatus(statusText),
    homeScore: sm ? int(sm[1]) : 0,
    awayScore: sm ? int(sm[2]) : 0,
    periods,
    shots: stat('Shots'),
    pim: stat('PIM'),
    spectators,
    events,
    updatedAt: new Date().toISOString(),
  };
}

function svPeriod(p: string) {
  return p
    .replace(/1st period/i, '1:a perioden')
    .replace(/2nd period/i, '2:a perioden')
    .replace(/3rd period/i, '3:e perioden')
    .replace(/Overtime/i, 'Förlängning')
    .replace(/Game Winning Shots|Shootout/i, 'Straffar');
}
function svStatus(s: string) {
  if (/Final/i.test(s)) return 'Slutresultat';
  return svPeriod(s) || 'Pågår';
}

/* ---------------- Klubbsidan: hitta klubbens serier ---------------- */
export function parseClubSeries($: $, clubSlug: string): { name: string; seriesId: number }[] {
  const seen = new Map<number, string>();
  $('option').each((_, o) => {
    const v = $(o).attr('value') ?? '';
    const m = v.match(new RegExp(`/District/[^/]+/${clubSlug}/ScheduleAndResults/\\w+/(\\d+)`));
    // Första förekomsten är seriens namn; senare menyer (Live/Overview/Schedule) återanvänder samma id
    if (m && !seen.has(int(m[1]))) seen.set(int(m[1]), clean($(o).text()));
  });
  return [...seen].map(([seriesId, name]) => ({ seriesId, name }));
}

/* ---------------- Nyheter (RSS från svenskalag.se) ---------------- */
export function parseRss(xml: string, max = 20): NewsItem[] {
  const $x = cheerio.load(xml, { xmlMode: true });
  return $x('item')
    .slice(0, max)
    .map((_, it) => {
      const i = $x(it);
      const url = clean(i.find('link').text()).replace(/\?utm_.*$/, '');
      const descHtml = i.find('description').text();
      const $d = cheerio.load(descHtml);
      const image = i.find('enclosure').attr('url') ?? $d('img').first().attr('src');
      const text = clean($d.root().text());
      // svenskalag.se använder <a10:updated> i stället för <pubDate>
      const updated = i.children().filter((_, el) => (el as { name?: string }).name === 'a10:updated');
      const pub = clean(i.find('pubDate').text()) || clean(updated.text());
      return {
        id: url.match(/nyheter\/(\d+)/)?.[1] ?? url,
        title: clean(i.find('title').text()),
        url,
        date: pub ? new Date(pub).toISOString() : '',
        summary: text.length > 220 ? text.slice(0, 217).replace(/\s+\S*$/, '') + '…' : text,
        image,
      };
    })
    .get();
}
