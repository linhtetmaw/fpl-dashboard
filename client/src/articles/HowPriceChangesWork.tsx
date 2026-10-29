import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBootstrapStatic } from '../hooks/useFplApi';
import { usePlayerCard } from '../components/PlayerCardProvider';
import type { FplElement } from '../types/fpl';

const money = (tenths: number) => `£${(tenths / 10).toFixed(1)}m`;
/** FPL's selling price: half of any rise (rounded down to £0.1m), all of any fall. Prices in tenths of £1m. */
const sellPrice = (bought: number, now: number) => (now > bought ? bought + Math.floor((now - bought) / 2) : now);

/** Diagram 1: what turns transfers into a price change. */
function HowItHappens() {
  const steps = [
    { n: '1', title: 'Managers make transfers', text: 'Thousands of managers buy or sell the same player.' },
    {
      n: '2',
      title: 'Net transfers add up',
      text: 'Transfers in minus transfers out, compared with how many already own him.',
    },
    {
      n: '3',
      title: 'Progress fills up',
      text: 'Once the pressure is big enough, he reaches the target for a change.',
    },
    { n: '4', title: 'Price changes overnight', text: '+£0.1m for a rise, −£0.1m for a fall, once a day.' },
  ];
  return (
    <figure className="my-6">
      <ol className="!my-0 grid !list-none gap-2 !pl-0 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.n} className="card relative flex gap-3 p-3 sm:flex-col sm:gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fpl-accent text-sm font-bold text-fpl-purple">
              {s.n}
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">{s.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">{s.text}</span>
            </span>
            {i < steps.length - 1 && (
              <span
                className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-fpl-brand sm:block"
                aria-hidden
              >
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
      <figcaption className="mt-2 text-center text-xs text-slate-500">How a price change happens</figcaption>
    </figure>
  );
}

type ProgressElement = FplElement & { price_change_percent?: string | null };

function ProgressRow({ e, teamShort }: { e: ProgressElement; teamShort: string }) {
  const openPlayer = usePlayerCard();
  const pct = Number(e.price_change_percent) || 0;
  const rising = pct > 0;
  return (
    <li>
      <button type="button" onClick={() => openPlayer(e.id)} className="w-full text-left">
        <span className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate font-medium text-white">
            {e.web_name}{' '}
            <span className="text-xs font-normal text-slate-500">
              {teamShort} · {money(e.now_cost ?? 0)}
            </span>
          </span>
          <span
            className={`shrink-0 text-xs font-semibold tabular-nums ${rising ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {Math.abs(pct).toFixed(0)}%
          </span>
        </span>
        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-fpl-raised">
          <span
            className={`block h-full rounded-full ${rising ? 'bg-emerald-400' : 'bg-rose-400'}`}
            style={{ width: `${Math.min(100, Math.abs(pct))}%` }}
          />
        </span>
      </button>
    </li>
  );
}

/** Diagram 2 (live): the players closest to a rise and a fall right now, from FPL's own progress figure. */
function ClosestToChange() {
  const { data: bootstrap } = useBootstrapStatic();
  const { risers, fallers } = useMemo(() => {
    const els = (bootstrap?.elements ?? []) as ProgressElement[];
    const withPct = els.filter((e) => e.price_change_percent != null && e.status !== 'u');
    const pct = (e: ProgressElement) => Number(e.price_change_percent) || 0;
    return {
      risers: withPct
        .filter((e) => pct(e) > 0)
        .sort((a, b) => pct(b) - pct(a))
        .slice(0, 5),
      fallers: withPct
        .filter((e) => pct(e) < 0)
        .sort((a, b) => pct(a) - pct(b))
        .slice(0, 5),
    };
  }, [bootstrap?.elements]);
  const teams = useMemo(() => new Map((bootstrap?.teams ?? []).map((t) => [t.id, t.short_name])), [bootstrap?.teams]);
  if (!risers.length && !fallers.length) return null;
  return (
    <figure className="card my-6 p-4 sm:p-5">
      <p className="eyebrow flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-fpl-accent" aria-hidden /> Live from FPL
      </p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        {[
          { title: 'Closest to rising', list: risers },
          { title: 'Closest to falling', list: fallers },
        ].map(({ title, list }) => (
          <div key={title}>
            <p className="text-sm font-semibold text-white">{title}</p>
            <ul className="!my-2 !list-none space-y-3 !pl-0">
              {list.map((e) => (
                <ProgressRow key={e.id} e={e} teamShort={teams.get(e.team) ?? ''} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-xs leading-5 text-slate-500">
        Progress towards the next price change, from FPL’s own data. Tap a player for his price history.
      </figcaption>
    </figure>
  );
}

/** Diagram 3: when prices change, in UK, UTC and Myanmar time. */
function WhenItHappens() {
  const clocks = [
    { place: 'United Kingdom', time: '00:00', note: 'midnight' },
    { place: 'Myanmar', time: '06:30', note: 'morning' },
  ];
  return (
    <figure className="my-6 grid grid-cols-2 gap-2">
      {clocks.map((c) => (
        <div key={c.place} className="card flex items-center gap-3 p-3 sm:p-4">
          <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
            <circle cx="20" cy="20" r="18" className="fill-fpl-raised stroke-fpl-border" strokeWidth="2" />
            {Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1="20"
                y1="4"
                x2="20"
                y2="7"
                className="stroke-slate-500"
                strokeWidth="1.5"
                transform={`rotate(${i * 30} 20 20)`}
              />
            ))}
            {/* Hands: hour then minute, from the shown time. */}
            {(() => {
              const [h, m] = c.time.split(':').map(Number);
              return (
                <>
                  <line
                    x1="20"
                    y1="20"
                    x2="20"
                    y2="11"
                    className="stroke-white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    transform={`rotate(${(h % 12) * 30 + m / 2} 20 20)`}
                  />
                  <line
                    x1="20"
                    y1="20"
                    x2="20"
                    y2="7"
                    className="stroke-fpl-brand"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    transform={`rotate(${m * 6} 20 20)`}
                  />
                </>
              );
            })()}
          </svg>
          <span>
            <span className="block text-xs text-slate-500">{c.place}</span>
            <span className="block font-display text-lg font-bold tabular-nums text-white">{c.time}</span>
            <span className="block text-xs text-slate-500">{c.note}</span>
          </span>
        </div>
      ))}
      <figcaption className="col-span-2 text-center text-xs text-slate-500">
        Prices update once a day, shortly after midnight UK time (about 06:30 in Myanmar).
      </figcaption>
    </figure>
  );
}

/** Diagram 4: market price vs your selling price as a player bought at £7.0m rises. */
function SellPriceChart() {
  const bought = 70;
  const prices = [70, 71, 72, 73, 74, 75, 76];
  const W = 360;
  const H = 220;
  const pad = { l: 44, r: 12, t: 16, b: 34 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (prices.length - 1);
  const y = (v: number) => pad.t + ((76 - v) * (H - pad.t - pad.b)) / 6;
  const step = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : `H${x(i)} V`}${i === 0 ? `${x(0)} ${y(v)}` : y(v)}`).join(' ');
  const sells = prices.map((p) => sellPrice(bought, p));
  return (
    <figure className="card my-6 p-3 sm:p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block w-full max-w-lg"
        role="img"
        aria-label="Chart: as the price rises from £7.0m to £7.6m, the selling price only rises from £7.0m to £7.3m"
      >
        {[70, 72, 74, 76].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-fpl-border" strokeDasharray="3 3" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500" fontSize="12">
              {money(v)}
            </text>
          </g>
        ))}
        {prices.map((_, i) => (
          <text key={i} x={x(i)} y={H - pad.b + 16} textAnchor="middle" className="fill-slate-500" fontSize="12">
            {i === 0 ? 'Buy' : `+${i}`}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 4} textAnchor="middle" className="fill-slate-500" fontSize="11">
          price rises since you bought him
        </text>
        <path d={step(prices)} fill="none" className="stroke-emerald-400" strokeWidth="2.5" />
        <path d={step(sells)} fill="none" className="stroke-amber-400" strokeWidth="2.5" strokeDasharray="6 4" />
        <circle cx={x(6)} cy={y(76)} r="3.5" className="fill-emerald-400" />
        <circle cx={x(6)} cy={y(73)} r="3.5" className="fill-amber-400" />
        <text x={x(6) - 6} y={y(76) + 16} textAnchor="end" className="fill-emerald-400" fontSize="12" fontWeight="600">
          Price £7.6m
        </text>
        <text x={x(6) - 6} y={y(73) + 16} textAnchor="end" className="fill-amber-400" fontSize="12" fontWeight="600">
          You get £7.3m
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-xs text-slate-500">
        Bought at £7.0m: you only keep half of each rise, rounded down to £0.1m.
      </figcaption>
    </figure>
  );
}

export default function HowPriceChangesWork() {
  const rows = [70, 71, 72, 73, 74, 75, 69, 68];
  return (
    <>
      <p>
        Every Fantasy Premier League player has a price, and that price doesn’t stay still. Over a season a popular
        player can rise by £1m or more, while an out-of-form star can drop just as far. Understanding how prices change
        helps you keep your team value growing, time your transfers better, and avoid being priced out of the players
        you want. This guide explains how it works in the <strong>2026/27 season</strong>.
      </p>

      <h2 id="why">Why prices change</h2>
      <p>
        FPL prices follow supply and demand. When lots of managers <strong>buy</strong> a player, his price goes up.
        When lots of managers <strong>sell</strong> him, it goes down. Goals, assists and points don’t change a price
        directly: they only matter because they make managers transfer the player in or out.
      </p>
      <HowItHappens />
      <p>
        What counts is <strong>net transfers</strong> (transfers in minus transfers out) compared with how many managers
        already own the player. A player owned by very few managers needs fewer transfers to rise than someone already
        in half of all teams. FPL doesn’t publish the exact formula, but the principle is simple: the bigger the
        pressure relative to his ownership, the sooner his price moves.
      </p>
      <p>A few rules worth knowing:</p>
      <ul>
        <li>
          A player’s price changes by <strong>£0.1m at a time</strong>, and <strong>at most once a day</strong>.
        </li>
        <li>
          Transfers made with a <strong>Wildcard</strong> or <strong>Free Hit</strong> don’t count towards price
          changes, so a wave of Wildcards can’t push prices around.
        </li>
        <li>Pressure carries over from day to day until the player either changes price or the demand fades.</li>
      </ul>

      <h2 id="progress">Who is about to change price?</h2>
      <p>
        This season FPL’s own data includes a <strong>progress figure</strong> for every player: how close he is to his
        next rise or fall. When it gets close to 100%, a change is likely at the next update. Here are the players
        closest right now:
      </p>
      <ClosestToChange />
      <p>
        You can also see this season’s biggest risers and fallers on our <Link to="/player-stats">Player Stats</Link>{' '}
        page, and every player’s price history (with each rise and fall) by tapping their name anywhere on FPL House.
      </p>

      <h2 id="when">When prices change</h2>
      <p>
        Price changes happen <strong>once a day, overnight in the UK</strong>. They usually appear within a few minutes
        after midnight UK time, which is around 6:30 in the morning in Myanmar. If you’re planning a transfer for a
        player who is about to rise, make it before then.
      </p>
      <WhenItHappens />

      <h2 id="selling">Your selling price: the 50% rule</h2>
      <p>
        This is the part that surprises most new managers. When you sell a player whose price has gone up since you
        bought him, you <strong>don’t get the full current price</strong>. FPL keeps half of the profit, rounded down to
        the nearest £0.1m. If his price has <em>fallen</em>, though, you take the full loss.
      </p>
      <SellPriceChart />
      <div className="card my-4 overflow-x-auto p-1">
        <table>
          <thead>
            <tr>
              <th>Bought for</th>
              <th>Price now</th>
              <th>Change</th>
              <th>You sell for</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((now) => {
              const diff = now - 70;
              const sell = sellPrice(70, now);
              return (
                <tr key={now}>
                  <td>{money(70)}</td>
                  <td className="font-semibold text-white">{money(now)}</td>
                  <td className={`whitespace-nowrap ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : ''}`}>
                    {diff === 0 ? '–' : `${diff > 0 ? '+' : '−'}£${(Math.abs(diff) / 10).toFixed(1)}m`}
                  </td>
                  <td className="font-semibold text-amber-300">{money(sell)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        So a single £0.1m rise earns you nothing when you sell; it takes two rises to gain £0.1m. That’s why a player’s
        price and your <strong>selling price</strong> can be different. The FPL transfers page shows your selling price
        for each player in your team.
      </p>

      <h2 id="value">Team value: why it matters</h2>
      <p>
        Your <strong>team value</strong> is what your 15 players are worth, plus the money in the bank. Buying players
        before they rise slowly grows the money you have to spend, which can be the difference between affording a £14m
        captain or not later in the season. Falling prices do the opposite, and losses are taken in full.
      </p>

      <h2 id="tips">Tips for dealing with price changes</h2>
      <ol>
        <li>
          <strong>Don’t chase every rise.</strong> Taking a −4 hit to beat a £0.1m rise is almost never worth it. Points
          matter more than team value.
        </li>
        <li>
          <strong>Move early on a player you really want.</strong> If a player you have already decided to buy is close
          to rising, transfer him in before the overnight update.
        </li>
        <li>
          <strong>Sell injured players quickly.</strong> When a big player gets injured, thousands of managers sell him
          at once and his price can drop in the next update.
        </li>
        <li>
          <strong>Remember the 50% rule.</strong> A player who has risen £0.1m since you bought him is worth the same to
          sell as the day you bought him.
        </li>
        <li>
          <strong>Plan around Wildcards.</strong> Since Wildcard transfers don’t move prices, you can rebuild your team
          without your own transfers pushing prices up against you.
        </li>
      </ol>
      <p>
        New to FPL? Start with our guide to{' '}
        <Link to="/articles/how-to-play-fpl">how to play Fantasy Premier League</Link>, which covers squad rules,
        points, transfers and chips.
      </p>
    </>
  );
}
