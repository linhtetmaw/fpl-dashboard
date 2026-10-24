const API_BASE = '/api';

async function fetchApi<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getBootstrapStatic() {
  return fetchApi<import('../types/fpl').BootstrapStatic>(`${API_BASE}/bootstrap-static/`);
}

export async function getEntry(teamId: number) {
  return fetchApi<import('../types/fpl').EntryResponse>(`${API_BASE}/entry/${teamId}/`);
}

export async function getTeamPicks(teamId: number, gameweek: number) {
  return fetchApi<import('../types/fpl').PicksResponse>(
    `${API_BASE}/entry/${teamId}/event/${gameweek}/picks/`
  );
}

export async function getEventLive(gameweek: number) {
  return fetchApi<import('../types/fpl').EventLiveResponse>(`${API_BASE}/event/${gameweek}/live/`);
}

/** Fixtures for a gameweek (or all if gameweek not provided). */
export async function getFixtures(gameweek?: number) {
  const params = gameweek != null ? { event: gameweek } : undefined;
  return fetchApi<import('../types/fpl').FplFixture[]>(`${API_BASE}/fixtures/`, params);
}

export async function getTransferSuggestions(teamId: number) {
  return fetchApi<import('../types/fpl').TransferSuggestionsResponse>(`${API_BASE}/transfer-suggestions/${teamId}`);
}

export async function getEntryHistory(teamId: number) {
  return fetchApi<import('../types/fpl').EntryHistoryResponse>(
    `${API_BASE}/entry/${teamId}/history/`
  );
}

/** Player's gameweek history and upcoming fixtures (for detail card). */
export async function getElementSummary(elementId: number) {
  return fetchApi<import('../types/fpl').ElementSummaryResponse>(
    `${API_BASE}/element-summary/${elementId}/`
  );
}

export async function getLeagueStandings(leagueId: number, page = 1) {
  return fetchApi<import('../types/fpl').LeagueStandingsResponse>(
    `${API_BASE}/leagues-classic/${leagueId}/standings/`,
    { page_standings: page }
  );
}

/** League standings with chip badge per team for the given gameweek. */
export async function getLeagueStandingsWithChips(
  leagueId: number,
  page: number,
  gameweek: number
) {
  return fetchApi<import('../types/fpl').LeagueStandingsResponse>(
    `${API_BASE}/leagues-classic/${leagueId}/standings-with-chips`,
    { page_standings: page, gw: gameweek }
  );
}

export async function getFplNews() {
  return fetchApi<import('../types/fpl').FplNewsResponse>(`${API_BASE}/fpl-news`);
}

async function sendJson<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export interface TelegramUser {
  id: number;
  name: string;
  username: string | null;
}

/** Logged-in user (null if logged out) and the Telegram bot used for the login button (null if not set up). */
export async function getMe() {
  return fetchApi<{ user: TelegramUser | null; telegram_bot: string | null }>(`${API_BASE}/auth/me`);
}

/** Send the data from Telegram's login widget to the server, which verifies it and sets a session cookie. */
export async function loginWithTelegram(data: Record<string, string | number>) {
  return sendJson<{ user: TelegramUser }>('POST', `${API_BASE}/auth/telegram`, data);
}

export async function logout() {
  return sendJson<{ ok: boolean }>('POST', `${API_BASE}/auth/logout`);
}

type SquadPayload = { name: string; picks: Omit<import('../types/fpl').SquadPick, 'purchase_price'>[] };

export async function listSquads() {
  return fetchApi<{ squads: import('../types/fpl').SavedSquad[]; max: number }>(`${API_BASE}/squads`);
}

export async function createSquad(payload: SquadPayload) {
  return sendJson<import('../types/fpl').SavedSquad>('POST', `${API_BASE}/squads`, payload);
}

export async function updateSquad(id: string, payload: SquadPayload) {
  return sendJson<import('../types/fpl').SavedSquad>('PUT', `${API_BASE}/squads/${encodeURIComponent(id)}`, payload);
}

export async function deleteSquad(id: string) {
  return sendJson<{ ok: boolean }>('DELETE', `${API_BASE}/squads/${encodeURIComponent(id)}`);
}

export async function getPlayerTracker() {
  return fetchApi<import('../types/fpl').PlayerTrackerResponse>(`${API_BASE}/player-tracker`);
}

export async function getYoutubePlaylistItems(playlistId: string) {
  return fetchApi<{ playlistId: string; items: { videoId: string; title: string; published?: string; thumbnail?: string }[] }>(
    `${API_BASE}/youtube-playlist`,
    { playlistId }
  );
}

/** Search by team name (and optional manager) via server-side index. */
export async function searchTeams(teamName: string, managerName?: string): Promise<import('../types/fpl').StandingEntry[]> {
  const params: Record<string, string> = { team: teamName.trim() };
  if (managerName?.trim()) params.manager = managerName.trim();
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/search?${query}`);
  if (!res.ok) throw new Error('Search failed');
  const data = (await res.json()) as { results: import('../types/fpl').StandingEntry[]; count: number };
  return data.results ?? [];
}

/** Search by League (name or ID) + Team name + Manager name (optional). League ID works even if the league was never viewed. */
export async function searchByLeagueAndTeam(
  teamName: string,
  options?: { leagueName?: string; leagueId?: number; managerName?: string }
): Promise<import('../types/fpl').SearchByLeagueResult[]> {
  const params: Record<string, string> = { team: teamName.trim() };
  if (options?.leagueName?.trim()) params.league = options.leagueName.trim();
  if (options?.leagueId != null && options.leagueId > 0) params.league_id = String(options.leagueId);
  if (options?.managerName?.trim()) params.manager = options.managerName.trim();
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/search-by-league?${query}`);
  if (!res.ok) throw new Error('Search failed');
  const data = (await res.json()) as {
    results: import('../types/fpl').SearchByLeagueResult[];
    count: number;
  };
  return data.results ?? [];
}
