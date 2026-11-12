import { useState } from 'react';
import { GameRow, LastResultCard, LiveCard, NewsList, NextGameCard, SocialCard, StandingsSnippet, StandingsTable, TopScorers, ourGames } from '../components/cards';
import { positionName } from '../components/sheets';
import { Card, Empty, Icon, useApp } from '../components/ui';
import { ago } from '../data';

const useOurGames = () => {
  const { team, club } = useApp();
  return ourGames(team?.games ?? [], club.name);
};

/* ---------------- Hem (mobil) ---------------- */
export function Home() {
  const { live } = useApp();
  const { upcoming, results } = useOurGames();
  return (
    <>
      {live && <LiveCard game={live} />}
      <NextGameCard game={upcoming[0]} />
      <LastResultCard game={results[0]} />
      <StandingsSnippet />
      <TopScorers />
      <NewsList n={3} />
      <SocialCard />
      <Source />
    </>
  );
}

/* ---------------- Matchcenter (surfplatta / storbild) ---------------- */
export function Dashboard() {
  const { live, team } = useApp();
  const { upcoming, results } = useOurGames();
  return (
    <div className="dash">
      <div className="d-hero">{live ? <LiveCard game={live} big /> : <NextGameCard game={upcoming[0]} />}</div>
      <div className="d-last"><LastResultCard game={results[0]} /></div>
      <div className="d-table">
        <Card title={team?.league} right={<span>Tabell</span>}>{team && <StandingsTable rows={team.standings} />}</Card>
      </div>
      <div className="d-scor"><TopScorers n={5} title="Poängliga" /></div>
      <div className="d-next">
        <Card title="Kommande matcher">{upcoming.slice(live ? 0 : 1, live ? 4 : 5).map((g) => <GameRow key={g.scheduleId} g={g} />)}</Card>
      </div>
      <div className="d-news"><NewsList n={4} /></div>
    </div>
  );
}

/* ---------------- Matcher ---------------- */
export function Games() {
  const { team } = useApp();
  const [all, setAll] = useState(false);
  const { upcoming, results } = useOurGames();
  const list = all ? team?.games ?? [] : null;
  return (
    <>
      <div className="seg">
        <button className={!all ? 'on' : ''} onClick={() => setAll(false)}>Våra matcher</button>
        <button className={all ? 'on' : ''} onClick={() => setAll(true)}>Hela serien</button>
      </div>
      {list ? (
        <SeriesByRound />
      ) : (
        <>
          <Card title="Kommande" right={<span>{upcoming.length} kvar</span>}>
            {upcoming.length ? upcoming.map((g) => <GameRow key={g.scheduleId} g={g} />) : <Empty>Inga kommande matcher.</Empty>}
          </Card>
          <Card title="Resultat" right={<span>* = efter förlängning/straffar</span>}>
            {results.length ? results.map((g) => <GameRow key={g.scheduleId} g={g} />) : <Empty>Inga spelade matcher ännu.</Empty>}
          </Card>
        </>
      )}
    </>
  );
}

function SeriesByRound() {
  const { team } = useApp();
  const games = team?.games ?? [];
  const rounds = [...new Set(games.map((g) => g.round ?? 0))];
  const current = games.find((g) => g.status !== 'final')?.round ?? rounds.at(-1);
  const [r, setR] = useState(current ?? 1);
  return (
    <Card
      title={`Omgång ${r}`}
      right={
        <span className="pager">
          <button disabled={r <= rounds[0]} onClick={() => setR(r - 1)} aria-label="Föregående">‹</button>
          <button disabled={r >= rounds.at(-1)!} onClick={() => setR(r + 1)} aria-label="Nästa">›</button>
        </span>
      }
    >
      {games.filter((g) => g.round === r).map((g) => <GameRow key={g.scheduleId} g={g} />)}
    </Card>
  );
}

/* ---------------- Tabell ---------------- */
export function Table() {
  const { team } = useApp();
  if (!team) return null;
  return (
    <>
      <Card title={team.league} right={<span>2026/27</span>}>
        <StandingsTable rows={team.standings} />
        <div className="legend"><i className="f-W" /> Vinst <i className="f-O" /> Förlust efter förlängning <i className="f-L" /> Förlust</div>
      </Card>
      <Source />
    </>
  );
}

