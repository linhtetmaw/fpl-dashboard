/**
 * Algorithmic transfer suggestions (no AI): rank a team's players by recent form and upcoming fixtures, then
 * find the best affordable replacements for the weakest three.
 *
 * Every player gets one number, `projected`: expected FPL points over the next HORIZON gameweeks.
 *   base      = 70% weighted points-per-match over the last FORM_GWS finished gameweeks + 30% season points-per-game
 *   fixtures  = sum over the next HORIZON gameweeks of FDR_MULT[difficulty] (a double gameweek counts twice, a blank 0)
 *   available = chance of playing (injured / suspended / left the club = 0)
 *   projected = base × fixtures × available
 *
 * Prices are current FPL prices (not the manager's selling prices), so the budget is approximate.
 */
import { fplGet, memo } from './fpl-api.js';

const FORM_GWS = 5;
const HORIZON = 5;
/** Most recent finished gameweek first. */
const FORM_WEIGHTS = [0.3, 0.25, 0.2, 0.15, 0.1];
const FDR_MULT = { 1: 1.25, 2: 1.12, 3: 1.0, 4: 0.85, 5: 0.7 };
const SUGGESTIONS = 3;
/** Replacement candidates considered per position (after filtering by price and availability). */
const CANDIDATES_PER_POSITION = 15;
/** A transfer must gain at least this many projected points to be worth suggesting. */
const MIN_GAIN = 1;
const HIT_COST = 4;
const POSITIONS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

export class SuggestionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const round1 = (n) => Math.round(n * 10) / 10;

function availability(el) {
  if (el.chance_of_playing_next_round != null) return el.chance_of_playing_next_round / 100;
  return el.status === 'a' ? 1 : 0;
}

/**
 * Scores for every player for the upcoming gameweek. Shared by all teams, so it is computed once per gameweek
 * (refreshed every 10 minutes for injury news and price changes).
 */
async function buildPlayerScores() {
  const [bootstrap, fixtures] = await Promise.all([fplGet('/bootstrap-static/'), fplGet('/fixtures/')]);
  const events = bootstrap.events ?? [];
  const nextEvent = events.find((e) => e.is_next);
  if (!nextEvent) throw new SuggestionError(409, 'There is no upcoming gameweek to plan transfers for.');
  const nextGw = nextEvent.id;
  const horizon = events.filter((e) => e.id >= nextGw).slice(0, HORIZON).map((e) => e.id);
  const formGws = events.filter((e) => e.finished).slice(-FORM_GWS).map((e) => e.id).reverse();

  const lives = await Promise.all(formGws.map((gw) => fplGet(`/event/${gw}/live/`)));
  const liveByGw = formGws.map((gw, i) => {
    const map = new Map();
    for (const el of lives[i]?.elements ?? []) map.set(el.id, el.stats);
    return { gw, map };
  });

  // How many matches each club played (form) / will play (horizon) per gameweek, with difficulty.
  const matchesPlayed = new Map(); // `${team}-${gw}` -> count
  const upcoming = new Map(); // team -> [{ gw, opponent, home, fdr }]
  for (const f of fixtures) {
    if (f.event == null) continue;
    for (const [team, opponent, home, fdr] of [
      [f.team_h, f.team_a, true, f.team_h_difficulty],
      [f.team_a, f.team_h, false, f.team_a_difficulty],
    ]) {
      if (formGws.includes(f.event)) matchesPlayed.set(`${team}-${f.event}`, (matchesPlayed.get(`${team}-${f.event}`) ?? 0) + 1);
      if (horizon.includes(f.event)) {
        if (!upcoming.has(team)) upcoming.set(team, []);
        upcoming.get(team).push({ gw: f.event, opponent, home, fdr, kickoff: f.kickoff_time });
      }
    }
  }
  for (const list of upcoming.values()) list.sort((a, b) => a.gw - b.gw || String(a.kickoff).localeCompare(String(b.kickoff)));

  const teamShort = new Map((bootstrap.teams ?? []).map((t) => [t.id, t.short_name]));
  const players = new Map();
  for (const el of bootstrap.elements ?? []) {
    let weightedPts = 0;
    let weightedMatches = 0;
    let minutes = 0;
    const last5 = liveByGw.map(({ gw, map }, i) => {
      const stats = map.get(el.id);
      const pts = stats?.total_points ?? 0;
      const played = matchesPlayed.get(`${el.team}-${gw}`) ?? 0;
      weightedPts += FORM_WEIGHTS[i] * pts;
      weightedMatches += FORM_WEIGHTS[i] * played;
      minutes += stats?.minutes ?? 0;
      return { gw, points: pts };
    });
    const formPpm = weightedMatches > 0 ? weightedPts / weightedMatches : 0;
    const seasonPpg = Number(el.points_per_game) || 0;
    const base = 0.7 * formPpm + 0.3 * seasonPpg;
    const fixturesAhead = (upcoming.get(el.team) ?? []).map((fx) => ({
      gw: fx.gw,
      opponent: teamShort.get(fx.opponent) ?? '?',
      home: fx.home,
      fdr: fx.fdr,
    }));
    const fixtureSum = fixturesAhead.reduce((s, fx) => s + (FDR_MULT[fx.fdr] ?? 1), 0);
    const avail = availability(el);
    const avgFdr = fixturesAhead.length ? fixturesAhead.reduce((s, fx) => s + fx.fdr, 0) / fixturesAhead.length : null;

    players.set(el.id, {
      id: el.id,
      name: el.web_name,
      teamId: el.team,
      team: teamShort.get(el.team) ?? '?',
      position: POSITIONS[el.element_type] ?? '?',
      elementType: el.element_type,
      price: el.now_cost / 10,
      status: el.status,
      chance: avail < 1 ? Math.round(avail * 100) : null,
      news: el.news || null,
      last5,
      minutes5: minutes,
      formPpm: round1(formPpm),
      avgFdr: avgFdr != null ? round1(avgFdr) : null,
      fixtures: fixturesAhead,
      projected: round1(base * fixtureSum * avail),
    });
  }

  const settings = bootstrap.game_settings ?? {};
  return {
    nextGw,
    horizon,
    formGws: [...formGws].reverse(),
    players,
    teamLimit: settings.squad_team_limit ?? 3,
    maxFreeTransfers: 1 + (settings.max_extra_free_transfers ?? 4),
  };
}

