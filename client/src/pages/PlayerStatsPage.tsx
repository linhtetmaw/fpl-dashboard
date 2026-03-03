import { useBootstrapStatic } from '../hooks/useFplApi';
import PlayersNews from '../components/PlayersNews';

export default function PlayerStatsPage() {
  const { data: bootstrap, isLoading: bootstrapLoading } = useBootstrapStatic();

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <section className="h-[50vh] min-h-[280px] max-h-[520px] flex flex-col">
        <h2 className="text-lg font-semibold text-white mb-3">Players News</h2>
        <PlayersNews bootstrap={bootstrap ?? undefined} isLoading={bootstrapLoading} />
      </section>
      <div className="mt-8 rounded-xl border border-fpl-border bg-fpl-card p-12 text-center">
        <p className="text-slate-400 text-lg">We are still working on it</p>
      </div>
    </main>
  );
}
