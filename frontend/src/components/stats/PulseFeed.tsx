import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { useLangStore } from '../../stores/langStore';
import { useLeagueNews } from '../../hooks/useLeagueStats';
import { GlassCard } from '../ui/GlassCard';
import { timeAgo } from '../../lib/utils';
import type { NewsArticle } from '../../hooks/useLeagueStats';
import type { TranslationKey } from '../../lib/i18n';

interface PulseFeedProps {
  leagueId: number | null;
  /** Only fetches (and only ever renders) when true — the Leagues sub-tab
   *  actually being open, not World Cup's custom view or the My Arena tab.
   *  Matches this sprint's "fetch only when opened" lazy-loading mandate. */
  active: boolean;
}

// V4 Sprint 27 — The Pulse Feed. Contextual league news, rendered as premium
// low-opacity Bento cards that brighten on hover (GlassCard's existing
// `grain` + `interactive` spotlight-glare props — no new visual primitive).
// Returns null entirely when there's nothing to show, matching this
// codebase's established "hidden until real data exists" convention
// (MatchTimeline, AIScoutCard, HallOfFameChronicles, ...) rather than an
// empty-state placeholder for a feature nobody asked to see fail.
export function PulseFeed({ leagueId, active }: PulseFeedProps) {
  const { t, lang } = useLangStore();
  const { data, loading } = useLeagueNews(leagueId, active);

  if (!active) return null;
  if (!loading && (!data || data.articles.length === 0)) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-barlow text-xs font-bold uppercase tracking-widest text-text-muted">
        {t('statsPulseFeed')}
      </h2>
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[76px] rounded-xl bg-white/3 border border-white/8 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {data!.articles.map(article => (
            <NewsCard key={article.id} article={article} lang={lang} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewsCard({ article, lang, t }: { article: NewsArticle; lang: 'en' | 'he'; t: (k: TranslationKey) => string }) {
  // ESPN's news thumbnail URLs are unverified from this sandbox (same
  // constraint as every other ESPN field in this sprint) — a broken/expired
  // one must fall back to the same Newspaper glyph a missing URL gets,
  // never a raw browser broken-image icon.
  const [imgError, setImgError] = useState(false);
  const showImage = article.imageUrl && !imgError;

  const card = (
    <GlassCard grain interactive contentClassName="flex gap-3 items-start p-3">
      {showImage ? (
        <img
          src={article.imageUrl!}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-14 h-14 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-text-muted">
          <Newspaper size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-white/85 group-hover:text-white text-sm font-medium line-clamp-2 transition-colors">
          {article.headline}
        </div>
        {article.publishedAt && (
          <div className="text-text-muted text-[10px] mt-1">{timeAgo(article.publishedAt, t)}</div>
        )}
      </div>
    </GlassCard>
  );

  if (!article.link) return card;

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      className="block"
    >
      {card}
    </a>
  );
}
