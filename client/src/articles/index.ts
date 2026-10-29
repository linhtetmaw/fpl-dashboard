import type { ComponentType } from 'react';
import HowPriceChangesWork from './HowPriceChangesWork';
import HowToPlayFpl from './HowToPlayFpl';

export interface Article {
  slug: string;
  title: string;
  /** One or two sentences for the article list (the search-engine description lives in seo-routes.json). */
  summary: string;
  category: 'Guide' | 'News';
  /** ISO date, e.g. 2026-10-29. */
  published: string;
  readMinutes: number;
  Body: ComponentType;
}

/** Newest first. Each article also needs an entry in seo-routes.json (title, description, sitemap). */
export const ARTICLES: Article[] = [
  {
    slug: 'how-fpl-price-changes-work',
    title: 'How FPL price changes work: rises, falls and your selling price',
    summary:
      'Why Fantasy Premier League prices rise and fall, when the changes happen, who is closest to changing right now, and the 50% rule that decides what you get when you sell.',
    category: 'Guide',
    published: '2026-10-29',
    readMinutes: 6,
    Body: HowPriceChangesWork,
  },
  {
    slug: 'how-to-play-fpl',
    title: 'How to play Fantasy Premier League: points, chips and transfers explained',
    summary:
      'A complete beginner’s guide to FPL for the 2026/27 season: building a £100m squad, captains, transfers, every way players score points, and when to use your chips.',
    category: 'Guide',
    published: '2026-10-29',
    readMinutes: 9,
    Body: HowToPlayFpl,
  },
];

export const articlePath = (slug: string) => `/articles/${slug}`;

export function formatArticleDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
