// Datamodell som delas mellan insamlaren (scraper) och appen.
// Insamlaren skriver JSON-filer i public/data/ som appen läser.

export interface TeamMeta {
  key: string;
  name: string;
  league: string;
  seriesId: number;
}

export interface ClubData {
  name: string;
  short: string;
  town: string;
  homeArena: string;
  website: string;
  social: { facebook: string; instagramYouth: string };
  youthPolicy: { hideAtOrBelowAge: number; text: string };
  teams: TeamMeta[];
  /** Adress till push-/live-API:t (Cloudflare Worker), t.ex. https://hcwettern-api.xxx.workers.dev */
  api?: string;
  /** Lagnamn → klubbmärke (relativ sökväg, t.ex. "logos/eksjo-hc.png") */
  logos?: Record<string, string>;
  updatedAt: string;
}

export type NotifyKind = 'start' | 'goal' | 'final';
export interface PushPrefs {
  start: boolean;
  goal: boolean;
  final: boolean;
}
export interface PushMessage {
  kind: NotifyKind;
  title: string;
  body: string;
  tag: string;
  url: string;
}

export interface StandingRow {
  rank: number;
  team: string;
  abbr: string;
  gp: number;
  w: number;
  t: number;
  l: number;
  otw: number;
  otl: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: ('W' | 'L' | 'O')[];
}

export type GameStatus = 'scheduled' | 'live' | 'final';

export interface Game {
  scheduleId: string;
  gameId?: string;
  round?: number;
  date: string; // "2026-11-20T19:00"
  home: string;
  away: string;
  venue: string;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  periods?: string; // "3-2, 2-1, 1-3, 1-0"
  overtime?: boolean;
  spectators?: number;
}

export interface RosterPlayer {
  number: string;
  name: string; // "Förnamn Efternamn"
  pos: string; // GK, LD, RD, CE, LW, RW
  shoots: string;
  height?: number;
  weight?: number;
  youthClub?: string;
}

export interface SkaterStat {
  number: string;
  name: string;
  pos: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
  pim: number;
  ppg: number;
  gwg: number;
}

export interface GoalieStat {
  number: string;
  name: string;
  gpi: number;
  ga: number;
  svs: number;
  sog: number;
  svsPct: number;
  gaa: number;
  so: number;
}

export interface LeagueLeader {
  rank: number;
  number: string;
  name: string;
  abbr: string;
  team: string;
  pos: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
}

export interface TeamData {
  key: string;
  name: string;
  league: string;
  seriesId: number;
  updatedAt: string;
  sourceUpdatedAt?: string;
  standings: StandingRow[];
  games: Game[]; // hela serien
  roster: RosterPlayer[];
  skaters: SkaterStat[];
  goalies: GoalieStat[];
  leagueLeaders: LeagueLeader[];
  abbreviations: Record<string, string>;
}

export interface GameEvent {
  period: string;
  time: string;
  type: 'goal' | 'penalty' | 'timeout' | 'goalie' | 'other';
  team: string; // förkortning, t.ex. WET
  player?: string;
  assists?: string[];
  score?: string; // "7-6"
  strength?: string; // EQ, PP1, SH1 ...
  detail?: string; // utvisningsorsak m.m.
}

export interface GameDetail {
  gameId: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
  date: string;
  venue: string;
  status: GameStatus;
  statusText: string;
  homeScore: number;
  awayScore: number;
  periods: string;
  shots: [number, number];
  pim: [number, number];
  spectators?: number;
  events: GameEvent[]; // kronologisk ordning
  updatedAt: string;
}

export interface LiveData {
  game: GameDetail | null;
  updatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  date: string;
  summary: string;
  image?: string;
}