const playerScores = () => memo('transfer-scores', 10 * 60 * 1000, buildPlayerScores);

/**
 * Free transfers available for the upcoming gameweek, rebuilt from the manager's history:
 * one per gameweek, banked up to the cap; Wildcard / Free Hit weeks keep the banked ones; transfers beyond the free
 * ones were hits and leave zero. Transfers already made for the upcoming gameweek are then subtracted.
 */
function countFreeTransfers(history, pendingTransfers, cap) {
  const current = [...(history.current ?? [])].sort((a, b) => a.event - b.event);
  if (current.length === 0) return 1;
  const chipWeeks = new Set(
    (history.chips ?? []).filter((c) => c.name === 'wildcard' || c.name === 'freehit').map((c) => c.event)
  );
  let ft = 1; // after the gameweek the team joined (transfers before the first deadline are unlimited)
  for (const gw of current.slice(1)) {
    if (!chipWeeks.has(gw.event)) {
      ft = gw.event_transfers_cost > 0 ? 0 : Math.max(0, ft - gw.event_transfers);
    }
    ft = Math.min(ft + 1, cap);
  }
  return Math.max(0, ft - pendingTransfers);
}

/** Why a player is flagged for selling, in plain words. */
function weaknessReasons(p) {
  const reasons = [];
  if (p.chance === 0) reasons.push(p.news || 'Unavailable');
  else if (p.chance != null) reasons.push(`${p.chance}% chance of playing`);
  if (p.minutes5 < 90 * 2) reasons.push(`Only ${p.minutes5} mins in last ${FORM_GWS} GWs`);
  if (p.formPpm < 3) reasons.push(`Poor form (${p.formPpm} pts/match)`);
  if (p.avgFdr != null && p.avgFdr >= 3.4) reasons.push('Tough fixtures ahead');
  if (p.fixtures.length < HORIZON) reasons.push(`${HORIZON - p.fixtures.length} blank GW${HORIZON - p.fixtures.length > 1 ? 's' : ''} ahead`);
  if (reasons.length === 0) reasons.push('Lowest projection in your squad');
  return reasons;
}

/**
 * Pick replacements for the given sellers that maximise total projected gain, sharing one budget and respecting the
 * per-club limit. Each seller may also be kept (no transfer) when no replacement is a clear upgrade.
 */
function bestReplacements(sellers, squadIds, squadPlayers, bank, scores) {
  const budget = bank + sellers.reduce((s, p) => s + p.price, 0);
  const clubCount = new Map();
  for (const p of squadPlayers) clubCount.set(p.teamId, (clubCount.get(p.teamId) ?? 0) + 1);

  const all = [...scores.players.values()];
  const options = sellers.map((seller) => {
    const pool = all
      .filter(
        (c) =>
          c.elementType === seller.elementType &&
          !squadIds.has(c.id) &&
          c.price <= budget &&
          c.chance == null &&
          c.minutes5 >= 90 * 2 &&
          c.projected - seller.projected >= MIN_GAIN
      )
      .sort((a, b) => b.projected - a.projected)
      .slice(0, CANDIDATES_PER_POSITION);
    return [null, ...pool]; // null = keep the seller
  });

  let best = { gain: 0, picks: sellers.map(() => null) };
  const picks = [];
  const search = (i, spent, gain, clubs) => {
    if (i === sellers.length) {
      if (gain > best.gain) best = { gain, picks: [...picks] };
      return;
    }
    const seller = sellers[i];
    for (const cand of options[i]) {
      if (cand === null) {
        picks.push(null);
        search(i + 1, spent + seller.price, gain, clubs); // kept: their price stays "spent"
        picks.pop();
        continue;
      }
      if (picks.some((p) => p?.id === cand.id)) continue;
      const cost = spent + cand.price;
      if (cost > budget + 1e-9) continue;
      const nextClubs = new Map(clubs);
      nextClubs.set(seller.teamId, nextClubs.get(seller.teamId) - 1);
      const n = (nextClubs.get(cand.teamId) ?? 0) + 1;
      if (n > scores.teamLimit) continue;
      nextClubs.set(cand.teamId, n);
      picks.push(cand);
      search(i + 1, cost, gain + cand.projected - seller.projected, nextClubs);
      picks.pop();
    }
  };
  search(0, 0, 0, clubCount);
  return best.picks;
}

