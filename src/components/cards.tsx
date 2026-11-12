import type { ReactNode } from 'react';
import type { Game, GameDetail, StandingRow } from '../../shared/types';
import { ago, downloadIcs, fmtDay, fmtTime, mapsLink, startsAt } from '../data';
import { Badge, Card, Countdown, DateBox, Empty, FormDots, Icon, LinkBtn, useApp } from './ui';

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
        <span className={g.home === club.name ? 'us' : ''}>{g.home}</span> – <span className={g.away === club.name ? 'us' : ''}>{g.away}</span>
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
            <td className="l">{compact ? r.team.replace(/ (HC|IF|SK|IS|SGF|HK|AIF HK)$/, '') : r.team}</td>
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

/** Fem rader runt vårt lag. */
export function StandingsSnippet() {
  const { team, club, go } = useApp();
  if (!team) return null;
  const i = Math.max(0, team.standings.findIndex((r) => r.team === club.name));
  const start = Math.min(Math.max(0, i - 2), Math.max(0, team.standings.length - 5));
  return (
    <Card title="Tabelläge" right={<LinkBtn onClick={() => go('table')}>Hela tabellen</LinkBtn>}>
      <StandingsTable rows={team.standings.slice(start, start + 5)} compact />
    </Card>
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
