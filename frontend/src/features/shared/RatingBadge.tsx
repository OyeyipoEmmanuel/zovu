/**
 * RatingBadge — small inline component that fetches /reviews/users/:id/aggregate
 * and renders a star + average + count badge.
 *
 * Usage:
 *   <RatingBadge userId={trader.id} />
 *
 * Hidden when the user has zero reviews so empty profiles don't show "0.00 (0)".
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { fetchUserRatingAggregate } from '../../lib/api';

interface RatingBadgeProps {
  userId: string | undefined;
  /** Render even when count is zero (defaults to false). */
  showWhenEmpty?: boolean;
  /** "sm" (default) for inline next to a name, "md" for card headers. */
  size?: 'sm' | 'md';
  className?: string;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  userId,
  showWhenEmpty = false,
  size = 'sm',
  className = '',
}) => {
  const { data } = useQuery({
    queryKey: ['rating-aggregate', userId],
    queryFn: () => fetchUserRatingAggregate(userId as string),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  if (!userId) return null;
  const count = data?.review_count ?? 0;
  const avg = data?.average_rating ?? 0;
  if (count === 0 && !showWhenEmpty) return null;

  const isMd = size === 'md';
  const starSize = isMd ? 14 : 12;
  const textSize = isMd ? 'text-[13px]' : 'text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1 font-dm ${textSize} text-[#F4A11D] ${className}`}
      title={`${avg.toFixed(2)} stars from ${count} review${count === 1 ? '' : 's'}`}
    >
      <Star size={starSize} fill="currentColor" />
      <span className="font-semibold">{count === 0 ? '—' : avg.toFixed(1)}</span>
      <span className="text-[#A0A0A0]">({count})</span>
    </span>
  );
};
