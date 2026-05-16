import React, { useEffect, useState } from 'react';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { jobSeekerAPI } from '../../../lib/api';
import type { JobMatch } from '../../../lib/mockData';
import { RatingBadge } from '../../shared/RatingBadge';
import { Calendar, MapPin } from 'lucide-react';

const getMatchBadgeColor = (pct: number) => {
  if (pct >= 90) return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
  if (pct >= 75) return 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20';
  return 'bg-[#A0A0A0]/10 text-[#A0A0A0] border-[#A0A0A0]/20';
};

const LGAS = ['All', 'Mile 12', 'Surulere', 'Oshodi', 'Ikeja', 'Lekki', 'Lagos Island'];

export const JobSeekerJobs: React.FC = () => {
  const { appliedJobs, addAppliedJob } = useJobSeekerStore();
  const [activeTab, setActiveTab] = useState<'recommended' | 'all'>('recommended');
  const [recommended, setRecommended] = useState<JobMatch[]>([]);
  const [allJobs, setAllJobs] = useState<JobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [lga, setLga] = useState('All');
  const [minPay, setMinPay] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, allRes] = await Promise.all([
        jobSeekerAPI.getRecommendedJobs(),
        jobSeekerAPI.getAllJobs(),
      ]);
      setRecommended(recRes.sort((a, b) => b.match_pct - a.match_pct));
      setAllJobs(allRes);
    } catch {
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApply = async (jobId: string) => {
    if (appliedJobs.includes(jobId)) return;
    setApplying(jobId);
    try {
      await jobSeekerAPI.applyForJob(jobId);
      addAppliedJob(jobId);
    } catch { /* silent */ }
    finally { setApplying(null); }
  };

  const filteredJobs = (activeTab === 'recommended' ? recommended : allJobs).filter(j => {
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.skills_required.some(s => s.toLowerCase().includes(search.toLowerCase()))) return false;
    if (lga !== 'All' && j.lga !== lga) return false;
    if (minPay && j.pay < Number(minPay)) return false;
    if (urgentOnly && !j.urgent) return false;
    return true;
  });

  const renderJobCard = (job: JobMatch, showMatch: boolean) => {
    const applied = appliedJobs.includes(job.id);
    return (
      <div key={job.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 transition-colors hover:border-zovu-border/80">
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-syne text-[17px] font-bold text-zovu-text-light">{job.title}</h3>
              {job.urgent && <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-[10px] font-dm font-bold uppercase">Urgent</span>}
            </div>
            <p className="font-dm text-[13px] text-zovu-text mt-1 flex items-center gap-2 flex-wrap">
              <span>{job.employer}</span>
              {/* Trader rating shown beside their name on every job-seeker job card. */}
              <RatingBadge userId={job.trader_id} />
              <span className="text-zovu-text/50">·</span>
              <span>{job.lga}</span>
            </p>
            {(job.direct_location || job.scheduled_at) && (
              <div className="flex flex-wrap gap-3 mt-2 font-dm text-[11px] text-zovu-text">
                {job.direct_location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} />
                    {job.direct_location}
                  </span>
                )}
                {job.scheduled_at && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} />
                    {new Date(job.scheduled_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="font-syne text-[18px] font-bold text-[#1A6B4A]">₦{job.pay.toLocaleString('en-NG')}<span className="text-[12px] font-dm text-zovu-text font-normal">/{job.pay_period}</span></span>
            {showMatch && <span className={`px-2 py-0.5 rounded-full border text-[11px] font-dm font-semibold ${getMatchBadgeColor(job.match_pct)}`}>{job.match_pct}% match</span>}
          </div>
        </div>
        {showMatch && job.match_reasons.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {job.match_reasons.map((r, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full bg-[#1A6B4A]/10 text-[#1A6B4A] font-dm text-[11px]">{r}</span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.skills_required.map((s, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full bg-zovu-surface-2 text-zovu-text font-dm text-[11px] border border-zovu-border">{s}</span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-dm text-[12px] text-zovu-text">{job.posted}</span>
          <button
            onClick={() => handleApply(job.id)}
            disabled={applied || applying === job.id}
            className={`px-5 py-2 rounded-[8px] font-dm text-[13px] font-bold transition-all ${
              applied ? 'bg-zovu-surface-2 text-zovu-text cursor-default' : 'bg-[#1A6B4A] text-white hover:brightness-110'
            } disabled:opacity-60`}
          >
            {applying === job.id ? 'Applying...' : applied ? 'Applied ✓' : 'Apply'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">Jobs</h1>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search job title or skill..."
          className="bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2.5 outline-none focus:border-[#1A6B4A] transition-colors"
        />
        <select
          value={lga}
          onChange={e => setLga(e.target.value)}
          className="bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2.5 outline-none focus:border-[#1A6B4A] transition-colors appearance-none"
        >
          {LGAS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input
          type="number"
          value={minPay}
          onChange={e => setMinPay(e.target.value)}
          placeholder="Min pay (₦)"
          className="bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2.5 outline-none focus:border-[#1A6B4A] transition-colors"
        />
        <button
          onClick={() => setUrgentOnly(!urgentOnly)}
          className={`rounded-[8px] border font-dm text-[13px] px-3 py-2.5 transition-all ${
            urgentOnly ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]' : 'bg-zovu-surface-1 border-zovu-border text-zovu-text hover:border-zovu-text/30'
          }`}
        >
          {urgentOnly ? '🔴 Urgent Only' : 'All Types'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zovu-border">
        {(['recommended', 'all'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-dm text-[14px] font-medium capitalize border-b-2 -mb-[1px] transition-colors ${
              activeTab === tab ? 'border-[#1A6B4A] text-[#1A6B4A]' : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tab === 'recommended' ? 'Recommended' : 'All Jobs'}
          </button>
        ))}
      </div>

      {/* Job List */}
      <div className="flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 animate-pulse">
              <div className="h-5 bg-zovu-surface-2 rounded w-1/3 mb-3" />
              <div className="h-4 bg-zovu-surface-2 rounded w-1/4 mb-4" />
              <div className="flex gap-2 mb-4">{[1,2].map(j => <div key={j} className="h-6 w-16 bg-zovu-surface-2 rounded-full" />)}</div>
              <div className="h-8 w-20 bg-zovu-surface-2 rounded" />
            </div>
          ))
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
            <p className="text-red-400 font-dm mb-4">{error}</p>
            <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-12 text-center">
            <p className="font-dm text-[15px] text-zovu-text">
              {activeTab === 'recommended'
                ? 'No matches yet. Complete your profile to improve your matches.'
                : 'No jobs available right now. Check back soon.'}
            </p>
          </div>
        ) : (
          filteredJobs.map(job => renderJobCard(job, activeTab === 'recommended'))
        )}
      </div>
    </div>
  );
};
