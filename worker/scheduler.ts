// Tidsstyrning från Cloudflare i stället för GitHubs schemaläggning.
// GitHubs cron är opålitlig (körningar startar sent eller inte alls), Cloudflares cron går på minuten.
//
// Var 5:e minut: om A-laget spelar nu eller börjar inom 60 minuter och ingen matchbevakning
// körs, startas live.yml i GitHub Actions. Varje timme 06–23 startas update.yml (tabell, statistik, nyheter).
//
// Kräver hemligheten GITHUB_TOKEN: en fine-grained token som bara gäller repot och har
// behörigheten "Actions: Read and write". Utan den gör schemaläggaren ingenting.

export interface SchedulerEnv {
  GITHUB_TOKEN?: string;
  GITHUB_REPO: string; // t.ex. "asajakt/hcwettern-app"
  APP_URL: string; // appens adress, där data/*.json ligger
}

interface Game {
  scheduleId: string;
  date: string; // "YYYY-MM-DDTHH:mm" svensk tid
  home: string;
  away: string;
  status: string;
}

const BEFORE_MIN = 60;
const AFTER_MIN = 180;

/** Svensk lokal tid som "YYYY-MM-DDTHH:mm". */
const nowLocal = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }).replace(' ', 'T').slice(0, 16);
const minutesBetween = (a: string, b: string) => (new Date(`${b}:00Z`).getTime() - new Date(`${a}:00Z`).getTime()) / 60_000;

async function gh(env: SchedulerEnv, path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'hcwettern-api',
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
}

const dispatch = (env: SchedulerEnv, workflow: string) =>
  gh(env, `/actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) });

/** Pågående match för klubbens lag, eller en som börjar inom BEFORE_MIN minuter. */
export async function upcomingGame(env: SchedulerEnv, now = nowLocal()): Promise<Game | null> {
  const base = env.APP_URL.replace(/\/?$/, '/');
  const club = (await (await fetch(`${base}data/club.json`, { cf: { cacheTtl: 300 } })).json()) as { name: string; teams: { key: string }[] };
  // Bara första laget (A-laget) för att hålla antalet anrop nere
  const team = club.teams[0];
  if (!team) return null;
  const data = (await (await fetch(`${base}data/teams/${team.key}.json`, { cf: { cacheTtl: 300 } })).json()) as { games: Game[] };
  return (
    data.games.find((g) => {
      if (g.home !== club.name && g.away !== club.name) return false;
      if (g.status === 'final') return false;
      const m = minutesBetween(now, g.date);
      return m <= BEFORE_MIN && m >= -AFTER_MIN;
    }) ?? null
  );
}

async function watchRunning(env: SchedulerEnv) {
  for (const status of ['in_progress', 'queued']) {
    const r = await gh(env, `/actions/workflows/live.yml/runs?status=${status}&per_page=1`);
    if (!r.ok) throw new Error(`GitHub svarade ${r.status} på listning av körningar`);
    const { total_count } = (await r.json()) as { total_count: number };
    if (total_count > 0) return true;
  }
  return false;
}

export async function scheduled(cron: string, env: SchedulerEnv) {
  if (!env.GITHUB_TOKEN) {
    console.log('GITHUB_TOKEN saknas – schemaläggaren gör ingenting');
    return;
  }
  if (cron === '7 * * * *') {
    const hour = Number(nowLocal().slice(11, 13));
    if (hour >= 6 && hour <= 23) {
      const r = await dispatch(env, 'update.yml');
      console.log(`update.yml: ${r.status}`);
    }
    return;
  }

  const game = await upcomingGame(env);
  if (!game) return;
  if (await watchRunning(env)) return;
  const r = await dispatch(env, 'live.yml');
  console.log(`Startar matchbevakning för ${game.home}–${game.away} ${game.date}: ${r.status}`);
}
