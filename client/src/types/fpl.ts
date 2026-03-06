export interface BootstrapStatic {
  events: FplEvent[];
  elements: FplElement[];
  teams: FplTeam[];
}

export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  /** Element id of the most captained player in this gameweek (from bootstrap-static). */
  most_captained?: number;
}

export interface FplElement {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
  /** Player photo filename e.g. "154561.jpg" - use code for URL: p{code}.png */
  photo?: string;
  /** Used for player image URL: .../p{code}.png */
  code?: number;
  /** Full name parts from FPL API – used for third-party photo lookup (e.g. TheSportsDB). */
  first_name?: string;
  second_name?: string;
  /** Injury/suspension/other news from FPL. */
  news?: string;
  news_added?: string | null;
  /** Chance of playing next round: 0, 25, 50, 75, 100. */
  chance_of_playing_next_round?: number | null;
  chance_of_playing_this_round?: number | null;
  /** Status: a=available, d=doubtful, i=injured, s=suspended, u=unknown. */
  status?: string;
  /** Transfers in for the current/latest gameweek (bootstrap-static). */
  transfers_in_event?: number;
  /** Transfers out for the current/latest gameweek (bootstrap-static). */
  transfers_out_event?: number;
  /** Current price in tenths (e.g. 60 = 6.0). */
  now_cost?: number;
  /** Percentage of managers who own the player (e.g. "34.2"). */
  selected_by_percent?: string;
  /** Form value (e.g. "3.2"). */
  form?: string;
  /** Rank by selection (1 = most selected). */
  selected_rank?: number;
  /** Total FPL points this season. */
  total_points?: number;
}

export interface FplTeam {
  id: number;
  name: string;
}

/** One gameweek of history from element-summary (player's points in that GW). */
export interface ElementHistoryEntry {
  round: number;
  total_points: number;
  opponent_team?: number;
  was_home?: boolean;
}

/** One upcoming fixture from element-summary (for a player's team). */
export interface ElementFixture {
  id: number;
  event: number;
  event_name: string;
  kickoff_time: string;
  team_h: number;
  team_a: number;
  is_home: boolean;
  difficulty: number;
  finished?: boolean;
}

export interface ElementSummaryResponse {
  history: ElementHistoryEntry[];
  fixtures: ElementFixture[];
}

/** Single fixture from FPL API (fixtures endpoint, optional ?event=GW). */
export interface FplFixture {
  id: number;
  event: number;
  kickoff_time: string;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  finished: boolean;
  team_h_difficulty?: number;
  team_a_difficulty?: number;
}

export interface EntryResponse {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_event_points: number;
  current_event: number;
  leagues: {
    classic: ClassicLeague[];
    h2h: unknown[];
    cup: unknown;
  };
}

export interface ClassicLeague {
  id: number;
  name: string;
  short_name: string;
  entry_rank: number | null;
  entry_last_rank: number | null;
  rank_count: number | null;
}

export interface PicksResponse {
  picks: Pick[];
  chips?: { name: string }[];
  /** Set when a chip is active this GW (e.g. "bboost", "3xc"). */
  active_chip?: string | null;
}

export interface Pick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface EventLiveResponse {
  /** API may use "id" or "element" for player element id */
  elements: { id?: number; element?: number; stats: LiveStats }[];
}

export interface LiveStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  total_points: number;
}

export interface EntryHistoryResponse {
  /** Per-gameweek data; points = official GW score (includes chip, after transfer deduction). value = team value * 10. */
  current: {
    event: number;
    points: number;
    value?: number;
    /** Points deducted for extra transfers (e.g. -4 per hit). Already reflected in points. */
    event_transfers_cost?: number;
  }[];
}

export interface LeagueStandingsResponse {
  league: { id: number; name: string };
  standings: {
    results: StandingEntry[];
    has_next: boolean;
  };
}

export interface StandingEntry {
  id: number;
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  event_total: number;
  movement: string;
  /** Chip used this GW (from standings-with-chips endpoint). */
  chip?: string | null;
}

/** Result from search-by-league (StandingEntry + league info). */
export interface SearchByLeagueResult extends StandingEntry {
  league_id: number;
  league_name: string;
}

export interface PlayerPoints {
  element_id: number;
  web_name: string;
  team_name: string;
  position: number;
  element_type: number; // 1=GKP, 2=DEF, 3=MID, 4=FWD
  is_captain: boolean;
  is_vice_captain: boolean;
  is_on_bench: boolean;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  total_points_raw: number;
  multiplier: number;
  total_points_effective: number;
  /** True when this player was on the bench and auto-substituted into the starting XI. */
  is_substitute?: boolean;
}

export interface TeamPointsSummary {
  team_id: number;
  team_name: string | null;
  gameweek: number;
  chip: string | null;
  total_points: number;
  starting_points: number;
  bench_points: number;
  players: PlayerPoints[];
  /** Starting XI with auto-subs applied (subs appear in the slot they replaced). Use for pitch display. */
  effectivePitchPlayers: PlayerPoints[];
  /** Bench players not used as substitutes. Use for bench display under pitch. */
  effectiveBench: PlayerPoints[];
  /** Starters who did not play and were replaced by a sub; show their cards on the bench. */
  replacedStarters: PlayerPoints[];
}

export type LeagueSortBy = 'event_total' | 'total' | 'monthly' | 'team_value';
