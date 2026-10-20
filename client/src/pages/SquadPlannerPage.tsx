import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSquad,
  deleteSquad,
  getBootstrapStatic,
  getFixtures,
  getMe,
  listSquads,
  loginWithTelegram,
  logout,
  updateSquad,
} from '../api/fpl';
import type { FplElement, SavedSquad } from '../types/fpl';
import {
  BUDGET,
  EMPTY_DRAFT,
  POSITION_SHORT,
  addPlayer,
  canSwap,
  draftToPicks,
  ensureArmband,
  picksToDraft,
  removePlayer,
  replacePlayer,
  setArmband,
  squadProblems,
  swapPlayers,
  type SquadDraft,
} from '../utils/squadRules';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import PlayerPicker from '../components/squad/PlayerPicker';
import SquadPitch, { type PitchMode } from '../components/squad/SquadPitch';
import SquadPoints from '../components/squad/SquadPoints';
import PlayerDetailCard from '../components/PlayerDetailCard';
import TelegramLogin from '../components/squad/TelegramLogin';

const STORAGE_KEY = 'fpl_squad_planner';

interface Stored {
  /** Saved squad being viewed/edited; null for a new, unsaved squad. */
  activeId: string | null;
  draft: SquadDraft;
}

function loadStored(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && Array.isArray(raw.draft?.players)) return { activeId: raw.activeId ?? null, draft: { ...EMPTY_DRAFT, ...raw.draft } };
  } catch {
    // Ignore unreadable storage and start fresh.
  }
  return { activeId: null, draft: EMPTY_DRAFT };
}

function latestVersion(squad: SavedSquad | undefined) {
  return squad?.versions[squad.versions.length - 1] ?? null;
}

