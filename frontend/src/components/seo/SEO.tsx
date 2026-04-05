/**
 * SEO — Helmet-powered meta tag injector.
 *
 * Injects into <head>:
 *   - <title> + <meta name="description">
 *   - Open Graph (WhatsApp, Discord, Telegram, Facebook previews)
 *   - Twitter Card (Twitter / X previews)
 *   - Canonical URL
 *   - robots (noindex/nofollow for private routes)
 *   - JSON-LD SoftwareApplication schema (Google rich snippets)
 *
 * Usage:
 *   <SEO title="Login" description="Join GoalBet…" />
 *   <SEO noindex />  ← admin / private routes
 */

import { Helmet } from 'react-helmet-async';

const SITE_NAME   = 'GoalBet';
const BASE_URL    = 'https://goalbet.vercel.app';
const OG_IMAGE    = `${BASE_URL}/og-image.svg`;
const TWITTER_HANDLE = '@goalbet_app';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  description:
    'GoalBet is a free football prediction game for friend groups. '
    + 'Predict match outcomes across 5 tiers, earn points, and compete on a real-time leaderboard.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5',
    ratingCount: '1',
  },
  url: BASE_URL,
  image: OG_IMAGE,
  inLanguage: ['en', 'he'],
};

interface SEOProps {
  /** Page-specific title — will be appended "| GoalBet" */
  title?: string;
  /** Page-specific description (max ~160 chars) */
  description?: string;
  /** Absolute URL for og:image / twitter:image */
  image?: string;
  /** Canonical URL for this page */
  url?: string;
  /** og:type (default: website) */
  type?: 'website' | 'article';
  /** Block search engine indexing (admin / private routes) */
  noindex?: boolean;
  /** Page language code — affects <html lang> */
  lang?: 'en' | 'he';
}

export function SEO({
  title,
  description = 'GoalBet — the free football prediction game for friend groups. Predict match outcomes, earn coins, and climb the leaderboard.',
  image = OG_IMAGE,
  url = BASE_URL,
  type = 'website',
  noindex = false,
  lang,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Predict. Compete. Win.`;

  return (
    <Helmet>
      {/* ── Language ── */}
      {lang && <html lang={lang} />}

      {/* ── Standard ── */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* ── Robots ── */}
      {noindex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow" />
      }

      {/* ── Open Graph ── */}
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:type"        content={type} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={image} />
      <meta property="og:image:width"  content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url"         content={url} />

      {/* ── Twitter / X Card ── */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content={TWITTER_HANDLE} />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={image} />

      {/* ── JSON-LD Structured Data ── */}
      {!noindex && (
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD)}
        </script>
      )}
    </Helmet>
  );
}
