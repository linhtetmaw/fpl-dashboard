import type { FplElement } from '../types/fpl';

/** Build search name for third-party photo API (TheSportsDB): "First_Last" or web_name. */
function getPlayerPhotoQuery(
  element: Pick<FplElement, 'first_name' | 'second_name' | 'web_name' | 'code' | 'photo'> | undefined
): { name: string; code: string } | null {
  if (!element) return null;
  const first = element.first_name?.trim() ?? '';
  const second = element.second_name?.trim() ?? '';
  const name = first && second ? `${first}_${second}`.replace(/\s+/g, '_') : element.web_name?.replace(/\s+/g, '_') ?? '';
  const rawCode = element.code ?? element.photo;
  const code =
    typeof rawCode === 'number'
      ? String(rawCode)
      : typeof rawCode === 'string'
        ? rawCode.replace(/\D/g, '')
        : '';
  if (!name && !code) return null;
  return { name: name || '', code };
}

/** Player photo URL: TheSportsDB first (with team so we get the right player, e.g. Gabriel Magalhaes at Arsenal), server falls back to PL CDN. */
export function getPlayerImageUrl(
  element: Pick<FplElement, 'first_name' | 'second_name' | 'web_name' | 'code' | 'photo'> | undefined,
  teamName: string | undefined
): string | null {
  const q = getPlayerPhotoQuery(element);
  if (!q || (!q.name && !q.code)) return null;
  const params = new URLSearchParams();
  if (q.name) params.set('name', q.name);
  if (q.code) params.set('code', q.code);
  if (teamName?.trim()) params.set('team', teamName.trim());
  return `/api/player-photo?${params.toString()}`;
}
