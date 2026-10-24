import { useEffect, useState } from 'react';
import { useTransferSuggestions } from '../hooks/useFplApi';
import type { SuggestionPlayer, TransferSuggestion } from '../types/fpl';
import { FDR_FILL } from '../utils/fdr';

const POS_PILL: Record<string, string> = {
  GKP: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  DEF: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  MID: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  FWD: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
};

function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FixtureStrip({ player, horizon }: { player: SuggestionPlayer; horizon: number[] }) {
  return (
    <div className="flex gap-0.5">
      {horizon.map((gw) => {
        const fxs = player.fixtures.filter((f) => f.gw === gw);
        if (fxs.length === 0) {
          return (
            <span key={gw} className="flex h-5 flex-1 min-w-0 items-center justify-center rounded border border-dashed border-fpl-border text-[9px] text-slate-600" title={`GW${gw}: blank`}>
              –
            </span>
          );
        }
        return (
          <span key={gw} className="flex h-5 flex-1 min-w-0 gap-px" title={fxs.map((f) => `GW${gw}: ${f.opponent} (${f.home ? 'H' : 'A'}) · FDR ${f.fdr}`).join('\n')}>
            {fxs.map((f, i) => (
              <span key={i} className={`flex flex-1 min-w-0 items-center justify-center rounded text-[9px] font-semibold leading-none ${FDR_FILL[f.fdr] ?? 'bg-fpl-raised text-slate-300'}`}>
                {f.home ? f.opponent.toUpperCase() : f.opponent.toLowerCase()}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

function PlayerBlock({
  player,
  horizon,
  tone,
  reasons,
}: {
  player: SuggestionPlayer;
  horizon: number[];
  tone: 'out' | 'in';
  reasons?: string[];
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-xl border p-3 ${
        tone === 'out' ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-fpl-brand/30 bg-fpl-brand/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${tone === 'out' ? 'text-rose-400' : 'text-fpl-brand'}`}>
            {tone === 'out' ? 'Transfer out' : 'Transfer in'}
          </p>
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <span className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold ring-1 ${POS_PILL[player.position] ?? ''}`}>
              {player.position}
            </span>
            <span className="truncate font-semibold text-white">{player.name}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {player.team} · £{player.price.toFixed(1)}m · {player.formPpm} pts/match
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-lg font-bold leading-none tabular-nums text-white">{player.projected.toFixed(1)}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">proj. pts</p>
        </div>
      </div>
      <div className="mt-2.5">
        <FixtureStrip player={player} horizon={horizon} />
      </div>
      {reasons && reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {reasons.map((r) => (
            <span key={r} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/25">
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelBadge({ s }: { s: TransferSuggestion }) {
  if (s.label === 'free') {
    return <span className="rounded-full bg-fpl-accent px-2.5 py-0.5 text-[11px] font-semibold text-fpl-ink">Free transfer</span>;
  }
  if (s.label === 'hit') {
    return s.worthHit ? (
      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">−4 hit · worth it</span>
    ) : (
      <span className="rounded-full bg-fpl-raised px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 ring-1 ring-inset ring-fpl-border">−4 hit · not worth it</span>
    );
  }
  return <span className="rounded-full bg-fpl-raised px-2.5 py-0.5 text-[11px] font-semibold text-slate-400 ring-1 ring-inset ring-fpl-border">Keep</span>;
}

function SuggestionRow({ s, index, horizon }: { s: TransferSuggestion; index: number; horizon: number[] }) {
  const dim = s.label === 'hit' && !s.worthHit;
  return (
    <li className={`rounded-2xl border border-fpl-border bg-fpl-raised/30 p-3 sm:p-4 ${dim ? 'opacity-70' : ''}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-slate-300">Suggestion {index + 1}</span>
        <LabelBadge s={s} />
      </div>
      <div className="flex flex-col md:flex-row md:items-stretch gap-2">
        <PlayerBlock player={s.out} horizon={horizon} tone="out" reasons={s.out.reasons} />
        {s.in ? (
          <>
            <div className="flex md:flex-col items-center justify-center gap-1.5 px-1 py-1 md:py-0 md:w-20 shrink-0">
              <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0 text-slate-500" />
              <span className="font-display text-sm font-bold tabular-nums text-fpl-brand">+{s.gain.toFixed(1)}</span>
              <span className="text-[10px] text-slate-500 md:text-center leading-tight">pts over {horizon.length} GWs</span>
            </div>
            <PlayerBlock player={s.in} horizon={horizon} tone="in" />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-fpl-border p-4 text-center text-sm text-slate-400">
            No clear upgrade within budget. Keep {s.out.name} for now.
          </div>
        )}
      </div>
    </li>
  );
}

/** What the analysis does, shown ticking off while it runs (these are the real steps the server takes). */
const STEPS = [
  'Checking form over the last 5 gameweeks',
  'Rating the next 5 fixtures',
  'Checking injuries and suspensions',
  'Finding the best replacements you can afford',
];
const STEP_MS = 320;

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin text-fpl-brand" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-fpl-brand" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The analysis steps; each ticks once the one before it has had its moment, the last once the result is in. */
function AnalysisProgress({ step, waiting }: { step: number; waiting: boolean }) {
  return (
    <ul className="space-y-2 py-2" aria-live="polite">
      {STEPS.map((label, i) => {
        const done = i < step && !(waiting && i === STEPS.length - 1);
        const active = !done && i <= step;
        return (
          <li key={label} className={`flex items-center gap-2.5 text-sm transition-opacity ${i > step ? 'opacity-35' : ''}`}>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {done ? <Check /> : active ? <Spinner /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
            </span>
            <span className={done ? 'text-slate-300' : active ? 'text-white' : 'text-slate-500'}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function TransferSuggestions({ teamId }: { teamId: number }) {
  // Nothing is fetched or shown until the user asks for the analysis.
  const [requested, setRequested] = useState(false);
  const [step, setStep] = useState(0);
  const { data, error } = useTransferSuggestions(teamId, requested);

  // Viewing another team starts over.
  useEffect(() => {
    setRequested(false);
    setStep(0);
  }, [teamId]);

  // Tick through the steps while the request runs.
  useEffect(() => {
    if (!requested || step >= STEPS.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [requested, step]);

  const stepsDone = step >= STEPS.length;
  const showResult = requested && stepsDone && (data || error);
  const analysing = requested && !showResult;

  const horizon = data?.horizon ?? [];
  const range = horizon.length ? `GW${horizon[0]}–${horizon[horizon.length - 1]}` : '';

  return (
    <section className="card p-4 sm:p-5">
      <div>
        <p className="eyebrow">{showResult && data ? `Gameweek ${data.gameweek}` : 'Transfers'}</p>
        <h2 className="section-title mt-0.5">AI Suggestions</h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Your weakest players and the best replacements you can afford, based on form and fixtures.
        </p>
      </div>

      {!requested && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-fpl-border px-4 py-6 text-center">
          <button type="button" className="btn-primary" onClick={() => setRequested(true)}>
            Analyse my team
          </button>
          <p className="text-xs text-slate-500">Checks form, fixtures and injuries, then suggests up to 3 transfers.</p>
        </div>
      )}

      {analysing && (
        <div className="mt-4">
          <AnalysisProgress step={step} waiting={stepsDone && !data && !error} />
        </div>
      )}

      {showResult && data && data.pendingTransfers > 0 && (
        <p className="mt-3 rounded-lg bg-fpl-raised/60 px-3 py-2 text-xs text-slate-400">
          Includes the {data.pendingTransfers} transfer{data.pendingTransfers > 1 ? 's' : ''} you've already made for GW{data.gameweek}.
        </p>
      )}

      {showResult && (
        <div className="mt-4 page-enter">
          {error && (
            <p className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {(error as Error).message || 'Could not load transfer suggestions.'}
            </p>
          )}
          {data &&
            (data.suggestions.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No transfers needed. Your squad looks strong for {range}.</p>
            ) : (
              <ol className="space-y-3">
                {data.suggestions.map((s, i) => (
                  <SuggestionRow key={s.out.id} s={s} index={i} horizon={horizon} />
                ))}
              </ol>
            ))}
        </div>
      )}

      {showResult && data && (
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Projected points for {range} combine form over GW{data.formGws[0]}–{data.formGws[data.formGws.length - 1]} with
          fixture difficulty and injury news. Prices are current FPL prices, so your actual selling prices may differ. A −4
          hit is only worth it when the gain is more than 4 points.
        </p>
      )}
    </section>
  );
}
