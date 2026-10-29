import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBootstrapStatic } from '../hooks/useFplApi';
import { getFixtures } from '../api/fpl';
import type { FplElement, FplFixture, FplTeam } from '../types/fpl';
import { clubInfo, clubPath, myanmarTime } from '../utils/clubs';
import { getAvailability } from '../utils/availability';
import AvailabilityBadge from '../components/AvailabilityBadge';
import { playerCardProps, usePlayerCard } from '../components/PlayerCardProvider';
import NotFoundPage from './NotFoundPage';

const POS: Record<number, string> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

/** Official FPL fixture difficulty colours. */
export const FDR: Record<number, string> = {
  1: 'bg-[#375523] text-fpl-snow',
  2: 'bg-[#01fc7a] text-fpl-ink',
  3: 'bg-[#e7e7e7] text-fpl-ink',
  4: 'bg-[#ff1751] text-fpl-snow',
  5: 'bg-[#80072d] text-fpl-snow',
};

function Badge({ teamId, className }: { teamId: number; className: string }) {
  return <img src={`/api/badge/${teamId}?v=2`} alt="" className={`object-contain ${className}`} loading="lazy" />;
}

export default function ClubPage() {
  const { slug } = useParams();
  const { data: bootstrap, isLoading } = useBootstrapStatic();
  const { data: fixtures } = useQuery({ queryKey: ['fpl', 'fixtures', 'all'], queryFn: () => getFixtures(), staleTime: 5 * 60 * 1000 });
  const openPlayer = usePlayerCard();

  const teams = bootstrap?.teams ?? [];
  const team = teams.find((t) => clubInfo(t).slug === slug);
  const info = team ? clubInfo(team) : null;
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // The server sets the title for search engines; keep the browser tab in step on client-side navigation.
  useEffect(() => {
    if (info) document.title = `${info.name} FPL: Fixtures, Injuries & Player Prices | FPL House`;
  }, [info]);

  const { upcoming, results } = useMemo(() => {
    const mine = (fixtures ?? [])
      .filter((f) => team && (f.team_h === team.id || f.team_a === team.id))
      .sort((a, b) => (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? ''));
    return {
      upcoming: mine.filter((f) => !f.finished && !f.finished_provisional).slice(0, 5),
      results: mine.filter((f) => f.finished || f.finished_provisional).slice(-5).reverse(),
    };
  }, [fixtures, team]);

  const players = useMemo(
    () =>
      (bootstrap?.elements ?? [])
        .filter((e) => team && e.team === team.id && e.status !== 'u')
        .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0)),
    [bootstrap?.elements, team]
  );
  const flagged = players.filter((e) => getAvailability(e));

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="card h-64 animate-pulse" />
      </main>
    );
  }
  if (!team || !info) return <NotFoundPage />;

  const opponent = (f: FplFixture) => {
    const home = f.team_h === team.id;
    return { other: teamById.get(home ? f.team_a : f.team_h), home };
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <nav className="mb-3 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link to="/clubs" className="hover:text-white">
          Clubs
        </Link>{' '}
        / <span className="text-slate-300">{info.name}</span>
      </nav>

      <header className="card flex items-center gap-4 p-4 sm:p-6">
        <Badge teamId={team.id} className="h-16 w-16 shrink-0 sm:h-20 sm:w-20" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{info.name} FPL guide</h1>
          <p className="mt-1 text-sm text-slate-400">
            Fixtures in Myanmar time, injury news and Fantasy Premier League prices for every {info.name} player.
            {info.aka.length > 0 && <> Also known as {info.aka.join(', ')}.</>}
          </p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card min-w-0 p-4 sm:p-5">
          <h2 className="section-title mb-3">Next fixtures</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming fixtures.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((f) => {
                const { other, home } = opponent(f);
                const diff = (home ? f.team_h_difficulty : f.team_a_difficulty) ?? 3;
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-lg bg-fpl-raised/60 px-3 py-2">
                    <span className="w-10 shrink-0 text-xs font-semibold text-slate-500">GW{f.event}</span>
                    {other && <Badge teamId={other.id} className="h-6 w-6 shrink-0" />}
                    <span className="min-w-0 flex-1 text-sm text-white">
                      <span className="block truncate">
                        {other ? (
                          <Link to={clubPath(other)} className="hover:underline">
                            {clubInfo(other).name}
                          </Link>
                        ) : (
                          'TBC'
                        )}{' '}
                        <span className="text-slate-500">({home ? 'H' : 'A'})</span>
                      </span>
                      {/* Phones: kick-off under the name; wider screens: its own column. */}
                      <span className="block text-xs tabular-nums text-slate-400 sm:hidden">{myanmarTime(f.kickoff_time)}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:inline">{myanmarTime(f.kickoff_time)}</span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${FDR[diff] ?? FDR[3]}`} title={`Difficulty ${diff}`}>
                      {diff}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Kick-off times in Myanmar time (MMT). Colour = FPL fixture difficulty.</p>
        </section>

        <section className="card min-w-0 p-4 sm:p-5">
          <h2 className="section-title mb-3">Recent results</h2>
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">No results yet this season.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((f) => {
                const { other, home } = opponent(f);
                const us = (home ? f.team_h_score : f.team_a_score) ?? 0;
                const them = (home ? f.team_a_score : f.team_h_score) ?? 0;
                const r = us > them ? 'W' : us < them ? 'L' : 'D';
                const tone = r === 'W' ? 'bg-emerald-500 text-fpl-ink' : r === 'L' ? 'bg-rose-500 text-fpl-snow' : 'bg-slate-500 text-fpl-snow';
                return (
                  <li key={f.id} className="flex items-center gap-3 rounded-lg bg-fpl-raised/60 px-3 py-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${tone}`}>{r}</span>
                    {other && <Badge teamId={other.id} className="h-6 w-6 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {other ? (
                        <Link to={clubPath(other)} className="hover:underline">
                          {clubInfo(other).name}
                        </Link>
                      ) : (
                        '—'
                      )}{' '}
                      <span className="text-slate-500">({home ? 'H' : 'A'})</span>
                    </span>
                    <span className="shrink-0 font-display text-sm font-bold tabular-nums text-white">
                      {us}–{them}
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs text-slate-500">GW{f.event}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-5 p-4 sm:p-5">
        <h2 className="section-title mb-3">Injury and suspension news</h2>
        {flagged.length === 0 ? (
          <p className="text-sm text-slate-500">No injury or suspension news for {info.name} right now.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {flagged.map((e) => (
              <li
                key={e.id}
                {...playerCardProps(openPlayer, e.id, e.web_name)}
                className="flex cursor-pointer items-start gap-2 rounded-lg bg-fpl-raised/60 px-3 py-2 transition-colors hover:bg-fpl-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-fpl-brand/60"
              >
                <AvailabilityBadge availability={getAvailability(e)!} className="mt-0.5" />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-white">{e.web_name}</span>
                  <span className="text-slate-500"> · {POS[e.element_type]}</span>
                  <span className="block text-xs text-slate-400">{e.news || 'Availability doubt'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="p-4 sm:p-5">
          <h2 className="section-title">{info.name} FPL players</h2>
          <p className="text-xs text-slate-500">Prices, season points, form and ownership. Tap a player for fixtures and recent points.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-fpl-border bg-fpl-raised/60 text-left">
                <th className="eyebrow px-4 py-2.5">Player</th>
                <th className="eyebrow px-2 py-2.5">Pos</th>
                <th className="eyebrow px-2 py-2.5 text-right">Price</th>
                <th className="eyebrow px-2 py-2.5 text-right">Pts</th>
                <th className="eyebrow px-2 py-2.5 text-right">Form</th>
                <th className="eyebrow px-4 py-2.5 text-right">Owned</th>
              </tr>
            </thead>
            <tbody>
              {players.map((e: FplElement) => {
                const a = getAvailability(e);
                return (
                  <tr
                    key={e.id}
                    {...playerCardProps(openPlayer, e.id, e.web_name)}
                    className="cursor-pointer border-b border-fpl-border/50 transition-colors last:border-0 hover:bg-fpl-raised/50 focus:outline-none focus-visible:bg-fpl-raised/60"
                  >
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-white">{e.web_name}</span>
                        {a && <AvailabilityBadge availability={a} />}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-400">{POS[e.element_type]}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">£{((e.now_cost ?? 0) / 10).toFixed(1)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-white">{e.total_points ?? 0}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">{e.form ?? '0'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-400">{e.selected_by_percent ?? '0'}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <OtherClubs teams={teams} current={team} />
    </main>
  );
}

/** Links to every club (helps visitors and search engines find all club pages). */
export function OtherClubs({ teams, current }: { teams: FplTeam[]; current?: FplTeam }) {
  const sorted = [...teams].sort((a, b) => clubInfo(a).name.localeCompare(clubInfo(b).name));
  return (
    <section className="card mt-5 p-4 sm:p-5">
      <h2 className="section-title mb-3">{current ? 'Other Premier League clubs' : 'Premier League clubs'}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {sorted
          .filter((t) => t.id !== current?.id)
          .map((t) => {
            const c = clubInfo(t);
            return (
              <li key={t.id}>
                <Link to={clubPath(t)} className="flex items-center gap-2 rounded-lg bg-fpl-raised/60 px-3 py-2 transition-colors hover:bg-fpl-raised">
                  <Badge teamId={t.id} className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 truncate text-sm font-medium text-white">{c.name}</span>
                </Link>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
