/**
 * "Install" (add to home screen) support. Chrome, Edge and Samsung Internet on Android fire `beforeinstallprompt`
 * once, early, when the site can be installed; we keep that event so the Install button can open the browser's own
 * install prompt later. iPhone Safari has no such event, so there the button shows instructions instead.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Show our button instead of the browser's mini-infobar.
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
  // The service worker is what makes the site installable (see public/sw.js). Production only, so it never gets in
  // the way of the dev server.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

/** Opened from the home-screen icon (already installed). */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type InstallPlatform = 'ios' | 'android' | 'other';

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/** In-app browsers (Facebook, Messenger, Instagram, Telegram, Viber, LINE…) can't add sites to the home screen. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|Telegram|Viber|wv\)/i.test(navigator.userAgent);
}

/**
 * Whether to show the Install button, and what it does: `prompt` opens the browser's install prompt (Android
 * Chrome etc.); otherwise the button shows instructions for this platform. Hidden on desktop and once installed.
 */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const platform = detectPlatform();
  // Phones and tablets only (the button is for adding to the home screen).
  const available = !installed && !isStandalone() && platform !== 'other';

  const prompt = deferred
    ? async () => {
        const e = deferred!;
        deferred = null;
        await e.prompt();
        const { outcome } = await e.userChoice;
        if (outcome === 'accepted') installed = true;
        notify();
      }
    : null;

  return { available, platform, prompt };
}
