import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isInAppBrowser, useInstall, type InstallPlatform } from '../install';

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  );
}

/** Safari's Share icon (square with an arrow), so the steps match what's on screen. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline h-4 w-4 align-[-3px] text-sky-400"
      aria-label="Share"
    >
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function Steps({ platform }: { platform: InstallPlatform }) {
  const inApp = isInAppBrowser();
  const browser = platform === 'ios' ? 'Safari' : 'Chrome';
  const steps =
    platform === 'ios'
      ? [
          <>
            Tap the Share button <ShareIcon /> at the bottom of Safari.
          </>,
          <>
            Scroll down and tap <b>Add to Home Screen</b>.
          </>,
          <>
            Tap <b>Add</b>.
          </>,
        ]
      : [
          <>
            Tap the menu <b>⋮</b> at the top right of Chrome.
          </>,
          <>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </>,
          <>
            Tap <b>Install</b>.
          </>,
        ];
  return (
    <>
      {inApp && (
        <p className="mb-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200 ring-1 ring-inset ring-amber-400/30">
          You're in an app's built-in browser, which can't add sites to your home screen. Open this page in{' '}
          <b>{browser}</b> first (use the <b>⋯</b> menu → <b>Open in {platform === 'ios' ? 'Safari' : 'browser'}</b>).
        </p>
      )}
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm leading-snug text-slate-200">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fpl-accent text-xs font-bold text-fpl-ink">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Header button to add FPL House to the phone's home screen. Opens the browser's install prompt where there is one
 * (Android Chrome etc.); otherwise, or on iPhone, shows the steps. Hidden on desktop and once installed.
 */
export default function InstallButton() {
  const { available, platform, prompt } = useInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHelpOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen]);

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (prompt ? prompt() : setHelpOpen(true))}
        className="btn-ghost px-2.5"
        title="Add FPL House to your home screen"
      >
        <DownloadIcon />
        <span>Install</span>
      </button>

      {/* Rendered on <body>: the header's backdrop blur would otherwise trap a fixed overlay inside the header. */}
      {helpOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onClick={() => setHelpOpen(false)}
          >
            <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
                <div>
                  <h2 id="install-title" className="font-display text-base font-bold text-white">
                    Install FPL House
                  </h2>
                  <p className="text-xs text-slate-400">Open it from your home screen like an app.</p>
                </div>
              </div>
              <Steps platform={platform} />
              <button
                type="button"
                className="btn-primary mt-5 w-full justify-center"
                onClick={() => setHelpOpen(false)}
              >
                Got it
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
