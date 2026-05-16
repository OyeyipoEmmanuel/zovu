import React, { useEffect, useState } from 'react';
import {
  fetchPartnerRecommendations,
  type PartnerRecommendation,
} from '../../lib/api';

interface RecommendationsSectionProps {
  /**
   * The viewer's user id. We only fetch when this is present so the section
   * doesn't fire while the dashboard is still loading the profile.
   */
  userId: string | null | undefined;
}

const TYPE_ICON: Record<string, string> = {
  loan: '🏦',
  insurance: '🛡️',
  savings: '💰',
};

/**
 * "For You" — partner-product recommendations rendered on the trader and
 * seeker dashboards. Up to 3 cards, each with the product name, the partner,
 * a short description and a CTA button that deep-links to the partner page.
 *
 * Empty state: a soft nudge encouraging the user to keep building their
 * Pulse Score (because eligibility is tier-gated server-side).
 *
 * Backed by `GET /api/v1/partner-recommendations/:userId`.
 */
export const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({ userId }) => {
  const [items, setItems] = useState<PartnerRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      // Wait for the profile to resolve before firing — avoids a spurious 403.
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPartnerRecommendations(userId);
        if (cancelled) return;
        setItems(Array.isArray(res?.recommendations) ? res.recommendations : []);
      } catch {
        if (cancelled) return;
        setError('Could not load recommendations.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section aria-label="Recommended for you">
      {/* Heading row — mirrors the "AI" badge used for job recs */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">For You</h2>
        <span className="px-2 py-0.5 rounded-full bg-[#F4A11D]/10 text-[#F4A11D] border border-[#F4A11D]/20 text-[10px] font-dm font-semibold uppercase tracking-wider">
          AI
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 animate-pulse"
            >
              <div className="h-4 w-2/3 bg-zovu-surface-2 rounded mb-3" />
              <div className="h-3 w-1/3 bg-zovu-surface-2 rounded mb-4" />
              <div className="h-3 w-full bg-zovu-surface-2 rounded mb-2" />
              <div className="h-3 w-5/6 bg-zovu-surface-2 rounded mb-5" />
              <div className="h-9 w-28 bg-zovu-surface-2 rounded-[8px]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 text-center">
          <p className="font-dm text-[14px] text-zovu-text">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 text-center">
          <span className="text-[28px] block mb-2" aria-hidden="true">✨</span>
          <p className="font-dm text-[14px] text-zovu-text-light font-medium">
            Keep building your Pulse Score to unlock financial products.
          </p>
          <p className="font-dm text-[12px] text-zovu-text mt-1">
            Complete gigs, save into Ajo, and repay on time — products will appear here as you level up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {items.map((rec) => {
            const icon = TYPE_ICON[(rec.type || '').toLowerCase()] || '⭐';
            const isExternal = rec.cta_url && rec.cta_url !== '#';
            return (
              <article
                key={rec.id}
                className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-3 hover:border-[#1A6B4A]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[20px] shrink-0" aria-hidden="true">{icon}</span>
                    <div className="min-w-0">
                      <h3 className="font-syne text-[16px] font-bold text-zovu-text-light leading-tight truncate">
                        {rec.product_name}
                      </h3>
                      <p className="font-dm text-[12px] text-zovu-text truncate">{rec.partner_name}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-zovu-surface-2 text-zovu-text font-dm text-[10px] uppercase tracking-wider shrink-0">
                    {rec.type || 'product'}
                  </span>
                </div>

                {rec.description && (
                  <p className="font-dm text-[13px] text-zovu-text-light/90 line-clamp-3">
                    {rec.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <span className="font-dm text-[11px] text-zovu-text">
                    From {rec.min_score_required} Pulse
                  </span>
                  {isExternal ? (
                    <a
                      href={rec.cta_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-[8px] bg-[#1A6B4A] text-white font-dm text-[12px] font-bold hover:brightness-110 transition-all"
                    >
                      {rec.cta_label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-[8px] bg-zovu-surface-2 text-zovu-text font-dm text-[12px] font-bold opacity-60"
                    >
                      {rec.cta_label}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RecommendationsSection;
