/** Light/dark theme. Dark is the default; a chosen theme is remembered on this device. */
export type Theme = 'dark' | 'light';

const KEY = 'fpl_theme';
/** Browser UI colour (address bar on phones) per theme, matching the page background. */
const THEME_COLOR: Record<Theme, string> = { dark: '#13001a', light: '#F5F2F6' };

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
}
