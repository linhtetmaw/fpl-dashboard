import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const TELEGRAM_CHANNEL = 'https://t.me/fplhouseapp';
const PHONE = '+959780007978';
const PHONE_DISPLAY = '+95 9 780 007 978';
/** Shown as "Last updated" on the privacy policy; change it whenever the policy changes. */
const PRIVACY_UPDATED = '29 October 2026';

function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 text-sm text-slate-500">{intro}</p>}
      <div className="article mt-4">{children}</div>
    </main>
  );
}

export function AboutPage() {
  return (
    <InfoPage title="About FPL House">
      <p>
        FPL House is a free companion site for <strong>Fantasy Premier League</strong> managers. We built it because we
        wanted one place to follow our own teams and mini-leagues live during the gameweek, without logging in and
        without refreshing the official app every few minutes.
      </p>
      <h2>What you can do here</h2>
      <ul>
        <li>
          <strong>Live points</strong> for any FPL team, including automatic substitutions and provisional bonus points.
        </li>
        <li>
          <strong>Live mini-league tables</strong> showing every rival’s captain, chip and players still to play.
        </li>
        <li>
          <strong>Player stats</strong>: most captained, xG and xA leaders, price risers and fallers.
        </li>
        <li>
          <strong>Fixtures and results</strong> in Myanmar time, with a fixture difficulty table.
        </li>
        <li>
          <strong>Injury and suspension news</strong>, and a page for every Premier League club.
        </li>
        <li>
          A <strong>Squad Planner</strong> to try out teams within the £100m budget.
        </li>
        <li>
          <Link to="/articles">Guides and articles</Link> explaining the rules and strategy of FPL.
        </li>
      </ul>
      <h2>Who we are</h2>
      <p>
        We’re a small team of FPL players who use FPL House every gameweek ourselves. We also share FPL tips and
        previews on our <Link to="/opinions">video series</Link> and our{' '}
        <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer">
          Telegram channel
        </a>
        .
      </p>
      <h2>Where the data comes from</h2>
      <p>
        Player, fixture and league data comes from the public Fantasy Premier League API and updates throughout each
        gameweek. FPL House is an independent fan site. It is not affiliated with, endorsed by or connected to the
        Premier League or Fantasy Premier League.
      </p>
      <p>
        Questions or ideas? <Link to="/contact">Get in touch</Link>.
      </p>
    </InfoPage>
  );
}

export function ContactPage() {
  return (
    <InfoPage title="Contact us">
      <p>
        We’d love to hear from you, whether it’s a bug report, a feature idea, a question about the rules of FPL, or an
        advertising or partnership enquiry.
      </p>
      <div className="card my-6 p-5">
        <p className="eyebrow">Viber / WhatsApp</p>
        <p className="mt-2">
          Call or message us on{' '}
          <a href={`https://wa.me/${PHONE.slice(1)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{' '}
          or <a href={`viber://chat?number=${encodeURIComponent(PHONE)}`}>Viber</a>:{' '}
          <a href={`tel:${PHONE}`} className="whitespace-nowrap">
            {PHONE_DISPLAY}
          </a>
        </p>
      </div>
      <div className="card my-6 p-5">
        <p className="eyebrow">Telegram</p>
        <p className="mt-2">
          Follow updates and reach us through our Telegram channel:{' '}
          <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer">
            t.me/fplhouseapp
          </a>
        </p>
      </div>
      <p>
        When reporting a problem, it helps to include your FPL team ID (if it’s about your team), the page you were on,
        and what device or browser you were using. We usually reply within a few days.
      </p>
    </InfoPage>
  );
}

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy Policy" intro={`Last updated: ${PRIVACY_UPDATED}`}>
      <p>
        This policy explains what information FPL House (fplhouse.app) collects when you use the site, how it is used,
        and the choices you have.
      </p>

      <h2>Information you give us</h2>
      <ul>
        <li>
          <strong>FPL team ID.</strong> When you enter your team ID, it is saved in your own browser (local storage) so
          your team opens next time. FPL team IDs and their public data are already published by the official FPL game.
        </li>
        <li>
          <strong>Telegram login (optional).</strong> If you log in with Telegram to save squads in the Squad Planner, we
          receive your Telegram user ID, name and username from Telegram. We store your user ID with the squads you save,
          and set a login cookie so you stay logged in. If you allow it during login, our Telegram bot may send you one
          message with an invite to our channel. We never see your phone number or your messages.
        </li>
      </ul>

      <h2>Information collected automatically</h2>
      <ul>
        <li>
          <strong>Analytics.</strong> We use Google Analytics to understand which pages are visited and how the site is
          used. Google Analytics uses cookies and collects information such as your approximate location, device,
          browser and the pages you view. It does not tell us who you are.
        </li>
        <li>
          <strong>Server logs.</strong> Like most websites, our server keeps short-lived technical logs (such as IP
          address and pages requested) to keep the site secure and working.
        </li>
        <li>
          <strong>Preferences.</strong> Settings such as light or dark mode and your time zone are saved in your
          browser’s local storage.
        </li>
      </ul>

      <h2>Advertising</h2>
      <p>
        FPL House may show advertisements served by Google AdSense and other third-party ad partners. These partners
        may use cookies and similar technologies to show ads based on your previous visits to this and other websites.
      </p>
      <ul>
        <li>
          Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to
          this site and/or other sites on the internet.
        </li>
        <li>
          You can opt out of personalised advertising from Google by visiting{' '}
          <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
            Google Ads Settings
          </a>
          , or opt out of many third-party vendors’ personalised ads at{' '}
          <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
            aboutads.info
          </a>
          .
        </li>
        <li>
          Learn more about how Google uses data in{' '}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            How Google uses information from sites that use its services
          </a>
          .
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Cookies are small files stored by your browser. We use a login cookie (only if you log in with Telegram), and
        Google Analytics and advertising partners may set their own cookies as described above. You can block or delete
        cookies in your browser settings; the site will still work, but you may need to log in again.
      </p>

      <h2>How we use information</h2>
      <p>
        We use the information above only to run and improve FPL House: showing your team and leagues, saving your
        squads, keeping the site secure, and understanding which features people use. We do not sell your personal
        information.
      </p>

      <h2>Third-party services</h2>
      <p>
        FPL House loads data and content from third parties, including the official Fantasy Premier League API,
        Telegram (login), YouTube (embedded videos) and Google (analytics and ads). Each has its own privacy policy.
      </p>

      <h2>Children</h2>
      <p>FPL House is not directed at children under 13, and we do not knowingly collect their personal information.</p>

      <h2>Your choices</h2>
      <p>
        You can clear your saved team ID and preferences at any time by clearing your browser’s site data. To have
        squads saved with your Telegram account deleted, <Link to="/contact">contact us</Link>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The date at the top shows when it was last changed.
      </p>
    </InfoPage>
  );
}
