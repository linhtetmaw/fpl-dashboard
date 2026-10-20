import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getYoutubePlaylistItems } from '../api/fpl';

export default function OpinionsPage() {
  const playlistId = 'PL-H85EgZCecNjMXv90okyPHlslYz0ZThW';
  const { data, isLoading, error } = useQuery({
    queryKey: ['youtube', 'playlist', playlistId],
    queryFn: () => getYoutubePlaylistItems(playlistId),
    staleTime: 5 * 60 * 1000,
  });

  const firstVideoId = data?.items?.[0]?.videoId ?? null;
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const activeVideoId = selectedVideoId ?? firstVideoId;

  const playerUrl = useMemo(() => {
    if (!activeVideoId) return null;
    // Keep playlist context, but play the selected video.
    return `https://www.youtube.com/embed/${activeVideoId}?list=${encodeURIComponent(playlistId)}`;
  }, [activeVideoId, playlistId]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-white">Opinions</h2>
          <p className="text-slate-400 text-sm mt-1">Our latest videos.</p>
        </div>
      </div>

      {/* Latest video */}
      <div className="rounded-xl border border-fpl-border bg-fpl-card overflow-hidden">
        <div className="px-4 py-3 border-b border-fpl-border">
          <h3 className="text-sm font-semibold text-white">Latest video</h3>
        </div>
        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
          {playerUrl ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={playerUrl}
              title="Opinions playlist player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              {isLoading ? 'Loading videos…' : 'No videos found.'}
            </div>
          )}
        </div>
      </div>

      {/* All videos grid (two columns) */}
      <div className="mt-6 rounded-xl border border-fpl-border bg-fpl-card overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-fpl-border">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">All videos</h3>
            <span className="text-[11px] text-slate-500">{data?.items?.length ?? 0}</span>
          </div>
          {error ? <p className="text-xs text-rose-300 mt-2">Failed to load playlist.</p> : null}
        </div>

        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data?.items ?? []).map((v) => {
              const isActive = v.videoId === activeVideoId;
              return (
                <button
                  key={v.videoId}
                  type="button"
                  onClick={() => setSelectedVideoId(v.videoId)}
                  className={`text-left rounded-lg border px-2 py-2 transition-colors ${
                    isActive
                      ? 'border-fpl-accent bg-fpl-dark/60'
                      : 'border-fpl-border bg-fpl-dark/30 hover:border-fpl-accent/50 hover:bg-fpl-dark/50'
                  }`}
                  title={v.title}
                >
                  <div className="aspect-video w-full overflow-hidden rounded-md bg-fpl-dark border border-fpl-border">
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt={v.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No thumbnail</div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-slate-200 line-clamp-2">{v.title || 'Untitled'}</p>
                  </div>
                </button>
              );
            })}

            {isLoading ? (
              <div className="col-span-full text-center text-slate-400 text-sm py-6">Loading videos…</div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

