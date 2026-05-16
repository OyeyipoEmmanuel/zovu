/**
 * PublicJobs — public-facing job search section.
 *
 * Renders the most recent open gigs (no auth required) plus a search box.
 * If a visitor is logged in we send them straight to the job-seeker dashboard
 * to apply; otherwise we redirect to /signup?role=job_seeker&apply=<gigId>
 * so the seeker lands on the job they wanted after creating an account.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Calendar, Briefcase, ArrowRight } from 'lucide-react';
import { fetchPublicGigs, type Gig } from '../../../lib/api';
import { useAuthStore } from '../../../stores/authStore';
import { RatingBadge } from '../../shared/RatingBadge';

const formatNaira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

const formatScheduledAt = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface PublicJobsProps {
  /** When false renders a section header and CTA strip suitable for the landing page. */
  embedded?: boolean;
}

export const PublicJobs: React.FC<PublicJobsProps> = ({ embedded = true }) => {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const isAuthed = Boolean(token);

  // Debounced search input. Re-querying on every keystroke is fine — the
  // /api/v1/gigs endpoint is cheap and cached on the server.
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');

  const jobsQuery = useQuery({
    queryKey: ['public-gigs', search, location],
    queryFn: () => fetchPublicGigs({ search: search || undefined, location: location || undefined, limit: 12 }),
    staleTime: 30_000,
  });

  const handleApply = (gig: Gig) => {
    if (!isAuthed) {
      // External visitor — bounce them through signup, preserving the gig
      // they were trying to apply to so we can deep-link back after auth.
      navigate(`/signup?role=job_seeker&apply=${encodeURIComponent(gig.id)}`);
      return;
    }
    const role = (user?.role || '').toLowerCase();
    if (role === 'job_seeker' || role === 'seeker' || role === 'both') {
      // Logged-in seekers go to the in-app jobs list where they can apply.
      navigate('/dashboard/job-seeker/jobs');
    } else {
      // Logged-in trader/partner — show them their dashboard instead.
      navigate('/dashboard');
    }
  };

  const jobs: Gig[] = jobsQuery.data ?? [];

  return (
    <section className={embedded ? 'px-6 py-16 border-t border-zovu-border' : ''}>
      <div className="max-w-6xl mx-auto">
        {embedded && (
          <div className="mb-8 text-center">
            <h2 className="font-syne text-[28px] md:text-[32px] font-semibold mb-2 text-zovu-text-light">
              Find a gig in your neighbourhood
            </h2>
            <p className="font-dm text-[14px] md:text-[16px] text-zovu-text max-w-2xl mx-auto">
              Real jobs posted by traders right now. Search by skill or LGA — no login required to browse.
            </p>
          </div>
        )}

        {/* Search bar */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px_auto] gap-3 mb-6">
          <label className="relative">
            <span className="sr-only">Search job title or skill</span>
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zovu-text/60"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or skill (e.g. shop assistant, delivery)…"
              className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[10px] font-dm text-[14px] text-zovu-text-light pl-10 pr-3 py-3 outline-none focus:border-zovu-primary"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by location</span>
            <MapPin
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zovu-text/60"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Ikeja)"
              className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[10px] font-dm text-[14px] text-zovu-text-light pl-10 pr-3 py-3 outline-none focus:border-zovu-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => jobsQuery.refetch()}
            className="px-5 py-3 bg-zovu-primary text-zovu-primary-text font-dm text-[14px] font-medium rounded-[10px] hover:brightness-110 transition-all"
          >
            Search
          </button>
        </div>

        {/* Results */}
        {jobsQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 animate-pulse h-44"
              />
            ))}
          </div>
        ) : jobsQuery.error ? (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[12px] text-center font-dm text-red-300">
            Could not load jobs right now.
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-10 text-center font-dm text-zovu-text">
            No open jobs match your search yet. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((gig) => {
              const scheduled = formatScheduledAt(gig.scheduledAt);
              return (
                <article
                  key={gig.id}
                  className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-syne text-[16px] font-bold text-zovu-text-light leading-snug line-clamp-2">
                      {gig.title}
                    </h3>
                    <Briefcase size={16} className="text-zovu-primary shrink-0 mt-1" />
                  </div>
                  {gig.description && (
                    <p className="font-dm text-[12px] text-zovu-text line-clamp-2">
                      {gig.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-auto font-dm text-[11px] text-zovu-text">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {gig.location || 'Lagos'}
                    </span>
                    {scheduled && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {scheduled}
                      </span>
                    )}
                    {gig.skills.slice(0, 2).map((s) => (
                      <span
                        key={s}
                        className="bg-zovu-surface-2 text-zovu-text-light px-2 py-0.5 rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="font-syne text-[18px] font-bold text-zovu-primary">
                        {formatNaira(gig.pay)}
                      </p>
                      <p className="font-dm text-[11px] text-zovu-text">{gig.payPeriod}</p>
                      {/* Trader rating preview on the homepage. */}
                      <RatingBadge userId={gig.traderId} className="mt-1" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApply(gig)}
                      className="px-3 py-2 bg-zovu-primary text-zovu-primary-text font-dm text-[12px] font-medium rounded-[8px] hover:brightness-110 flex items-center gap-1"
                    >
                      {isAuthed ? 'Apply' : 'Sign up to apply'}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {embedded && (
          <div className="text-center mt-8">
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1 font-dm text-[14px] text-zovu-primary hover:underline"
            >
              See all open jobs
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
