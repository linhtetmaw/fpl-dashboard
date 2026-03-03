import type { PlayerPoints } from '../types/fpl';
import type { BootstrapStatic, FplElement } from '../types/fpl';

/** Build search name for third-party photo API (TheSportsDB): "First_Last" or web_name. */
function getPlayerPhotoQuery(element: FplElement | undefined): { name: string; code: string } | null {
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
function getPlayerImageUrl(
  element: FplElement | undefined,
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

/** Group starting XI by element_type: 1=GKP, 2=DEF, 3=MID, 4=FWD. Order: FWD top → GKP bottom (vertical pitch). */
function getFormationRows(players: PlayerPoints[]): PlayerPoints[][] {
  const starting = players.filter((p) => !p.is_on_bench).sort((a, b) => a.position - b.position);
  const byType: PlayerPoints[][] = [[], [], [], []];
  for (const p of starting) {
    const idx = p.element_type >= 1 && p.element_type <= 4 ? p.element_type - 1 : 0;
    byType[idx].push(p);
  }
  return byType;
}

function getBenchPlayers(players: PlayerPoints[]): PlayerPoints[] {
  return players.filter((p) => p.is_on_bench).sort((a, b) => a.position - b.position);
}

interface PitchViewProps {
  players: PlayerPoints[];
  bootstrap: BootstrapStatic | undefined;
}

export default function PitchView({ players, bootstrap }: PitchViewProps) {
  const rows = getFormationRows(players);
  const [gkRow, defRow, midRow, fwdRow] = rows;
  const elementById = new Map<number, FplElement>(
    (bootstrap?.elements ?? []).map((e) => [e.id, e])
  );
  const teamById = new Map<number, string>(
    (bootstrap?.teams ?? []).map((t) => [t.id, t.name])
  );

  const bench = getBenchPlayers(players);

  /** Shared card box: border, background, rounded. Used for pitch and bench. */
  const cardBoxClass =
    'flex flex-col items-center rounded-lg border border-fpl-border bg-fpl-dark/80 px-2 py-2 flex-shrink-0';

  const renderPlayerCard = (
    p: PlayerPoints,
    opts: { imageSize?: string; nameClass?: string; pointsClass?: string; maxNameWidth?: string }
  ) => {
    const {
      imageSize = 'w-12 h-14 sm:w-14 sm:h-[68px]',
      nameClass = 'text-xs font-medium',
      pointsClass = 'text-xs font-semibold',
      maxNameWidth = 'max-w-[72px]',
    } = opts;
    const element = elementById.get(p.element_id);
    const teamName = element ? teamById.get(element.team) : undefined;
    const imageUrl = getPlayerImageUrl(element, teamName);
    return (
      <div key={`${p.element_id}-${p.position}`} className={cardBoxClass}>
        <div
          className={`relative rounded overflow-hidden bg-fpl-dark border border-fpl-border flex-shrink-0 ${imageSize}`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={p.web_name}
              className="w-full h-full object-cover object-top"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling;
                if (fallback instanceof HTMLElement) fallback.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`absolute inset-0 flex items-center justify-center bg-fpl-card text-slate-400 font-bold text-xs ${imageUrl ? 'hidden' : ''}`}
            aria-hidden={!!imageUrl}
          >
            {p.web_name.slice(0, 2).toUpperCase()}
          </div>
          {p.is_captain && (
            <span className="absolute top-0 right-0 bg-fpl-accent text-white text-[8px] font-bold px-0.5 rounded-bl">
              C
            </span>
          )}
          {p.is_vice_captain && (
            <span className="absolute top-0 left-0 bg-slate-500/90 text-white text-[8px] font-bold px-0.5 rounded-br">
              VC
            </span>
          )}
        </div>
        <p className={`mt-1 text-slate-300 truncate text-center ${maxNameWidth} ${nameClass}`}>
          {p.web_name}
        </p>
        <p className={`text-fpl-accent ${pointsClass}`}>{p.total_points_effective} pts</p>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-fpl-border bg-[#0d2818] overflow-hidden">
      {/* Vertical pitch: compact rows, each player in a card box */}
      <div className="mx-auto max-w-md">
        <div
          className="relative rounded-lg border-2 border-[#2d5a3d] bg-gradient-to-b from-[#0d2818] to-[#163d24] py-3 px-3 sm:py-4 sm:px-4"
          style={{ minHeight: '320px' }}
        >
          {/* Pitch outline + vertical centre line */}
          <div className="absolute inset-3 sm:inset-4 rounded border-2 border-[#2d5a3d]/60 pointer-events-none" />
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#2d5a3d]/60 -translate-x-1/2 pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#2d5a3d]/60 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          {/* FWD (top) */}
          <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
            {(fwdRow ?? []).map((p) => renderPlayerCard(p, {}))}
          </div>
          {/* MID */}
          <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
            {(midRow ?? []).map((p) => renderPlayerCard(p, {}))}
          </div>
          {/* DEF */}
          <div className="flex justify-center gap-1.5 sm:gap-2 mb-2">
            {(defRow ?? []).map((p) => renderPlayerCard(p, {}))}
          </div>
          {/* GKP (bottom) */}
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {(gkRow ?? []).map((p) => renderPlayerCard(p, {}))}
          </div>
        </div>
      </div>

      {/* Bench: same card style as pitch, slightly larger */}
      {bench.length > 0 && (
        <div className="border-t border-fpl-border bg-fpl-card/80 px-3 py-3 sm:px-5 sm:py-4">
          <p className="text-slate-400 font-medium text-xs sm:text-sm mb-2">Bench</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {bench.map((p) =>
              renderPlayerCard(p, {
                imageSize: 'w-12 h-14 sm:w-14 sm:h-[72px]',
                nameClass: 'text-xs font-medium',
                pointsClass: 'text-xs font-semibold',
                maxNameWidth: 'max-w-[76px]',
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
