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
  /** Price change this gameweek in tenths (e.g. 1 = +£0.1m, -1 = -£0.1m). */
  cost_change_event?: number;
  /** Price change since the start of the season in tenths. */
  cost_change_start?: number;
  /** Minutes played this season. */
  minutes?: number;
  goals_scored?: number;
  assists?: number;
  /** Season expected stats; FPL sends these as strings, e.g. "5.69". */
  expected_goals?: string;
  expected_assists?: string;
  expected_goal_involvements?: string;
  expected_goals_per_90?: number;
  expected_assists_per_90?: number;
  expected_goal_involvements_per_90?: number;
  /** Defensive contribution count (tackles + clearances/blocks/interceptions, + recoveries for MID/FWD). */
  defensive_contribution?: number;
  defensive_contribution_per_90?: number;
  tackles?: number;
  clearances_blocks_interceptions?: number;
  recoveries?: number;
}

export interface FplTeam {
  id: number;
  name: string;
  short_name?: string;
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
  /** True once the final whistle has gone (before bonus is confirmed and `finished` flips). */
  finished_provisional?: boolean;
  /** True once the match has kicked off. */
  started?: boolean;
  /** Minutes played so far (live) or 90 when finished. */
  minutes?: number;
  /** Per-player match stats: goals, assists, bps, bonus (filled in once awarded), defensive_contribution… */
  stats?: FixtureStat[];
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
  elements: { id?: number; element?: number; stats: LiveStats; explain?: LiveExplain[] }[];
}

export interface LiveStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  bonus: number;
  total_points: number;
  bps?: number;
  /** Defensive contribution count (tackles + clearances/blocks/interceptions, + recoveries for MID/FWD). */
  defensive_contribution?: number;
  yellow_cards?: number;
  red_cards?: number;
}

/** Points breakdown for one fixture (a player has two in a double gameweek). */
export interface LiveExplain {
  fixture: number;
  stats: { identifier: string; points: number; value: number }[];
}

/** One per-fixture stat list, e.g. identifier "bps" with each player's value for the home (h) and away (a) side. */
export interface FixtureStat {
  identifier: string;
  h: { element: number; value: number }[];
  a: { element: number; value: number }[];
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
  /** Captain's element id this GW (standings-with-chips). */
  captain?: number | null;
  /** Team value × 10 at this GW (standings-with-chips). */
  value?: number | null;
  /** Players who count (XI after auto-subs, 15 with Bench Boost) whose match hasn't kicked off yet (standings-with-chips). */
  to_start?: number | null;
  /** [gameweek, points] for every played GW (standings-with-chips); used for the Monthly sort. */
  history?: [number, number][];
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
  /** Bonus not yet awarded but projected from live BPS (already included in total_points_raw). */
  projected_bonus?: number;
  /** Defensive contribution count so far this gameweek. */
  defensive_contribution?: number;
  yellow_cards?: number;
  red_cards?: number;
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

/** A player with an FPL availability update (from /api/fpl-news). */
export interface FplNewsPlayer {
  id: number;
  web_name: string;
  first_name?: string;
  second_name?: string;
  code?: number;
  team: number;
  element_type: number;
  /** a=available, d=doubtful, i=injured, s=suspended, u=unavailable, n=not eligible. */
  status: string;
  chance_of_playing_next_round: number | null;
  news_en: string;
  news_added: string | null;
  selected_by_percent?: string;
}

export interface FplNewsResponse {
  updated_at: string | null;
  players: FplNewsPlayer[];
}

export type LeagueSortBy = 'event_total' | 'total' | 'monthly' | 'team_value';

/** One saved Squad Planner pick (same shape as an FPL pick, plus the price the player was bought at). */
export interface SquadPick {
  element: number;
  /** 1–11 starting XI, 12 bench goalkeeper, 13–15 bench order. */
  position: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  /** Price in tenths when the player joined this squad (kept until they're removed). */
  purchase_price: number;
}

/** A squad as saved before one deadline; it scores from `gw` until a later version replaces it. */
export interface SquadVersion {
  gw: number;
  saved_at: string;
  picks: SquadPick[];
}

export interface SavedSquad {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  /** First gameweek this squad scores in. */
  start_gw: number | null;
  versions: SquadVersion[];
}

/** /api/player-tracker: what FPL doesn't timestamp, recorded by the server since `tracking_since`. */
export interface PlayerTrackerResponse {
  checked_at: string | null;
  tracking_since: string | null;
  /** element id → when its price last changed this gameweek. */
  price_changed_at: Record<string, string>;
  /** Hours covered by transfers_recent (up to 24; less right after tracking starts or a deadline). */
  transfers_window_hours: number;
  /** element id → [transfers in, transfers out] over that window. */
  transfers_recent: Record<string, [number, number]>;
}

/** One player as scored by the transfer-suggestions algorithm (server/transfer-suggestions.js). */
export interface SuggestionPlayer {
  id: number;
  name: string;
  teamId: number;
  team: string;
  position: 'GKP' | 'DEF' | 'MID' | 'FWD';
  price: number;
  status: string;
  /** Chance of playing (0–100) when below 100, else null. */
  chance: number | null;
  news: string | null;
  last5: { gw: number; points: number }[];
  minutes5: number;
  formPpm: number;
  avgFdr: number | null;
  fixtures: { gw: number; opponent: string; home: boolean; fdr: number }[];
  /** Expected points over the planning horizon. */
  projected: number;
}

export interface TransferSuggestion {
  out: SuggestionPlayer & { reasons: string[] };
  in: SuggestionPlayer | null;
  gain: number;
  label: 'free' | 'hit' | 'keep';
  worthHit?: boolean;
}

export interface TransferSuggestionsResponse {
  teamId: number;
  gameweek: number;
  horizon: number[];
  formGws: number[];
  freeTransfers: number;
  maxFreeTransfers: number;
  pendingTransfers: number;
  bank: number;
  squad: { id: number; name: string; team: string; position: string; projected: number }[];
  suggestions: TransferSuggestion[];
  generatedAt: string;
}
