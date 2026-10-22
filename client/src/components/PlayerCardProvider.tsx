import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useBootstrapStatic } from '../hooks/useFplApi';
import { getPlayerImageUrl } from '../utils/playerPhoto';
import PlayerDetailCard from './PlayerDetailCard';

/** Opens the detailed player card (price, form, next 5 fixtures, recent points) for an FPL element id. */
const OpenPlayerContext = createContext<(elementId: number) => void>(() => {});

export function usePlayerCard() {
  return useContext(OpenPlayerContext);
}

/**
 * Props that make any card, list row or table row open the player card on click, Enter or Space.
 * Spread onto the element: <li {...playerCardProps(openPlayer, e.id, e.web_name)}>.
 */
export function playerCardProps(open: (id: number) => void, elementId: number, name: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `View ${name}`,
    onClick: () => open(elementId),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(elementId);
      }
    },
  };
}

/** One shared player card for every page (the pitch view keeps its own). */
export default function PlayerCardProvider({ children }: { children: ReactNode }) {
  const { data: bootstrap } = useBootstrapStatic();
  const [elementId, setElementId] = useState<number | null>(null);
  const open = useCallback((id: number) => setElementId(id), []);

  const element = useMemo(
    () => (elementId != null ? bootstrap?.elements.find((e) => e.id === elementId) ?? null : null),
    [bootstrap?.elements, elementId]
  );
  const teamName = element ? bootstrap?.teams.find((t) => t.id === element.team)?.name ?? '' : '';

  return (
    <OpenPlayerContext.Provider value={open}>
      {children}
      {element && (
        <PlayerDetailCard
          element={element}
          teamName={teamName}
          teams={bootstrap?.teams ?? []}
          imageUrl={getPlayerImageUrl(element, teamName)}
          onClose={() => setElementId(null)}
        />
      )}
    </OpenPlayerContext.Provider>
  );
}
