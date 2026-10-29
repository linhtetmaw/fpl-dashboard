import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Scoring for the 2026/27 season, checked against the official FPL game settings (bootstrap-static game_config). */
const POINTS: { action: string; gkp: string; def: string; mid: string; fwd: string }[] = [
  { action: 'Plays up to 60 minutes', gkp: '1', def: '1', mid: '1', fwd: '1' },
  { action: 'Plays 60 minutes or more', gkp: '2', def: '2', mid: '2', fwd: '2' },
  { action: 'Scores a goal', gkp: '10', def: '6', mid: '5', fwd: '4' },
  { action: 'Assists a goal', gkp: '3', def: '3', mid: '3', fwd: '3' },
  { action: 'Clean sheet (60+ minutes played)', gkp: '4', def: '4', mid: '1', fwd: '–' },
  { action: 'Every 3 saves', gkp: '1', def: '–', mid: '–', fwd: '–' },
  { action: 'Saves a penalty', gkp: '5', def: '–', mid: '–', fwd: '–' },
  { action: 'Defensive contribution', gkp: '–', def: '2', mid: '2', fwd: '2' },
  { action: 'Bonus points (best 3 players in the match)', gkp: '1–3', def: '1–3', mid: '1–3', fwd: '1–3' },
  { action: 'Every 2 goals conceded', gkp: '−1', def: '−1', mid: '–', fwd: '–' },
  { action: 'Misses a penalty', gkp: '−2', def: '−2', mid: '−2', fwd: '−2' },
  { action: 'Yellow card', gkp: '−1', def: '−1', mid: '−1', fwd: '−1' },
  { action: 'Red card', gkp: '−3', def: '−3', mid: '−3', fwd: '−3' },
  { action: 'Own goal', gkp: '−2', def: '−2', mid: '−2', fwd: '−2' },
];

const CHIPS: { name: string; what: string; when: string }[] = [
  {
    name: 'Wildcard',
    what: 'Make as many transfers as you like in one gameweek without losing any points. The changes are permanent.',
    when: 'Your team has several injured or out-of-form players, or a run of fixtures means you want to rebuild.',
  },
  {
    name: 'Free Hit',
    what: 'Make unlimited free transfers for one gameweek only. Your squad goes back to how it was at the next deadline.',
    when: 'Blank gameweeks (many teams don’t play) or double gameweeks (some teams play twice).',
  },
  {
    name: 'Bench Boost',
    what: 'The points scored by your four substitutes count as well as your starting eleven, for one gameweek.',
    when: 'A double gameweek where all 15 of your players have a match, ideally two.',
  },
  {
    name: 'Triple Captain',
    what: 'Your captain scores triple points instead of double for one gameweek.',
    when: 'Your best player has two matches in one gameweek, or a very easy home fixture.',
  },
];

function Table({ children }: { children: ReactNode }) {
  return <div className="card my-4 overflow-x-auto p-1">{children}</div>;
}