async function buildSuggestions(teamId) {
  const scores = await playerScores();
  const lastGw = scores.nextGw - 1;
  if (lastGw < 1) throw new SuggestionError(409, 'Transfer suggestions start after Gameweek 1.');

  const [history, transfers, picks] = await Promise.all([
    fplGet(`/entry/${teamId}/history/`),
    fplGet(`/entry/${teamId}/transfers/`),
    fplGet(`/entry/${teamId}/event/${lastGw}/picks/`),
  ]);

  // A Free Hit squad reverts afterwards, so plan from the squad before it.
  let squadPicks = picks;
  if (picks.active_chip === 'freehit' && lastGw > 1) {
    squadPicks = await fplGet(`/entry/${teamId}/event/${lastGw - 1}/picks/`);
  }

  // Apply transfers already made for the upcoming gameweek.
  const pending = transfers.filter((t) => t.event === scores.nextGw);
  const ids = squadPicks.picks.map((p) => p.element);
  let bankTenths = picks.entry_history?.bank ?? 0;
  for (const t of pending) {
    const i = ids.indexOf(t.element_out);
    if (i !== -1) ids[i] = t.element_in;
    bankTenths += t.element_out_cost - t.element_in_cost;
  }
  const bank = bankTenths / 10;

  const benchGk = squadPicks.picks.find((p) => p.position > 11 && p.element_type === 1)?.element;
  const squad = ids.map((id) => scores.players.get(id)).filter(Boolean);
  const squadIds = new Set(squad.map((p) => p.id));

  // Weakest three, unavailable players first. The backup goalkeeper is only flagged when unavailable.
  const ranked = [...squad].sort((a, b) => a.projected - b.projected);
  const sellers = ranked
    .filter((p) => !(p.id === benchGk && p.chance == null))
    .slice(0, SUGGESTIONS);

  const ins = bestReplacements(sellers, squadIds, squad, bank, scores);
  const freeTransfers = countFreeTransfers(history, pending.length, scores.maxFreeTransfers);

  const swaps = sellers
    .map((out, i) => ({ out: { ...out, reasons: weaknessReasons(out) }, in: ins[i], gain: ins[i] ? round1(ins[i].projected - out.projected) : 0 }))
    .sort((a, b) => b.gain - a.gain);
  let free = freeTransfers;
  for (const s of swaps) {
    if (!s.in) {
      s.label = 'keep';
    } else if (free > 0) {
      s.label = 'free';
      free -= 1;
    } else {
      s.label = 'hit';
      s.worthHit = s.gain > HIT_COST;
    }
  }

  return {
    teamId,
    gameweek: scores.nextGw,
    horizon: scores.horizon,
    formGws: scores.formGws,
    freeTransfers,
    maxFreeTransfers: scores.maxFreeTransfers,
    pendingTransfers: pending.length,
    bank: round1(bank),
    squad: ranked.map((p) => ({ id: p.id, name: p.name, team: p.team, position: p.position, projected: p.projected })),
    suggestions: swaps,
    generatedAt: new Date().toISOString(),
  };
}

export function registerTransferSuggestionRoutes(app) {
  app.get('/api/transfer-suggestions/:teamId', async (req, res) => {
    const { teamId } = req.params;
    if (!/^\d{1,10}$/.test(teamId)) return res.status(400).json({ error: 'Invalid team id' });
    try {
      const data = await memo(`transfer-suggestions:${teamId}`, 10 * 60 * 1000, () => buildSuggestions(Number(teamId)));
      res.set('Cache-Control', 'public, max-age=300');
      res.json(data);
    } catch (err) {
      if (err instanceof SuggestionError) return res.status(err.status).json({ error: err.message });
      if (err?.status === 404) return res.status(404).json({ error: 'Team not found' });
      console.error('Transfer suggestions error:', err.message);
      res.status(502).json({ error: 'Could not build transfer suggestions right now. Please try again.' });
    }
  });
}
