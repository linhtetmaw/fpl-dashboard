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

export async function getEntryHistory(teamId: number) {
  return fetchApi<import('../types/fpl').EntryHistoryResponse>(
    `${API_BASE}/entry/${teamId}/history/`
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

/** Fetch standings pages in parallel (batchSize at a time) up to maxPages. Stops when a page has has_next false. */
export async function getLeagueStandingsAllPages(
  leagueId: number,
  maxPages = 100,
  batchSize = 10
): Promise<import('../types/fpl').StandingEntry[]> {
  const results: import('../types/fpl').StandingEntry[] = [];
  let page = 1;
  while (page <= maxPages) {
    const batch = Array.from({ length: batchSize }, (_, i) => page + i).filter((p) => p <= maxPages);
    if (batch.length === 0) break;
    const pages = await Promise.all(
      batch.map((p) => getLeagueStandings(leagueId, p))
    );
    let hasNext = false;
    for (let i = 0; i < pages.length; i++) {
      const data = pages[i];
      const entries = data.standings?.results ?? [];
      results.push(...entries);
      if (data.standings?.has_next) hasNext = true;
    }
    if (!hasNext) break;
    page += batch.length;
  }
  return results;
}