export default function HowToPlayFpl() {
  return (
    <>
      <p>
        Fantasy Premier League (FPL) is the official fantasy football game of the English Premier League, played by more
        than ten million people every season. You pick a squad of real Premier League players, and every weekend they
        earn points for you based on what they actually do on the pitch: goals, assists, clean sheets, saves and more.
        This guide explains everything a new player needs for the <strong>2026/27 season</strong>.
      </p>

      <h2 id="squad">1. Build your squad: £100m and 15 players</h2>
      <p>You start with a budget of <strong>£100.0m</strong> to buy a squad of exactly 15 players:</p>
      <ul>
        <li>2 goalkeepers</li>
        <li>5 defenders</li>
        <li>5 midfielders</li>
        <li>3 forwards</li>
      </ul>
      <p>
        You can pick <strong>no more than 3 players from any one Premier League club</strong>. Every player has a price
        set by FPL, from about £4.0m for a backup defender to £14m or more for the biggest stars. The skill is spending
        your money well: a few premium players who score big, plus cheaper players who start every week.
      </p>
      <p>
        Before you pick, try different combinations in our <Link to="/squad-planner">Squad Planner</Link>, which checks
        the budget and club limits for you.
      </p>

      <h2 id="team">2. Pick your starting eleven each gameweek</h2>
      <p>
        The season is split into 38 <strong>gameweeks</strong>. Before each one you choose 11 starters from your 15
        players. Only the starters score points. Your team must include:
      </p>
      <ul>
        <li>exactly 1 goalkeeper</li>
        <li>at least 3 defenders</li>
        <li>at least 2 midfielders</li>
        <li>at least 1 forward</li>
      </ul>
      <p>
        So formations like 3-4-3, 3-5-2, 4-4-2, 4-5-1 and 5-3-2 are all allowed. The other four players sit on your{' '}
        <strong>bench</strong>, in an order you choose.
      </p>
      <h3>The deadline</h3>
      <p>
        Every gameweek has a <strong>deadline 90 minutes before the first match kicks off</strong>. Any changes you make
        after the deadline count for the next gameweek, not this one. Our deadline countdown at the top of every page
        shows exactly how long you have left.
      </p>
      <h3>Automatic substitutions</h3>
      <p>
        If one of your starters doesn’t play at all, FPL automatically brings on a bench player once the gameweek is
        over. Your bench is used in order: the first substitute comes on first, as long as the swap keeps a valid
        formation (for example, you can never drop below 3 defenders). Your substitute goalkeeper can only replace your
        starting goalkeeper. That’s why it pays to put your most reliable bench player first.
      </p>

      <h2 id="captain">3. Captain and vice-captain</h2>
      <p>
        Each gameweek you choose a <strong>captain</strong>, whose points are <strong>doubled</strong>. If your captain
        scores 12 points, you get 24. You also choose a <strong>vice-captain</strong>: if your captain doesn’t play,
        the vice-captain’s points are doubled instead.
      </p>
      <p>
        Picking the right captain is the biggest single decision of every gameweek. Most managers pick an in-form
        attacker with an easy fixture. Our <Link to="/player-stats">Player Stats</Link> page shows who is most captained
        and who is scoring the most.
      </p>

      <h2 id="points">4. How players score points</h2>
      <p>
        Points depend on a player’s <strong>position</strong>. A goal from a defender is worth more than a goal from a
        forward, because defenders score less often. Here is the full scoring table for 2026/27:
      </p>
      <Table>
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th className="text-center">GKP</th>
              <th className="text-center">DEF</th>
              <th className="text-center">MID</th>
              <th className="text-center">FWD</th>
            </tr>
          </thead>
          <tbody>
            {POINTS.map((row) => (
              <tr key={row.action}>
                <td className="text-slate-200">{row.action}</td>
                {[row.gkp, row.def, row.mid, row.fwd].map((v, i) => (
                  <td
                    key={i}
                    className={`whitespace-nowrap text-center font-semibold ${
                      v.startsWith('−') ? 'text-rose-400' : v === '–' ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Table>
      <h3>Clean sheets</h3>
      <p>
        A clean sheet means the player’s team didn’t concede a goal while he was on the pitch, and he played at least 60
        minutes. Goalkeepers and defenders get 4 points for it, midfielders get 1.
      </p>
      <h3>Defensive contributions</h3>
      <p>
        Introduced in 2025/26, defensive contribution points reward players who do the hard work without the ball. A
        player earns <strong>2 points</strong> in a match when he reaches:
      </p>
      <ul>
        <li>
          <strong>Defenders:</strong> 10 combined clearances, blocks, interceptions and tackles.
        </li>
        <li>
          <strong>Midfielders and forwards:</strong> 12 combined clearances, blocks, interceptions, tackles and ball
          recoveries.
        </li>
      </ul>
      <p>The bonus is capped at 2 points per match, however many actions he makes beyond the target.</p>
      <h3>Bonus points</h3>
      <p>
        After every match, the three best players according to FPL’s <strong>Bonus Points System (BPS)</strong> get
        extra points: <strong>3</strong> for the best, <strong>2</strong> for second and <strong>1</strong> for third.
        BPS is a detailed score built from dozens of match statistics (goals, key passes, tackles, saves and so on).
        Bonus points are added after the match, so during live games they show as <em>provisional</em>. On FPL House,
        your live points already include the provisional bonus.
      </p>

      <h2 id="transfers">5. Transfers</h2>
      <p>
        After the first gameweek you can change your squad by making <strong>transfers</strong>: selling one player and
        buying another in the same position.
      </p>
      <ul>
        <li>
          You get <strong>1 free transfer</strong> every gameweek.
        </li>
        <li>
          If you don’t use it, it rolls over. You can save up to <strong>5 free transfers</strong>.
        </li>
        <li>
          Every extra transfer beyond your free ones costs <strong>4 points</strong> (a “hit”).
        </li>
      </ul>
      <h3>Player prices go up and down</h3>
      <p>
        Prices change overnight depending on how many managers are buying or selling a player. Popular players rise in
        price, and players who are being sold drop. When you sell a player whose price has risen, you only keep{' '}
        <strong>half of the profit</strong> (rounded down to the nearest £0.1m). For example, if you bought a player at
        £7.0m and he rises to £7.5m, you sell him for £7.2m. Losses, though, are taken in full. Watch the price risers
        and fallers on our <Link to="/player-stats">Player Stats</Link> page.
      </p>

      <h2 id="chips">6. Chips: your special boosts</h2>
      <p>
        Chips are one-off boosts you can play to get extra points. In 2026/27 you get <strong>two of each chip</strong>
        : one set to use between Gameweek 1 and Gameweek 19, and a second set for Gameweek 20 to 38. Chips from the
        first half don’t carry over. If you haven’t used them by the Gameweek 19 deadline, you lose them.
      </p>
      <div className="my-4 grid gap-3 sm:grid-cols-2">
        {CHIPS.map((chip) => (
          <div key={chip.name} className="card p-4">
            <h3 className="!mt-0 text-fpl-brand">{chip.name}</h3>
            <p className="!my-0">{chip.what}</p>
            <p className="!mb-0 mt-3 text-sm text-slate-400">
              <strong>Best time:</strong> {chip.when}
            </p>
          </div>
        ))}
      </div>
      <p>A few rules to remember:</p>
      <ul>
        <li>You can play only one chip per gameweek.</li>
        <li>Wildcard and Free Hit can’t be used in Gameweek 1, since you can build your squad for free before then.</li>
        <li>Once a gameweek’s deadline passes, a chip you’ve played can’t be cancelled.</li>
      </ul>

      <h2 id="leagues">7. Leagues: play against your friends</h2>
      <p>
        Every manager is automatically ranked against everyone in the world (the <strong>overall rank</strong>), and
        against fans of the same club and players in the same country. The real fun, though, is{' '}
        <strong>mini-leagues</strong>: private leagues with friends, family or colleagues, joined with a code. You can
        join up to 30 private leagues.
      </p>
      <ul>
        <li>
          <strong>Classic leagues</strong> rank everyone by total points.
        </li>
        <li>
          <strong>Head-to-head leagues</strong> match you against one opponent each gameweek: 3 points for a win, 1 for
          a draw.
        </li>
      </ul>
      <p>
        On <Link to="/">Your Team</Link>, enter your FPL team ID to follow your mini-leagues live, with auto-subs, each
        rival’s captain and chips, and the gameweek’s winner.
      </p>

      <h2 id="tips">8. Five tips for your first season</h2>
      <ol>
        <li>
          <strong>Pick players who start.</strong> A cheap player who plays 90 minutes every week beats a bargain who
          sits on the bench. Check the <Link to="/player-news">injury and suspension news</Link> before every deadline.
        </li>
        <li>
          <strong>Look at the fixtures.</strong> Players facing weaker teams score more. Our{' '}
          <Link to="/fixtures">fixture difficulty table</Link> shows the next few matches for every club.
        </li>
        <li>
          <strong>Don’t chase last week’s points.</strong> One big score doesn’t make a player a good buy. Look at form
          over several matches, and at expected goals (xG) and assists (xA).
        </li>
        <li>
          <strong>Avoid too many hits.</strong> A −4 transfer has to earn back more than 4 points just to break even.
          Saving free transfers gives you flexibility later.
        </li>
        <li>
          <strong>Plan your chips.</strong> Double and blank gameweeks are announced during the season. Keeping your
          Free Hit and Bench Boost for them is usually worth far more than playing them early.
        </li>
      </ol>
      <p>
        Good luck this season. If you have a question about the rules, send it to us on our{' '}
        <Link to="/contact">contact page</Link>.
      </p>
    </>
  );
}
