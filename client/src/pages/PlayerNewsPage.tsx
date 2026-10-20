import FplNews from '../components/FplNews';

export default function PlayerNewsPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-5">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">Player News</h2>
        <p className="text-slate-400 text-sm mt-1">Injuries, suspensions and availability from the official FPL game.</p>
      </div>
      <FplNews />
    </main>
  );
}
