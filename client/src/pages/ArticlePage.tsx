import { Link, useParams } from 'react-router-dom';
import { ARTICLES, articlePath, formatArticleDate } from '../articles';
import NotFoundPage from './NotFoundPage';

/** One article. Its title and description for search engines come from seo-routes.json (server/seo.js). */
export default function ArticlePage() {
  const { slug } = useParams();
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) return <NotFoundPage />;
  const { Body } = article;
  const more = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <Link to="/articles" className="text-sm text-slate-400 hover:text-white">
        ← News & Articles
      </Link>
      <article className="mt-4">
        <header>
          <span className="eyebrow text-fpl-brand">{article.category}</span>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            {article.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            FPL House · <time dateTime={article.published}>{formatArticleDate(article.published)}</time> ·{' '}
            {article.readMinutes} min read
          </p>
        </header>
        <div className="article mt-6">
          <Body />
        </div>
      </article>

      {more.length > 0 && (
        <section className="mt-12 border-t border-fpl-border pt-6">
          <h2 className="section-title">More articles</h2>
          <ul className="mt-3 space-y-2">
            {more.map((a) => (
              <li key={a.slug}>
                <Link to={articlePath(a.slug)} className="text-sm font-medium text-fpl-brand hover:underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