/* ---------------- Statistik ---------------- */
export function Stats() {
  const { team, club, openPlayer } = useApp();
  const [sort, setSort] = useState<'tp' | 'g' | 'a' | 'pim'>('tp');
  if (!team) return null;
  const sk = team.skaters.filter((p) => p.pos !== 'GK').sort((a, b) => b[sort] - a[sort] || b.tp - a.tp);
  const ourAbbr = team.abbreviations[club.name];
  return (
    <>
      <Card title="Lagets spelare" right={<span>{sk.length} st</span>}>
        <div className="seg small">
          {([['tp', 'Poäng'], ['g', 'Mål'], ['a', 'Assist'], ['pim', 'Utv.min']] as const).map(([k, l]) => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
        <table className="tbl players">
          <thead><tr><th>#</th><th className="l">Spelare</th><th>S</th><th>M</th><th>A</th><th>P</th><th>Utv</th></tr></thead>
          <tbody>
            {sk.map((p) => (
              <tr key={p.name} className="clickable" onClick={() => openPlayer(p.name)}>
                <td>{p.number}</td><td className="l">{p.name} <small>{p.pos}</small></td><td>{p.gp}</td><td>{p.g}</td><td>{p.a}</td><td><b>{p.tp}</b></td><td>{p.pim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Målvakter" right={<span>Rädd% · Insl/m</span>}>
        {team.goalies.some((g) => g.gpi > 0) ? team.goalies.filter((g) => g.gpi > 0).sort((a, b) => b.gpi - a.gpi).map((g) => (
          <div className="pl clickable" key={g.name} onClick={() => openPlayer(g.name)}>
            <div className="num gk">{g.number}</div>
            <div className="n">{g.name}<small>{g.gpi} matcher · {g.svs} räddningar · {g.so} nollor</small></div>
            <div className="pts">{g.svsPct.toFixed(1)}%<small>{g.gaa.toFixed(2)}</small></div>
          </div>
        )) : <Empty>Ingen målvaktsstatistik ännu.</Empty>}
      </Card>
      <Card title="Seriens poängliga" right={<span>{team.league}</span>}>
        <table className="tbl">
          <thead><tr><th>#</th><th className="l">Spelare</th><th>Lag</th><th>M</th><th>A</th><th>P</th></tr></thead>
          <tbody>
            {team.leagueLeaders.slice(0, 10).map((p) => (
              <tr key={p.name + p.abbr} className={p.abbr === ourAbbr ? 'me' : ''}>
                <td>{p.rank}</td><td className="l">{p.name}</td><td>{p.abbr}</td><td>{p.g}</td><td>{p.a}</td><td><b>{p.tp}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Source />
    </>
  );
}

/* ---------------- Truppen ---------------- */
export function Squad() {
  const { team, openPlayer } = useApp();
  if (!team) return null;
  const groups: [string, (p: string) => boolean][] = [
    ['Målvakter', (p) => p === 'GK'],
    ['Backar', (p) => /D$/.test(p)],
    ['Forwards', (p) => !/^GK$|D$/.test(p)],
  ];
  const pts = (n: string) => team.skaters.find((s) => s.name === n);
  return (
    <>
      {groups.map(([title, f]) => {
        const ps = team.roster.filter((p) => f(p.pos)).sort((a, b) => +a.number - +b.number);
        if (!ps.length) return null;
        return (
          <div key={title}>
            <h3 className="group">{title} <span>{ps.length}</span></h3>
            <div className="roster">
              {ps.map((p) => {
                const s = pts(p.name);
                return (
                  <button className="pc" key={p.name + p.number} onClick={() => openPlayer(p.name)}>
                    <div className="av">{p.number}</div>
                    <b>{p.name}</b>
                    <span>{positionName(p.pos)}</span>
                    {s && p.pos !== 'GK' && <span className="mini">{s.g}+{s.a} = {s.tp} p</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <Source />
    </>
  );
}

/* ---------------- Nyheter ---------------- */
export function News() {
  return (
    <>
      <NewsList />
      <SocialCard />
    </>
  );
}

/* ---------------- Ungdom (inga resultat/namn enligt policyn) ---------------- */
export function Youth() {
  const { club } = useApp();
  return (
    <>
      <Card className="next" title="Ungdomsverksamheten">
        <p className="lead">Hos HC Wettern spelar barn och ungdomar från hockeyskolan och uppåt. Glädje, gemenskap och utveckling går före resultat.</p>
        <div className="btns">
          <a className="btn primary" href={club.website} target="_blank" rel="noreferrer">Börja spela hockey</a>
          <a className="btn ghost" href={club.social.instagramYouth} target="_blank" rel="noreferrer"><Icon name="insta" size={16} /> @hcw_ungdom</a>
        </div>
      </Card>
      <div className="policy"><b>Om ungdomslagen i appen</b><br />{club.youthPolicy.text}</div>
      <NewsList n={5} />
    </>
  );
}

function Source() {
  const { team } = useApp();
  if (!team) return null;
  return (
    <p className="source">
      Källa: stats.swehockey.se{team.sourceUpdatedAt ? ` · uppdaterad ${team.sourceUpdatedAt}` : ''} · hämtad {ago(team.updatedAt)}
    </p>
  );
}
