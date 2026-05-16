/**
 * ReviewModal — generic 1-5 star + comment dialog used by both traders and
 * job seekers to review the other party on a completed/in-progress gig.
 *
 * The backend derives the reviewer role from the gig participants, so the
 * client just needs to pass gig_id + reviewee_id.
 */
import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { submitReview, type ReviewItem } from '../../lib/api';

interface ReviewModalProps {
  gigId: string;
  revieweeId: string;
  revieweeName: string;
  /** Defaults to "the other party"; pass "trader" / "job seeker" for nicer copy. */
  revieweeRole?: string;
  onClose: () => void;
  onSubmitted?: (review: ReviewItem) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  gigId,
  revieweeId,
  revieweeName,
  revieweeRole = 'the other party',
  onClose,
  onSubmitted,
}) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Pick a rating from 1 to 5 stars.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const review = await submitReview({
        gig_id: gigId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });
      onSubmitted?.(review);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not submit your review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 max-w-md w-full"
      >
        <div className="flex justify-between items-start mb-2">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">
            Rate {revieweeName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-zovu-text hover:text-zovu-text-light"
          >
            <X size={18} />
          </button>
        </div>
        <p className="font-dm text-[13px] text-zovu-text mb-5">
          Your review will be visible to {revieweeRole} and other users on the platform.
        </p>

        <div className="flex justify-center gap-1 mb-5" role="group" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={32}
                  strokeWidth={1.5}
                  className={active ? 'text-[#F4A11D]' : 'text-zovu-text/40'}
                  fill={active ? 'currentColor' : 'none'}
                />
              </button>
            );
          })}
        </div>

        <label className="block font-dm text-[13px] text-zovu-text-light font-medium mb-1">
          Add a comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="What was your experience like?"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2.5 outline-none focus:border-zovu-primary resize-none"
        />

        {error && (
          <p role="alert" className="font-dm text-[12px] text-red-400 mt-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-zovu-surface-2 text-zovu-text-light font-dm text-[13px] rounded-[8px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || rating === 0}
            className="flex-1 px-4 py-2.5 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </form>
    </div>
  );
};
