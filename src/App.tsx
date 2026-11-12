import { useCallback, useEffect, useState } from 'react';
import type { ClubData, GameDetail, NewsItem, TeamData } from '../shared/types';
import { ourGames } from './components/cards';
import { NotifySheet } from './components/notify';
import { GameSheet, PlayerSheet } from './components/sheets';
import { Crest, Ctx, Icon, type Tab } from './components/ui';
import { useGoalWatcher, useJson, useLive, useMedia } from './data';
import { useTheme } from './theme';
import { Dashboard, Games, Home, News, Squad, Stats, Table, Youth } from './views/views';

const YOUTH = 'youth';
const NAV: [Tab, string][] = [
  ['home', 'Hem'],
  ['games', 'Matcher'],
  ['table', 'Tabell'],
  ['stats', 'Statistik'],
  ['squad', 'Truppen'],
];

const readHash = () => {
  const [t, k] = location.hash.replace('#', '').split('/');
  return { tab: (NAV.some(([n]) => n === t) || t === 'news' ? t : 'home') as Tab, key: k || '' };
};

export default function App() {
  const club = useJson<ClubData>('club.json', 3_600_000);
  const news = useJson<NewsItem[]>('news.json') ?? [];
  const [{ tab, key }, setNav] = useState(readHash);
  const teamKey = key || club?.teams[0]?.key || '';
  const team = useJson<TeamData>(teamKey && teamKey !== YOUTH ? `teams/${teamKey}.json` : null);
  // ?game=<id> öppnar matchrapporten direkt (används av notiserna)
  const [game, setGame] = useState<string | null>(() => new URLSearchParams(location.search).get('game'));
  // ?notiser öppnar notisinställningarna direkt – bra länk att dela på Facebook
  const [notify, setNotify] = useState(() => new URLSearchParams(location.search).has('notiser'));
  const [player, setPlayer] = useState<string | null>(null);
  const [toast, setToast] = useState<{ t: string; s: string } | null>(null);
  const theme = useTheme();
  const wide = useMedia('(min-width: 900px)');

  const lastGameId = club && team ? ourGames(team.games, club.name).results[0]?.gameId : undefined;
  const live = useLive(lastGameId, club?.api);

  useEffect(() => {
    const fn = () => setNav(readHash());
    addEventListener('hashchange', fn);
    return () => removeEventListener('hashchange', fn);
  }, []);
  const go = useCallback((t: Tab, k = teamKey) => {
    location.hash = `${t}/${k}`;
    window.scrollTo({ top: 0 });
  }, [teamKey]);

  const onGoal = useCallback((g: GameDetail) => {
    const last = [...g.events].reverse().find((e) => e.type === 'goal');
    const ours = last && (last.team === (g.home === club?.name ? g.homeAbbr : g.awayAbbr));
    setToast({
      t: `${ours ? 'MÅL! ' : 'Mål '}${g.home} ${g.homeScore}–${g.awayScore} ${g.away}`,
      s: last ? `${(last.player ?? '').replace(/^\d+\.\s*(.+?),\s*(.+?)(\s*\(\d+\))?$/, '$2 $1')} · ${last.period} ${last.time}` : '',
    });
    navigator.vibrate?.(200);
  }, [club?.name]);
  useGoalWatcher(live, onGoal);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  if (!club) return <div className="boot"><Crest size={64} /><p>Laddar…</p></div>;

  const youth = teamKey === YOUTH;
  const meta = club.teams.find((t) => t.key === teamKey);
  const chips = [...club.teams.map((t) => ({ key: t.key, name: t.name })), { key: YOUTH, name: 'Ungdom' }];
  const ctx = { club, team: youth ? null : team, news, live: youth ? null : live, openGame: setGame, openPlayer: setPlayer, go: (t: Tab) => go(t) };

  const view = youth ? <Youth /> : !team ? <p className="empty">Laddar lagets data…</p> : {
    home: wide ? <Dashboard /> : <Home />,
    games: <Games />,
    table: <Table />,
    stats: <Stats />,
    squad: <Squad />,
    news: <News />,
  }[tab];

  const themeIcon = theme.choice === 'dark' ? 'moon' : theme.choice === 'light' ? 'sun' : 'auto';
  const themeLabel = theme.choice === 'dark' ? 'Mörkt tema' : theme.choice === 'light' ? 'Ljust tema' : 'Tema: följ enheten';
  const ThemeBtn = (
    <button className="iconbtn" onClick={theme.cycle} title={themeLabel} aria-label={themeLabel}>
      <Icon name={themeIcon} size={18} />
    </button>
  );
  const BellBtn = (
    <button className="iconbtn" onClick={() => setNotify(true)} title="Notiser" aria-label="Notiser">
      <Icon name="bell" size={18} />
    </button>
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className={`app ${wide ? 'wide' : 'narrow'}`}>
        {wide ? (
          <aside className="side">
            <div className="brand"><Crest size={40} /><div><b>{club.name}</b><small>{youth ? 'Ungdom' : meta?.league}</small></div></div>
            {[...NAV, ['news', 'Nyheter'] as [Tab, string]].map(([t, l]) => (
              <button key={t} className={`sl ${tab === t && !youth ? 'on' : ''}`} onClick={() => go(t, youth ? club.teams[0].key : teamKey)}>
                <Icon name={t} size={18} /> {t === 'home' ? 'Matchcenter' : l}
              </button>
            ))}
            <h6>Lag</h6>
            {chips.map((c) => (
              <button key={c.key} className={`tchip ${c.key === teamKey ? 'on' : ''}`} onClick={() => go(c.key === YOUTH ? 'home' : tab, c.key)}>{c.name}</button>
            ))}
            <button className="sl" onClick={() => setNotify(true)}><Icon name="bell" size={18} /> Notiser</button>
            <div className="side-foot">{ThemeBtn}<span>{themeLabel}</span></div>
          </aside>
        ) : (
          <header className="hdr">
            <div className="hdr-row">
              <Crest size={34} />
              <div className="hdr-t"><h1>{club.name}</h1><small>{youth ? 'Ungdomsverksamheten' : `${meta?.name} · ${meta?.league}`}</small></div>
              {BellBtn}
              {ThemeBtn}
            </div>
            <nav className="chips">
              {chips.map((c) => (
                <button key={c.key} className={`chip ${c.key === teamKey ? 'on' : ''}`} onClick={() => go(c.key === YOUTH ? 'home' : tab, c.key)}>{c.name}</button>
              ))}
            </nav>
          </header>
        )}

        <main className="content">{view}</main>

        {!wide && !youth && (
          <nav className="nav">
            {NAV.map(([t, l]) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
                <Icon name={t} />
                {l}
              </button>
            ))}
          </nav>
        )}
        {!wide && youth && (
          <nav className="nav">
            <button onClick={() => go('home', club.teams[0].key)}><Icon name="home" />Till A-laget</button>
          </nav>
        )}

        <div className={`toast ${toast ? 'show' : ''}`} role="status" onClick={() => live && setGame(live.gameId)}>
          <Crest size={28} />
          <div><b>{toast?.t}</b><span>{toast?.s}</span></div>
        </div>
        {game && <GameSheet gameId={game} onClose={() => (setGame(null), history.replaceState(null, '', location.pathname + location.hash))} />}
        {notify && <NotifySheet onClose={() => setNotify(false)} />}
        {player && <PlayerSheet name={player} onClose={() => setPlayer(null)} />}
      </div>
    </Ctx.Provider>
  );
}
