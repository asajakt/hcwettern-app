import type { GameDetail } from '../../shared/types';
import { epLink, fmtDay, useJson } from '../data';
import { ShotBar, Scoreline } from './cards';
import { Empty, Icon, Sheet, useApp } from './ui';

const nm = (s?: string) => (s ?? '').replace(/^(\d+)\.\s*(.+?),\s*(.+)$/, '#$1 $3 $2');
const strength: Record<string, string> = { EQ: '', PP1: 'Powerplay', PP2: 'Powerplay', SH1: 'Boxplay', SH2: 'Boxplay', EN: 'Tom bur', PS: 'Straff', GWS: 'Straff' };

/** Matchrapport: resultat, skott och händelser per period. */
export function GameSheet({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { live, club } = useApp();
  const fetched = useJson<GameDetail>(live?.gameId === gameId ? null : `games/${gameId}.json`, 60_000);
  const g = live?.gameId === gameId ? live : fetched;
  const ourAbbr = g ? (g.home === club.name ? g.homeAbbr : g.awayAbbr) : '';
  const periods = g ? [...new Set(g.events.map((e) => e.period))] : [];
  return (
    <Sheet onClose={onClose}>
      {!g ? (
        <Empty>Matchrapporten finns inte hämtad ännu.</Empty>
      ) : (
        <>
          <div className="sheet-head">
            <small>{fmtDay(g.date)} · {g.venue}</small>
            <Scoreline home={g.home} away={g.away} center={<><div className="big-score">{g.homeScore}–{g.awayScore}</div><div className="clock">{g.status === 'live' ? <span className="livepill">LIVE</span> : g.statusText} {g.periods && `(${g.periods})`}</div></>} />
            <ShotBar shots={g.shots} />
            <div className="kv">
              <span>Utvisningsminuter</span><b>{g.pim[0]} – {g.pim[1]}</b>
              {g.spectators ? (<><span>Åskådare</span><b>{g.spectators}</b></>) : null}
            </div>
          </div>
          {periods.map((p) => (
            <div key={p}>
              <h4 className="period">{p}</h4>
              {g.events
                .filter((e) => e.period === p && e.type !== 'goalie')
                .map((e, i) => (
                  <div key={i} className={`tl ${e.type} ${e.team === ourAbbr ? 'ours' : ''}`}>
                    <time>{e.time}</time>
                    <div>
                      {e.type === 'goal' && (
                        <>
                          <b>MÅL {e.score}</b> <span className="tagsm">{e.team}</span> {strength[e.strength ?? ''] && <span className="tagsm hl">{strength[e.strength!]}</span>}
                          <div>{nm(e.player).replace(/\s*\(\d+\)$/, '')}</div>
                          {!!e.assists?.length && <small>Assist: {e.assists.map(nm).join(', ')}</small>}
                        </>
                      )}
                      {e.type === 'penalty' && (<><span className="tagsm">{e.team}</span> {nm(e.player)}<small>{e.detail}</small></>)}
                      {e.type === 'timeout' && <><span className="tagsm">{e.team}</span> Timeout</>}
                      {e.type === 'other' && <>{e.team} {e.detail} {e.player}</>}
                    </div>
                  </div>
                ))}
            </div>
          ))}
          <a className="btn ghost wide" href={`https://stats.swehockey.se/Game/Events/${g.gameId}`} target="_blank" rel="noreferrer">
            Öppna på swehockey <Icon name="ext" size={14} />
          </a>
        </>
      )}
    </Sheet>
  );
}

const posName: Record<string, string> = { GK: 'Målvakt', LD: 'Back', RD: 'Back', D: 'Back', CE: 'Center', C: 'Center', LW: 'Vänsterforward', RW: 'Högerforward', F: 'Forward' };
export const positionName = (p: string) => posName[p] ?? p;

/** Spelarkort med säsongens siffror och länk till Elite Prospects. */
export function PlayerSheet({ name, onClose }: { name: string; onClose: () => void }) {
  const { team } = useApp();
  const r = team?.roster.find((p) => p.name === name);
  const s = team?.skaters.find((p) => p.name === name);
  const gk = team?.goalies.find((p) => p.name === name);
  const number = r?.number ?? s?.number ?? gk?.number ?? '';
  return (
    <Sheet onClose={onClose}>
      <div className="player-head">
        <div className="av big">{number}</div>
        <h3>{name}</h3>
        <small>{positionName(r?.pos ?? s?.pos ?? (gk ? 'GK' : ''))}{r?.shoots ? ` · skjuter ${r.shoots === 'L' ? 'vänster' : 'höger'}` : ''}</small>
      </div>
      <div className="statgrid">
        {gk ? (
          <>
            <div><b>{gk.gpi}</b><span>Matcher</span></div>
            <div><b>{gk.svsPct.toFixed(1)}%</b><span>Räddning</span></div>
            <div><b>{gk.gaa.toFixed(2)}</b><span>Insl./match</span></div>
            <div><b>{gk.so}</b><span>Hållna nollor</span></div>
          </>
        ) : s ? (
          <>
            <div><b>{s.gp}</b><span>Matcher</span></div>
            <div><b>{s.g}</b><span>Mål</span></div>
            <div><b>{s.a}</b><span>Assist</span></div>
            <div><b>{s.tp}</b><span>Poäng</span></div>
            <div><b>{s.ppg}</b><span>PP-mål</span></div>
            <div><b>{s.gwg}</b><span>Matchvinnare</span></div>
            <div><b>{s.pim}</b><span>Utv.min</span></div>
            <div><b>{s.gp ? (s.tp / s.gp).toFixed(2) : '0'}</b><span>Poäng/match</span></div>
          </>
        ) : (
          <Empty>Ingen statistik den här säsongen ännu.</Empty>
        )}
      </div>
      {r && (
        <div className="kv">
          {r.height ? (<><span>Längd</span><b>{r.height} cm</b></>) : null}
          {r.weight ? (<><span>Vikt</span><b>{r.weight} kg</b></>) : null}
          {r.youthClub ? (<><span>Moderklubb</span><b>{r.youthClub}</b></>) : null}
        </div>
      )}
      <a className="btn primary wide" href={epLink(name)} target="_blank" rel="noreferrer">
        Visa på Elite Prospects <Icon name="ext" size={14} />
      </a>
    </Sheet>
  );
}
