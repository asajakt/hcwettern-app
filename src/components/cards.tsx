import type { ReactNode } from 'react';
import type { Game, GameDetail, LiveStandingRow, RoundGame, StandingRow, Trend } from '../../shared/types';
import { ago, downloadIcs, fmtDay, fmtTime, mapsLink, startsAt } from '../data';
import { Badge, Card, TeamLogo, Countdown, DateBox, Empty, FormDots, Icon, LinkBtn, useApp } from './ui';

export const isOurs = (g: { home: string; away: string }, club: string) => g.home === club || g.away === club;

export function ourGames(games: Game[], club: string) {
  const ours = games.filter((g) => isOurs(g, club));
  const upcoming = ours.filter((g) => g.status !== 'final').sort((a, b) => a.date.localeCompare(b.date));
  const results = ours.filter((g) => g.status === 'final').sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, results };
}

/* ---------- Pågående match ---------- */
export function LiveCard({ game, big = false }: { game: GameDetail; big?: boolean }) {
  const { openGame } = useApp();
  const live = game.status === 'live';
  const recent = [...game.events].filter((e) => e.type === 'goal' || e.type === 'penalty').slice(-(big ? 4 : 2)).reverse();
  return (
    <Card
      className={`live ${big ? 'big' : ''}`}
      title={live ? 'Pågår nu' : 'Slutresultat'}
      right={live ? <span className="livepill">LIVE</span> : undefined}
      onClick={() => openGame(game.gameId)}
    >
      <Scoreline home={game.home} away={game.away} center={<><div className="big-score">{game.homeScore}–{game.awayScore}</div><div className="clock">{game.statusText}</div></>} />
      {big && <ShotBar shots={game.shots} />}
      {recent.map((e, i) => (
        <div className="ev" key={i}>
          <time>{e.time}</time>
          <span>
            {e.type === 'goal' ? <b>MÅL {e.team} {e.score}</b> : <>Utvisning {e.team}</>} {e.player?.replace(/^\d+\.\s*/, '')}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function ShotBar({ shots }: { shots: [number, number] }) {
  const tot = shots[0] + shots[1] || 1;
  return (
    <div className="shots">
      <span>{shots[0]}</span>
      <div className="sb"><i style={{ width: `${(shots[0] / tot) * 100}%` }} /></div>
      <span>{shots[1]}</span>
      <div className="lbl">Skott på mål</div>
    </div>
  );
}

export function Scoreline({ home, away, center }: { home: string; away: string; center: ReactNode }) {
  return (
    <div className="score">
      <div className="tm"><Badge team={home} /><b>{home}</b></div>
      <div>{center}</div>
      <div className="tm"><Badge team={away} /><b>{away}</b></div>
    </div>
  );
}

/* ---------- Nästa match ---------- */
export function NextGameCard({ game }: { game?: Game }) {
  const { club } = useApp();
  if (!game) return <Card title="Nästa match"><Empty>Inga fler matcher inlagda just nu.</Empty></Card>;
  return (
    <Card className="next" title={`Nästa match · ${fmtDay(game.date)}`} right={<span>{fmtTime(game.date)}</span>}>
      <Scoreline home={game.home} away={game.away} center={<div className="vs">VS</div>} />
      <Countdown to={startsAt(game)} />
      <div className="venue"><Icon name="pin" size={14} /> {game.venue}</div>
      <div className="btns">
        <button className="btn primary" onClick={() => downloadIcs(game, club.name)}><Icon name="cal" size={16} /> Lägg i kalendern</button>
        <a className="btn ghost" href={mapsLink(game.venue)} target="_blank" rel="noreferrer"><Icon name="pin" size={16} /> Hitta hit</a>
      </div>
    </Card>
  );
}

/* ---------- Senaste resultat ---------- */
export function LastResultCard({ game }: { game?: Game }) {
  const { club, openGame } = useApp();
  if (!game) return null;
  const us = game.home === club.name ? game.homeScore! : game.awayScore!;
  const them = game.home === club.name ? game.awayScore! : game.homeScore!;
  const res = us > them ? 'Vinst' : 'Förlust';
  return (
    <Card title={`Senaste match · ${fmtDay(game.date)}`} right={<span className={`tag ${us > them ? 'win' : 'loss'}`}>{res}{game.overtime ? ' (ÖT)' : ''}</span>} onClick={() => game.gameId && openGame(game.gameId)} className="clickable">
      <Scoreline home={game.home} away={game.away} center={<><div className="big-score">{game.homeScore}–{game.awayScore}</div><div className="clock">{game.periods}</div></>} />
      {game.gameId && <div className="more">Matchrapport <Icon name="chev" size={14} /></div>}
    </Card>
  );
}

/* ---------- Matchlista ---------- */
export function GameRow({ g }: { g: Game }) {
  const { club, openGame } = useApp();
  const ours = isOurs(g, club.name);
  const won = g.status === 'final' && ours && ((g.home === club.name) === (g.homeScore! > g.awayScore!));
  return (
    <div className={`m ${g.gameId ? 'clickable' : ''}`} onClick={() => g.gameId && openGame(g.gameId)}>
      <DateBox iso={g.date} />
      <div className="mi">
        <span className="teams">
          <TeamLogo team={g.home} size={16} /><span className={g.home === club.name ? 'us' : ''}>{g.home}</span> – <TeamLogo team={g.away} size={16} /><span className={g.away === club.name ? 'us' : ''}>{g.away}</span>
        </span>
        <small>{g.status === 'final' ? `${g.periods ?? ''}${g.spectators ? ` · ${g.spectators} åskådare` : ''}` : `${fmtTime(g.date)} · ${g.venue}`}</small>
      </div>
      {g.status === 'final' && (
        <span className={`res ${ours ? (won ? 'win' : 'loss') : 'neutral'}`}>
          {g.homeScore}–{g.awayScore}
          {g.overtime ? '*' : ''}
        </span>
      )}
    </div>
  );
}

/* ---------- Tabell ---------- */
export function StandingsTable({ rows, compact = false }: { rows: StandingRow[]; compact?: boolean }) {
  const { club } = useApp();
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>#</th>
          <th className="l">Lag</th>
          <th title="Spelade matcher">S</th>
          {!compact && <th title="Vinster (inkl. förlängning)">V</th>}
          {!compact && <th title="Förluster (inkl. förlängning)">F</th>}
          <th title="Målskillnad">+/-</th>
          {!compact && <th className="hide-xs">Form</th>}
          <th>P</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.team} className={r.team === club.name ? 'me' : ''}>
            <td>{r.rank}</td>
            <td className="l"><span className="tcell"><TeamLogo team={r.team} size={18} />{compact ? r.team.replace(/ (HC|IF|SK|IS|SGF|HK|AIF HK)$/, '') : r.team}</span></td>
            <td>{r.gp}</td>
            {!compact && <td>{r.w + r.otw}</td>}
            {!compact && <td>{r.l + r.otl}</td>}
            <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
            {!compact && <td className="hide-xs"><FormDots form={r.form} /></td>}
            <td><b>{r.pts}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const shortName = (t: string) => t.replace(/ (HC|IF|SK|IS|SGF|HK|AIF HK)$/, '');

/** Fem rader runt vårt lag. Under en omgång visas livetabellen. */
export function StandingsSnippet() {
  const { team, club, go, liveTable } = useApp();
  if (!team) return null;
  const rows: { team: string }[] = liveTable?.standings ?? team.standings;
  const i = Math.max(0, rows.findIndex((r) => r.team === club.name));
  const start = Math.min(Math.max(0, i - 2), Math.max(0, rows.length - 5));
  if (liveTable)
    return (
      <Card title={<>Tabelläge <span className="livepill">LIVE</span></>} right={<LinkBtn onClick={() => go('table')}>Livetabell</LinkBtn>}>
        <LiveStandingsTable rows={liveTable.standings.slice(start, start + 5)} lineAfter={liveTable.lineAfter} compact />
      </Card>
    );
  return (
    <Card title="Tabelläge" right={<LinkBtn onClick={() => go('table')}>Hela tabellen</LinkBtn>}>
      <StandingsTable rows={team.standings.slice(start, start + 5)} compact />
    </Card>
  );
}

/* ---------- Livetabell ---------- */
const trendText: Record<Trend, string> = { up: 'Klättrar', down: 'Tappar', same: 'Oförändrad' };

export function TrendArrow({ trend }: { trend: Trend }) {
  return (
    <span className={`trend ${trend}`} title={trendText[trend]} aria-label={trendText[trend]}>
      {trend === 'up' ? (
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1 9.5 8h-9z" fill="currentColor" /></svg>
      ) : trend === 'down' ? (
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 9 .5 2h9z" fill="currentColor" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="4.25" width="6" height="1.5" rx=".75" fill="currentColor" /></svg>
      )}
    </span>
  );
}

/** Tabellen som den ser ut om alla pågående matcher slutade nu. */
export function LiveStandingsTable({ rows, lineAfter = [], compact = false }: { rows: LiveStandingRow[]; lineAfter?: number[]; compact?: boolean }) {
  const { club } = useApp();
  // swehockeys T räknar både förlängningsmatcher och matcher som står lika just nu.
  // Förlängningsmatcherna finns redan i V och F, så kvar blir de som är oavgjorda nu.
  const tiedNow = (r: LiveStandingRow) => Math.max(0, r.t - r.otw - r.otl);
  const ties = !compact && rows.some((r) => tiedNow(r) > 0);
  return (
    <table className="tbl live">
      <thead>
        <tr>
          <th>#</th>
          <th aria-label="Trend" />
          <th className="l">Lag</th>
          <th title="Spelade matcher">S</th>
          {!compact && <th title="Vinster (inkl. förlängning)">V</th>}
          {ties && <th title="Oavgjort just nu">O</th>}
          {!compact && <th title="Förluster (inkl. förlängning)">F</th>}
          <th title="Målskillnad">+/-</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.team} className={`${r.team === club.name ? 'me' : ''} ${lineAfter.includes(r.rank) ? 'line' : ''}`}>
            <td>{r.rank}</td>
            <td className="tr"><TrendArrow trend={r.trend} /></td>
            <td className="l">
              <span className="tcell">
                <TeamLogo team={r.team} size={18} />
                {compact ? shortName(r.team) : r.team}
                {r.playing && <i className="playing" title="Spelar just nu" />}
              </span>
            </td>
            <td>{r.gp}</td>
            {!compact && <td>{r.w + r.otw}</td>}
            {ties && <td>{tiedNow(r)}</td>}
            {!compact && <td>{r.l + r.otl}</td>}
            <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
            <td><b>{r.pts}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** swehockeys engelska matchstatus på svenska. */
const svStatus = (s: string) =>
  s
    .replace(/(\d)(st|nd|rd|th) period/i, '$1:a perioden')
    .replace(/Waiting for/i, 'Inväntar')
    .replace(/Overtime/i, 'Förlängning')
    .replace(/Penalty shots?/i, 'Straffar')
    .replace(/ ended/i, ' slut')
    .replace(/Powerplay \((\d) on (\d)\) for/i, 'Powerplay $1 mot $2 för');

/** Kvällens matcher i serien med ställning och matchstatus. */
export function RoundGames({ games }: { games: RoundGame[] }) {
  const { club, openGame } = useApp();
  const status = (g: RoundGame) => (g.state === 'final' ? 'Slut' : g.state === 'scheduled' ? g.statusText || 'Ej startad' : svStatus(g.statusText));
  return (
    <div className="rgames">
      {games.map((g) => (
        <div key={g.gameId ?? g.home} className={`rg ${isOurs(g, club.name) ? 'ours' : ''} ${g.gameId ? 'clickable' : ''}`} onClick={() => g.gameId && openGame(g.gameId)}>
          <span className="t h"><span className={g.home === club.name ? 'us' : ''}>{shortName(g.home)}</span><TeamLogo team={g.home} size={20} /></span>
          <span className={`sc ${g.state}`}>{g.homeScore ?? '–'}–{g.awayScore ?? '–'}</span>
          <span className="t a"><TeamLogo team={g.away} size={20} /><span className={g.away === club.name ? 'us' : ''}>{shortName(g.away)}</span></span>
          <small className={`st ${g.state}`}>{status(g)}</small>
        </div>
      ))}
    </div>
  );
}

/* ---------- Poängliga ---------- */
export function TopScorers({ n = 3, title = 'Poängliga' }: { n?: number; title?: string }) {
  const { team, openPlayer, go } = useApp();
  if (!team || !team.skaters.length) return null;
  const top = [...team.skaters].sort((a, b) => b.tp - a.tp || b.g - a.g).slice(0, n);
  const max = top[0].tp || 1;
  return (
    <Card title={title} right={n < 10 ? <LinkBtn onClick={() => go('stats')}>All statistik</LinkBtn> : <span>M · A · P</span>}>
      {top.map((p) => (
        <div className="pl clickable" key={p.name} onClick={() => openPlayer(p.name)}>
          <div className="num">{p.number}</div>
          <div className="n">
            {p.name}
            <small>{p.pos} · {p.g} mål · {p.a} assist</small>
            <div className="bar"><i style={{ width: `${(p.tp / max) * 100}%` }} /></div>
          </div>
          <div className="pts">{p.tp}</div>
        </div>
      ))}
    </Card>
  );
}

/* ---------- Nyheter ---------- */
export function NewsList({ n }: { n?: number }) {
  const { news, go } = useApp();
  const list = n ? news.slice(0, n) : news;
  return (
    <Card title="Senaste nytt från föreningen" right={n ? <LinkBtn onClick={() => go('news')}>Alla</LinkBtn> : undefined}>
      {list.length === 0 && <Empty>Inga nyheter hämtade ännu.</Empty>}
      {list.map((a, i) => (
        <a className="news" key={a.id} href={a.url} target="_blank" rel="noreferrer">
          {a.image ? <img className="thumb" src={a.image} alt="" loading="lazy" /> : <div className={`thumb t${i % 4}`} />}
          <div>
            <b>{a.title}</b>
            {!n && a.summary && <p>{a.summary}</p>}
            <span>{a.date ? ago(a.date) : ''} · svenskalag.se</span>
          </div>
        </a>
      ))}
    </Card>
  );
}

/* ---------- Sociala kanaler ---------- */
export function SocialCard() {
  const { club } = useApp();
  return (
    <Card title="Följ HC Wettern">
      <div className="social">
        {club.social.facebook && (
          <a href={club.social.facebook} target="_blank" rel="noreferrer" className="soc fb"><Icon name="fb" size={18} /> A-laget på Facebook</a>
        )}
        {club.social.instagramYouth && (
          <a href={club.social.instagramYouth} target="_blank" rel="noreferrer" className="soc ig"><Icon name="insta" size={18} /> @hcw_ungdom</a>
        )}
        <a href={club.website} target="_blank" rel="noreferrer" className="soc web"><Icon name="globe" size={18} /> Föreningens hemsida</a>
      </div>
    </Card>
  );
}