export default function SquadPlannerPage() {
  const queryClient = useQueryClient();
  const [{ activeId, draft }, setState] = useState<Stored>(loadStored);
  const setDraft = (update: (d: SquadDraft) => SquadDraft) => setState((s) => ({ ...s, draft: update(s.draft) }));
  const [tab, setTab] = useState<'points' | 'edit'>(activeId ? 'points' : 'edit');
  const [mode, setMode] = useState<PitchMode>('transfers');
  const [pickerPosition, setPickerPosition] = useState(0);
  const [replacingId, setReplacingId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [swapId, setSwapId] = useState<number | null>(null);
  const [infoId, setInfoId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId, draft }));
    } catch {
      // Storage full or blocked: the squad still works for this visit.
    }
  }, [activeId, draft]);

  // Prices change daily, so don't rely on a day-old bootstrap here.
  const { data: bootstrap, isLoading: bootstrapLoading } = useQuery({
    queryKey: ['fpl', 'bootstrap-static'],
    queryFn: getBootstrapStatic,
    staleTime: 10 * 60 * 1000,
  });
  const { data: fixtures } = useQuery({
    queryKey: ['fpl', 'fixtures', 'all'],
    queryFn: () => getFixtures(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: me } = useQuery({ queryKey: ['auth', 'me'], queryFn: getMe, staleTime: 5 * 60 * 1000 });
  const user = me?.user ?? null;
  const { data: squadList, error: squadsError } = useQuery({
    queryKey: ['squads', user?.id],
    queryFn: listSquads,
    enabled: user != null,
    staleTime: 60 * 1000,
  });
  const squads = squadList?.squads ?? [];
  const maxSquads = squadList?.max ?? 3;
  const saved = squads.find((sq) => sq.id === activeId);

  const elementsById = useMemo(() => new Map((bootstrap?.elements ?? []).map((e) => [e.id, e])), [bootstrap?.elements]);
  const teamsById = useMemo(() => new Map((bootstrap?.teams ?? []).map((t) => [t.id, t])), [bootstrap?.teams]);
  const typeOf = (id: number) => elementsById.get(id)?.element_type ?? 0;
  const teamName = (id: number) => teamsById.get(id)?.name ?? '';

  const latest = latestVersion(saved);
  /** Saved players keep the price they were bought at; new ones cost today's price. */
  const boughtAt = useMemo(() => new Map((latest?.picks ?? []).map((p) => [p.element, p.purchase_price])), [latest]);
  const priceOf = (id: number) => boughtAt.get(id) ?? elementsById.get(id)?.now_cost ?? 0;
  const spent = draft.players.reduce((n, id) => n + priceOf(id), 0);
  const bank = BUDGET - spent;

  const nextEvent = bootstrap?.events.find((e) => new Date(e.deadline_time).getTime() > Date.now()) ?? null;
  const nextFixtureByTeam = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!nextEvent || !fixtures || !bootstrap) return map;
    const short = (id: number) => bootstrap.teams.find((t) => t.id === id)?.short_name ?? '';
    for (const f of fixtures) {
      if (f.event !== nextEvent.id) continue;
      map.set(f.team_h, [...(map.get(f.team_h) ?? []), `${short(f.team_a)} (H)`]);
      map.set(f.team_a, [...(map.get(f.team_a) ?? []), `${short(f.team_h)} (A)`]);
    }
    return map;
  }, [fixtures, nextEvent, bootstrap]);

  const picks = draftToPicks(draft, typeOf);
  const dirty = useMemo(() => {
    if (!latest) return draft.players.length > 0;
    const strip = (ps: { element: number; position: number; is_captain: boolean; is_vice_captain: boolean }[]) =>
      JSON.stringify(ps.map((p) => [p.element, p.position, p.is_captain, p.is_vice_captain]));
    return strip(picks) !== strip(latest.picks) || draft.name !== saved?.name;
  }, [latest, picks, draft.name, draft.players.length, saved?.name]);

  const problems = bootstrap ? squadProblems(draft, elementsById, priceOf) : [];
  const clubCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const id of draft.players) {
      const team = elementsById.get(id)?.team;
      if (team != null) m.set(team, (m.get(team) ?? 0) + 1);
    }
    return m;
  }, [draft.players, elementsById]);
  const typeCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const id of draft.players) c[typeOf(id)] += 1;
    return c;
  }, [draft.players, elementsById]);

  const adoptSquad = (squad: SavedSquad) => {
    const v = latestVersion(squad);
    setState({ activeId: squad.id, draft: v ? picksToDraft(squad.name, v.picks) : { ...EMPTY_DRAFT, name: squad.name } });
  };
  const putSquadInList = (squad: SavedSquad) =>
    queryClient.setQueryData<{ squads: SavedSquad[]; max: number }>(['squads', user?.id], (old) => {
      const list = old?.squads ?? [];
      const squads = list.some((x) => x.id === squad.id) ? list.map((x) => (x.id === squad.id ? squad : x)) : [...list, squad];
      return { squads, max: old?.max ?? 3 };
    });

  // After logging in, open the first saved squad unless a new one is being built on this device.
  useEffect(() => {
    if (!squadList) return;
    if (activeId && !squadList.squads.some((x) => x.id === activeId)) {
      setState({ activeId: null, draft: EMPTY_DRAFT });
    } else if (!activeId && draft.players.length === 0 && squadList.squads[0]) {
      adoptSquad(squadList.squads[0]);
      setTab('points');
    }
  }, [squadList]);

  const login = useMutation({
    mutationFn: loginWithTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setNotice(null);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Don't leave this account's squad on a shared device.
      setState({ activeId: null, draft: EMPTY_DRAFT });
      setTab('edit');
      queryClient.removeQueries({ queryKey: ['squads'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: draft.name.trim() || 'My Squad', picks };
      return activeId ? updateSquad(activeId, payload) : createSquad(payload);
    },
    onSuccess: (squad) => {
      const firstSave = !activeId;
      putSquadInList(squad);
      adoptSquad(squad);
      const gw = latestVersion(squad)?.gw;
      setNotice(firstSave ? `Saved! “${squad.name}” scores from GW${gw}.` : `Saved. These changes count from GW${gw}.`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSquad(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<{ squads: SavedSquad[]; max: number }>(['squads', user?.id], (old) =>
        old ? { ...old, squads: old.squads.filter((x) => x.id !== id) } : old
      );
      setState({ activeId: null, draft: EMPTY_DRAFT });
      setTab('edit');
      setNotice('Squad deleted.');
    },
  });

  const switchTo = (squad: SavedSquad) => {
    if (squad.id === activeId) return;
    if (dirty && !window.confirm('Switch squads? Unsaved changes to this squad will be lost.')) return;
    adoptSquad(squad);
    setTab('points');
    setMode('transfers');
    setNotice(null);
  };

  const openPicker = (position: number, replacing: number | null = null) => {
    setPickerPosition(position);
    setReplacingId(replacing);
    setPickerOpen(true);
  };

  const handlePick = (el: FplElement) => {
    setDraft((d) => {
      const next = replacingId != null ? replacePlayer(d, replacingId, el.id) : addPlayer(d, el.id, typeOf);
      return ensureArmband(next, priceOf);
    });
    setReplacingId(null);
    // Close the mobile sheet once that position is full.
    if (replacingId != null || typeCounts[el.element_type] + 1 >= ({ 1: 2, 2: 5, 3: 5, 4: 3 } as Record<number, number>)[el.element_type]) {
      setPickerOpen(false);
    }
  };

  const handlePlayer = (id: number) => {
    if (mode === 'lineup' && swapId != null) {
      if (canSwap(draft, swapId, id, typeOf)) setDraft((d) => swapPlayers(d, swapId, id));
      setSwapId(null);
      return;
    }
    setActionId(id);
  };

  const swapTargets = useMemo(() => {
    if (swapId == null) return new Set<number>();
    return new Set(draft.players.filter((id) => canSwap(draft, swapId, id, typeOf)));
  }, [swapId, draft, elementsById]);

  const startNew = () => {
    if (dirty && !window.confirm('Start a new squad? Unsaved changes to this squad will be lost.')) return;
    setState({ activeId: null, draft: EMPTY_DRAFT });
    setTab('edit');
    setMode('transfers');
    setNotice(null);
  };

  if (bootstrapLoading || !bootstrap) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="card h-96 animate-pulse" />
      </main>
    );
  }

  const atLimit = user != null && !activeId && squads.length >= maxSquads;
  const canSave = user != null && !atLimit;
  const actionEl = actionId != null ? elementsById.get(actionId) : undefined;
  const infoEl = infoId != null ? elementsById.get(infoId) : undefined;
  const isStarter = actionId != null && draft.starters.includes(actionId);
  const replacingEl = replacingId != null ? elementsById.get(replacingId) ?? null : null;

  const picker = (onClose?: () => void) => (
    <PlayerPicker
      elements={bootstrap.elements}
      teams={bootstrap.teams}
      position={replacingEl?.element_type ?? pickerPosition}
      onPositionChange={setPickerPosition}
      squad={draft.players}
      replacing={replacingEl}
      bank={bank}
      clubCounts={clubCounts}
      typeCounts={typeCounts}
      onPick={handlePick}
      onClose={onClose}
    />
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Squad Planner</h2>
        <p className="mt-1 text-sm text-slate-400">
          Build a £100m squad at today's prices and track its points here. Separate from your real FPL team.
        </p>
      </div>

      {/* Account + squad switcher */}
      <div className="card mb-4 p-4">
        {user ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-400">
                Logged in as <span className="font-semibold text-white">{user.name}</span>
                {user.username && <span className="text-slate-500"> @{user.username}</span>}
              </p>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                Log out
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {squads.map((sq) => (
                <button
                  key={sq.id}
                  type="button"
                  onClick={() => switchTo(sq)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    sq.id === activeId
                      ? 'border-fpl-brand bg-fpl-brand/15 text-white'
                      : 'border-fpl-border bg-fpl-raised/60 text-slate-300 hover:text-white'
                  }`}
                >
                  {sq.name}
                </button>
              ))}
              {!activeId && draft.players.length > 0 && (
                <span className="rounded-lg border border-dashed border-fpl-brand/60 px-3 py-1.5 text-sm text-slate-300">
                  {draft.name || 'New squad'} <span className="text-xs text-slate-500">(unsaved)</span>
                </span>
              )}
              {squads.length < maxSquads ? (
                (activeId || draft.players.length === 0) && (
                  <button type="button" className="btn-ghost !py-1.5 !text-xs" onClick={startNew}>
                    + New squad
                  </button>
                )
              ) : (
                <span className="text-xs text-slate-500">{maxSquads} of {maxSquads} squads used</span>
              )}
              {saved && (
                <button
                  type="button"
                  className="ml-auto text-xs text-rose-300/80 hover:text-rose-300"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete “${saved.name}”? Its points history will be lost. This can't be undone.`)) remove.mutate(saved.id);
                  }}
                >
                  Delete squad
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Your squad is kept on this device. <span className="text-slate-200">Log in with Telegram</span> to save up to 3 squads
              and track their points on any device.
            </p>
            {me?.telegram_bot ? (
              <TelegramLogin bot={me.telegram_bot} onAuth={(data) => login.mutate(data)} />
            ) : (
              me && <p className="text-xs text-amber-300">Telegram login isn't set up on this server yet.</p>
            )}
          </div>
        )}
      </div>

      {(notice || login.error || squadsError || remove.error) && (
        <div
          className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
            login.error || squadsError || remove.error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          <span>{login.error?.message ?? remove.error?.message ?? (squadsError ? `Couldn't load your squads: ${squadsError.message}` : notice)}</span>
          <button
            type="button"
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => {
              setNotice(null);
              login.reset();
              remove.reset();
            }}
          >
            ×
          </button>
        </div>
      )}

      {saved && (
        <div className="segmented mb-4" role="tablist" aria-label="Squad planner view">
          <button type="button" role="tab" aria-selected={tab === 'points'} data-active={tab === 'points'} onClick={() => setTab('points')}>
            Points
          </button>
          <button type="button" role="tab" aria-selected={tab === 'edit'} data-active={tab === 'edit'} onClick={() => setTab('edit')}>
            Edit squad{dirty ? ' •' : ''}
          </button>
        </div>
      )}

      {tab === 'points' && saved ? (
        <SquadPoints squad={saved} bootstrap={bootstrap} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-3">
            {/* Squad summary + save */}
            <div className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.slice(0, 30) }))}
                  className="input !w-auto min-w-0 flex-1 !py-2 font-semibold"
                  aria-label="Squad name"
                  placeholder="Squad name"
                />
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="eyebrow">Players</p>
                    <p className="font-display font-bold tabular-nums text-white">{draft.players.length}/15</p>
                  </div>
                  <div>
                    <p className="eyebrow">Bank</p>
                    <p className={`font-display font-bold tabular-nums ${bank < 0 ? 'text-rose-400' : 'text-white'}`}>£{(bank / 10).toFixed(1)}m</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canSave || problems.length > 0 || !dirty || save.isPending}
                  onClick={() => save.mutate()}
                  title={!user ? 'Log in with Telegram to save' : atLimit ? `You already have ${maxSquads} squads` : undefined}
                >
                  {save.isPending ? 'Saving…' : !user ? 'Log in to save' : activeId ? 'Save changes' : 'Save squad'}
                </button>
              </div>
              {problems.length > 0 ? (
                <p className="text-xs text-amber-300">{problems.join(' · ')}</p>
              ) : atLimit ? (
                <p className="text-xs text-amber-300">You already have {maxSquads} saved squads. Delete one to save this as a new squad.</p>
              ) : dirty && !user ? (
                <p className="text-xs text-slate-400">Squad complete. Log in with Telegram above to save it and start scoring.</p>
              ) : dirty ? (
                <p className="text-xs text-slate-400">
                  Ready to save{nextEvent ? ` — counts from ${nextEvent.name} (deadline ${new Date(nextEvent.deadline_time).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` : ''}.
                </p>
              ) : (
                <p className="text-xs text-emerald-400">All changes saved.</p>
              )}
              {save.error && <p className="text-xs text-rose-300">{save.error.message}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="segmented" role="tablist" aria-label="Pitch view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'transfers'}
                  data-active={mode === 'transfers'}
                  onClick={() => {
                    setMode('transfers');
                    setSwapId(null);
                  }}
                >
                  Transfers
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'lineup'}
                  data-active={mode === 'lineup'}
                  onClick={() => setMode('lineup')}
                  disabled={draft.players.length === 0}
                >
                  Pick team
                </button>
              </div>
              <span className="text-xs text-slate-500">
                {swapId != null
                  ? 'Tap a highlighted player to swap, or anywhere else to cancel'
                  : mode === 'transfers'
                    ? 'Tap + to add a player, or a player to replace them'
                    : 'Tap a player to set captain or make a substitution'}
              </span>
            </div>

            <SquadPitch
              mode={mode}
              draft={draft}
              elementsById={elementsById}
              teamName={teamName}
              priceOf={priceOf}
              nextFixture={(team) => (nextFixtureByTeam.get(team) ?? []).join(', ')}
              selectedId={swapId}
              swapTargets={swapTargets}
              onEmptySlot={(position) => openPicker(position)}
              onPlayer={handlePlayer}
              onRemove={(id) => setDraft((d) => removePlayer(d, id))}
            />
          </div>

          {/* Desktop: picker always beside the pitch. Phones: opens as a sheet. */}
          <div className="hidden h-[760px] lg:sticky lg:top-4 lg:block">{picker(replacingId != null ? () => setReplacingId(null) : undefined)}</div>
          {pickerOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end bg-black/70 lg:hidden"
              onClick={(e) => e.target === e.currentTarget && setPickerOpen(false)}
            >
              <div className="h-[85vh] w-full">
                {picker(() => {
                  setPickerOpen(false);
                  setReplacingId(null);
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player actions */}
      {actionEl && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={(e) => e.target === e.currentTarget && setActionId(null)}
          role="dialog"
          aria-modal
          aria-label={`${actionEl.web_name} options`}
        >
          <div className="card w-full overflow-hidden rounded-b-none sm:max-w-xs sm:rounded-2xl">
            <div className="border-b border-fpl-border px-4 py-3">
              <p className="font-semibold text-white">{actionEl.web_name}</p>
              <p className="text-xs text-slate-500">
                {teamName(actionEl.team)} · {POSITION_SHORT[actionEl.element_type]} · £{(priceOf(actionEl.id) / 10).toFixed(1)}m
                {boughtAt.has(actionEl.id) && priceOf(actionEl.id) !== actionEl.now_cost ? ` (now £${((actionEl.now_cost ?? 0) / 10).toFixed(1)}m)` : ''}
              </p>
            </div>
            <div className="flex flex-col p-2 text-sm">
              {(mode === 'transfers'
                ? [
                    { label: 'Replace', run: () => openPicker(actionEl.element_type, actionEl.id) },
                    { label: 'Remove', run: () => setDraft((d) => removePlayer(d, actionEl.id)), danger: true },
                  ]
                : [
                    ...(isStarter && draft.captain !== actionEl.id
                      ? [{ label: 'Make captain', run: () => setDraft((d) => setArmband(d, actionEl.id, 'captain')) }]
                      : []),
                    ...(isStarter && draft.vice !== actionEl.id
                      ? [{ label: 'Make vice-captain', run: () => setDraft((d) => setArmband(d, actionEl.id, 'vice')) }]
                      : []),
                    { label: 'Substitute', run: () => setSwapId(actionEl.id) },
                  ]
              ).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    setActionId(null);
                    a.run();
                  }}
                  className={`rounded-lg px-3 py-2.5 text-left hover:bg-white/5 ${'danger' in a && a.danger ? 'text-rose-300' : 'text-slate-200'}`}
                >
                  {a.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActionId(null);
                  setInfoId(actionEl.id);
                }}
                className="rounded-lg px-3 py-2.5 text-left text-slate-200 hover:bg-white/5"
              >
                Player info
              </button>
            </div>
          </div>
        </div>
      )}

      {infoEl && (
        <PlayerDetailCard
          element={infoEl}
          teamName={teamName(infoEl.team)}
          teams={bootstrap.teams}
          imageUrl={getPlayerImageUrl(infoEl, teamName(infoEl.team))}
          onClose={() => setInfoId(null)}
        />
      )}
    </main>
  );
}
