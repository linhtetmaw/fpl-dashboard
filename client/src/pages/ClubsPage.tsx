import { useBootstrapStatic } from '../hooks/useFplApi';
import { OtherClubs } from './ClubPage';

/** Index of all Premier League clubs, each linking to its club page. */
export default function ClubsPage() {
  const { data: bootstrap, isLoading } = useBootstrapStatic();
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Premier League clubs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fixtures in Myanmar time, injury news and FPL player prices for every club. Pick a club.
        </p>
      </div>
      {isLoading ? <div className="card mt-5 h-64 animate-pulse" /> : <OtherClubs teams={bootstrap?.teams ?? []} />}
    </main>
  );
}
