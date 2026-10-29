import { Link } from 'react-router-dom';
import { ARTICLES, articlePath, formatArticleDate } from '../articles';

/** News & Articles: list of FPL guides and news articles, newest first. */
export default function ArticlesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <h1 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">News & Articles</h1>
      <p className="mt-1 text-sm text-slate-400">Fantasy Premier League guides, rules explained and gameweek news.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((a) => (
          <Link
            key={a.slug}
            to={articlePath(a.slug)}
            className="card group flex flex-col p-5 transition-colors hover:border-fpl-brand/60"
          >
            <span className="eyebrow text-fpl-brand">{a.category}</span>
            <h2 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight text-white group-hover:text-fpl-brand">
              {a.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{a.summary}</p>
            <p className="mt-4 text-xs text-slate-500">
              {formatArticleDate(a.published)} · {a.readMinutes} min read
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
