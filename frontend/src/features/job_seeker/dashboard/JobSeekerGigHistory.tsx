import React, { useEffect, useState } from 'react';
import { jobSeekerAPI, markWorkerDone, type ApplicationRecord } from '../../../lib/api';
import type { GigRecord } from '../../../lib/mockData';
import { EscrowStatusPill, Countdown } from '../../shared/EscrowStatusPill';
import { CheckCircle2, Clock, Phone } from 'lucide-react';

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={`text-[14px] ${i < rating ? 'text-[#F4A11D]' : 'text-zovu-surface-2'}`}>★</span>
  ));
};

/**
 * Pulls a tel: phone number out of an application note. Task 9 appends
 * `\nContact trader: {phone}` when the seeker hires within range; if the
 * marker is absent (or distance > threshold) we just don't render the button.
 */
const extractTraderPhone = (note: string | null): string | null => {
  if (!note) return null;
  const match = /Contact trader:\s*([+\d][\d\s()-]+)/i.exec(note);
  return match ? match[1].trim() : null;
};

export const JobSeekerGigHistory: React.FC = () => {
  const [gigs, setGigs] = useState<GigRecord[]>([]);
  const [activeApps, setActiveApps] = useState<ApplicationRecord[]>([]);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, active] = await Promise.all([
        jobSeekerAPI.getGigHistory(filter === 'all' ? undefined : filter),
        jobSeekerAPI.getActiveApplications().catch(() => [] as ApplicationRecord[]),
      ]);
      setGigs(data);
      setActiveApps(active);
    } catch {
      setError('Failed to load gig history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleMarkDone = async (app: ApplicationRecord) => {
    setBusyAppId(app.id);
    setActiveError(null);
    try {
      await markWorkerDone(app.id);
      await loadData();
    } catch (e) {
      setActiveError((e as Error).message || 'Could not mark as done. Please retry.');
    } finally {
      setBusyAppId(null);
    }
  };

  const completedGigs = gigs.filter(g => g.status === 'completed');
  const onTimeCount = completedGigs.filter(g => g.rating && g.rating >= 4).length;
  const totalEarned = completedGigs.reduce((sum, g) => sum + g.pay, 0);

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">Gig History</h1>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-1">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">Completed</p>
          <span className="font-syne text-[28px] font-bold text-zovu-text-light">{completedGigs.length}</span>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-1">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">On Time</p>
          <span className="font-syne text-[28px] font-bold text-zovu-text-light">{onTimeCount}</span>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-1">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">Total Earned</p>
          <span className="font-syne text-[28px] font-bold text-[#1A6B4A]">₦{totalEarned.toLocaleString('en-NG')}</span>
        </div>
      </div>

      {/* Active Applications (escrow state machine + Task 9 Call Trader) */}
      {activeApps.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-syne text-[18px] font-bold text-zovu-text-light">Active Applications</h2>
          {activeError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 font-dm text-[13px] text-red-300">
              {activeError}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {activeApps.map((app) => {
              const traderPhone = extractTraderPhone(app.note);
              return (
                <article
                  key={app.id}
                  className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-3"
                >
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                      <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider">Application</p>
                      <p className="font-dm text-[13px] text-zovu-text-light mt-1">
                        Applied {formatDate(app.applied_at)}
                      </p>
                    </div>
                    <EscrowStatusPill status={app.status} />
                  </div>

                  {app.confirmation_deadline_at && app.status === 'worker_done' && (
                    <div className="flex items-center gap-2 font-dm text-[12px] text-zovu-text">
                      <Clock size={12} />
                      <span>Trader has</span>
                      <Countdown deadline={app.confirmation_deadline_at} />
                      <span>to confirm</span>
                    </div>
                  )}

                  {/* Task 9 — phone is only present if the seeker hired within
                      the geolocation threshold. If absent, no button renders. */}
                  {traderPhone && (
                    <a
                      href={`tel:${traderPhone}`}
                      className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-[8px] bg-[#1A6B4A] hover:brightness-110 text-white font-dm text-[13px] font-medium transition-all"
                    >
                      <Phone size={14} />
                      Call Trader · {traderPhone}
                    </a>
                  )}

                  {app.status === 'waiting_for_worker' && (
                    <button
                      type="button"
                      onClick={() => handleMarkDone(app)}
                      disabled={busyAppId === app.id}
                      className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-[8px] bg-[#F4A11D]/10 hover:bg-[#F4A11D]/20 text-[#F4A11D] font-dm text-[13px] font-medium border border-[#F4A11D]/30 transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      {busyAppId === app.id ? 'Submitting…' : 'Mark as done'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-zovu-border">
        {(['all', 'completed', 'cancelled'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-6 py-3 font-dm text-[14px] font-medium capitalize border-b-2 -mb-[1px] transition-colors ${
              filter === tab ? 'border-[#1A6B4A] text-[#1A6B4A]' : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      {/* Gig List */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 animate-pulse">
              <div className="h-5 bg-zovu-surface-2 rounded w-1/3 mb-3" />
              <div className="h-4 bg-zovu-surface-2 rounded w-1/4 mb-2" />
              <div className="h-4 bg-zovu-surface-2 rounded w-1/5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      ) : gigs.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-12 text-center">
          <p className="font-dm text-[15px] text-zovu-text">No gigs yet. Apply for your first job to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {gigs.map(gig => (
            <div key={gig.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 transition-colors hover:border-zovu-border/80">
              <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-syne text-[17px] font-bold text-zovu-text-light">{gig.title}</h3>
                  <p className="font-dm text-[13px] text-zovu-text mt-1">{gig.employer}</p>
                </div>
                <div className="flex items-center gap-3">
                  {gig.status === 'completed' && gig.pay > 0 && (
                    <span className="font-syne text-[18px] font-bold text-[#1A6B4A]">₦{gig.pay.toLocaleString('en-NG')}</span>
                  )}
                  <span className={`px-3 py-1 rounded-full border text-[11px] font-syne font-bold tracking-wider uppercase ${
                    gig.status === 'completed'
                      ? 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20'
                      : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                  }`}>
                    {gig.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-dm text-[13px] text-zovu-text">
                <span>{formatDate(gig.date)}</span>
                <span>·</span>
                <span>{gig.duration}</span>
              </div>
              {gig.status === 'completed' && gig.rating !== null && (
                <div className="mt-3 pt-3 border-t border-zovu-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-dm text-[12px] text-zovu-text">Employer Rating:</span>
                    <div className="flex">{renderStars(gig.rating)}</div>
                  </div>
                  {gig.review && (
                    <p className="font-dm text-[13px] text-zovu-text-light italic">"{gig.review}"</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
