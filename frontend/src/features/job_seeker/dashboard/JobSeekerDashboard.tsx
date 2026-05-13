import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useJobSeekerStore, useJobSeekerFeatureAccess } from '../../../stores/jobSeekerStore';
import { jobSeekerAPI } from '../../../lib/api';
import type { JobMatch, JSTransaction } from '../../../lib/mockData';

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10 border-[#CD7F32]/20';
    case 'silver': return 'text-[#C0C0C0] bg-[#C0C0C0]/10 border-[#C0C0C0]/20';
    case 'gold': return 'text-[#F4A11D] bg-[#F4A11D]/10 border-[#F4A11D]/20';
    case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10 border-[#E5E4E2]/20';
    default: return 'text-zovu-text bg-zovu-surface-2 border-zovu-border';
  }
};

const getMatchBadgeColor = (pct: number) => {
  if (pct >= 90) return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
  if (pct >= 75) return 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20';
  return 'bg-[#A0A0A0]/10 text-[#A0A0A0] border-[#A0A0A0]/20';
};

const formatTime = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

export const JobSeekerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    appliedJobs,
    addAppliedJob,
    jobSeekerOnboardingComplete,
    kycComplete,
    squadVaCreated,
    redirectReason,
    setRedirectReason,
  } = useJobSeekerStore();
  const {
    canApplyForJobs,
    canViewTransactions,
    canApplyForLoans,
    canApplyForInsurance,
  } = useJobSeekerFeatureAccess();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [recentTxns, setRecentTxns] = useState<JSTransaction[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  // Clear redirect reason after showing it
  useEffect(() => {
    if (redirectReason) {
      const t = setTimeout(() => setRedirectReason(null), 5000);
      return () => clearTimeout(t);
    }
  }, [redirectReason, setRedirectReason]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, jobsRes, txnRes] = await Promise.all([
        jobSeekerAPI.getDashboard(),
        jobSeekerAPI.getRecommendedJobs(),
        jobSeekerAPI.getTransactions(),
      ]);
      setDashboard(dashRes);
      setJobs(jobsRes);
      setRecentTxns(txnRes.slice(0, 3));
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleApply = async (jobId: string) => {
    if (appliedJobs.includes(jobId) || !canApplyForJobs) return;
    setApplying(jobId);
    try {
      await jobSeekerAPI.applyForJob(jobId);
      addAppliedJob(jobId);
    } catch { /* silent */ }
    finally { setApplying(null); }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse max-w-4xl mx-auto w-full">
        <div className="h-8 w-64 bg-zovu-surface-1 rounded" />
        <div className="h-4 w-48 bg-zovu-surface-1 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-zovu-surface-1 rounded-[16px]" />)}
        </div>
        <div className="h-6 w-40 bg-zovu-surface-1 rounded" />
        {[1,2,3].map(i => <div key={i} className="h-40 bg-zovu-surface-1 rounded-[16px]" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      </div>
    );
  }

  const d = dashboard;
  const pulseScoreLocked = d.pulse_score < 400;

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-8">
      {/* Redirect Reason Toast */}
      {redirectReason && (
        <div className="bg-[#F4A11D]/10 border border-[#F4A11D]/30 rounded-[12px] p-4 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="text-[18px]">⚠️</span>
            <p className="font-dm text-[14px] text-[#F4A11D]">{redirectReason}</p>
          </div>
          <button onClick={() => setRedirectReason(null)} className="text-[#F4A11D]/60 hover:text-[#F4A11D] text-[18px]">×</button>
        </div>
      )}

      {/* Profile Completion Banner */}
      {!jobSeekerOnboardingComplete && (
        <Link
          to="/dashboard/job-seeker/onboarding/skills"
          className="bg-[#1A6B4A]/10 border border-[#1A6B4A]/30 rounded-[12px] p-4 flex items-center justify-between hover:border-[#1A6B4A]/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-[18px]">📝</span>
            <p className="font-dm text-[14px] text-[#1A6B4A]">Complete your profile to start applying for jobs →</p>
          </div>
          <span className="text-[#1A6B4A] text-[18px]">→</span>
        </Link>
      )}

      {jobSeekerOnboardingComplete && !kycComplete && (
        <button
          onClick={() => navigate('/dashboard/job-seeker/complete-profile/kyc')}
          className="w-full bg-[#F4A11D]/10 border border-[#F4A11D]/30 rounded-[12px] p-4 flex items-center justify-between hover:border-[#F4A11D]/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-[18px]">🔐</span>
            <p className="font-dm text-[14px] text-[#F4A11D]">Verify your identity to unlock payments and loans →</p>
          </div>
          <span className="text-[#F4A11D] text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </button>
      )}

      {kycComplete && !squadVaCreated && (
        <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-[12px] p-4 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <p className="font-dm text-[14px] text-[#3B82F6]">Setting up your Zovu account...</p>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="font-syne text-[28px] sm:text-[32px] font-bold text-zovu-text-light">Welcome back, Tobi 👋</h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">Here's what's happening today</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-2">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">Pulse Score</p>
          <div className="flex items-center gap-3">
            <span className="font-syne text-[32px] font-bold text-zovu-text-light">{d.pulse_score}</span>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-dm font-semibold uppercase tracking-wider ${getTierColor(d.tier)}`}>{d.tier}</span>
          </div>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-2">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">Total Earned</p>
          <span className="font-syne text-[32px] font-bold text-[#1A6B4A]">₦{d.total_earned.toLocaleString('en-NG')}</span>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-2">
          <p className="font-dm text-[13px] text-zovu-text uppercase tracking-wider">Gigs Completed</p>
          <span className="font-syne text-[32px] font-bold text-zovu-text-light">{d.gigs_completed}</span>
        </div>
      </div>

      {/* AI Job Recommendations */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Matched for you</h2>
          <span className="px-2 py-0.5 rounded-full bg-[#F4A11D]/10 text-[#F4A11D] border border-[#F4A11D]/20 text-[10px] font-dm font-semibold uppercase tracking-wider">AI</span>
        </div>
        <div className="flex flex-col gap-4">
          {jobs.map(job => {
            const applied = appliedJobs.includes(job.id);
            return (
              <div key={job.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 transition-colors hover:border-zovu-border/80">
                <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-syne text-[17px] font-bold text-zovu-text-light">{job.title}</h3>
                      {job.urgent && <span className="px-2 py-0.5 rounded bg-[#EF4444] text-white text-[10px] font-dm font-bold uppercase">Urgent</span>}
                    </div>
                    <p className="font-dm text-[13px] text-zovu-text mt-1">{job.employer} · {job.lga}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-syne text-[18px] font-bold text-[#1A6B4A]">₦{job.pay.toLocaleString('en-NG')}<span className="text-[12px] font-dm text-zovu-text font-normal">/{job.pay_period}</span></span>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-dm font-semibold ${getMatchBadgeColor(job.match_pct)}`}>{job.match_pct}% match</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {job.match_reasons.map((r, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-zovu-surface-2 text-zovu-text font-dm text-[11px]">{r}</span>
                  ))}
                </div>
                {canApplyForJobs ? (
                  <button
                    onClick={() => handleApply(job.id)}
                    disabled={applied || applying === job.id}
                    className={`px-5 py-2 rounded-[8px] font-dm text-[13px] font-bold transition-all ${
                      applied
                        ? 'bg-zovu-surface-2 text-zovu-text cursor-default'
                        : 'bg-[#1A6B4A] text-white hover:brightness-110'
                    } disabled:opacity-60`}
                  >
                    {applying === job.id ? 'Applying...' : applied ? 'Applied ✓' : 'Apply'}
                  </button>
                ) : (
                  <Link
                    to="/dashboard/job-seeker/onboarding/skills"
                    title="Complete your profile to apply for jobs"
                    className="inline-block px-5 py-2 rounded-[8px] font-dm text-[13px] font-bold bg-zovu-surface-2 text-zovu-text opacity-50 hover:opacity-100 transition-opacity"
                  >
                    🔒 Apply
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <Link to="/dashboard/job-seeker/jobs" className="inline-block mt-4 font-dm text-[14px] text-[#1A6B4A] hover:underline">See all jobs →</Link>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* QR Code — always available */}
          <button onClick={() => navigate('/dashboard/job-seeker/qr-checkin')} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#1A6B4A]/40 transition-colors">
            <span className="text-[24px]">📱</span>
            <span className="font-dm text-[12px] text-zovu-text-light text-center">My QR Code</span>
          </button>

          {/* Transactions — gated by squadVaCreated */}
          {canViewTransactions ? (
            <button onClick={() => navigate('/dashboard/job-seeker/transactions')} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#1A6B4A]/40 transition-colors">
              <span className="text-[24px]">💳</span>
              <span className="font-dm text-[12px] text-zovu-text-light text-center">Transactions</span>
            </button>
          ) : (
            <div className="relative group">
              <button 
                onClick={() => navigate('/dashboard/job-seeker/complete-profile/kyc')}
                className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#F4A11D]/40 transition-colors"
              >
                <span className="text-[24px]">🔒</span>
                <span className="font-dm text-[12px] text-zovu-text-light text-center">Transactions</span>
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zovu-surface-2 text-zovu-text text-[10px] font-dm px-3 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-zovu-border">
                Complete KYC to view transactions
              </div>
            </div>
          )}

          {/* Apply for Loan — gated by kycComplete + squadVaCreated + pulseScore */}
          {canApplyForLoans ? (
            <div className="relative group">
              <button 
                disabled={pulseScoreLocked} 
                className={`w-full bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 transition-colors ${pulseScoreLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#1A6B4A]/40'}`}
              >
                <span className="text-[24px]">{pulseScoreLocked ? '🔒' : '🏦'}</span>
                <span className="font-dm text-[12px] text-zovu-text-light text-center">Apply for Loan</span>
              </button>
              {pulseScoreLocked && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zovu-surface-2 text-zovu-text text-[10px] font-dm px-3 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-zovu-border">
                  Reach Bronze 400+ to unlock
                </div>
              )}
            </div>
          ) : (
            <div className="relative group">
              <button 
                onClick={() => navigate('/dashboard/job-seeker/complete-profile/kyc')}
                className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#F4A11D]/40 transition-colors"
              >
                <span className="text-[24px]">🔒</span>
                <span className="font-dm text-[12px] text-zovu-text-light text-center">Apply for Loan</span>
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zovu-surface-2 text-zovu-text text-[10px] font-dm px-3 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-zovu-border">
                {!kycComplete ? 'Complete KYC to unlock loans' : 'Reach Pulse Score 400 to unlock loans'}
              </div>
            </div>
          )}

          {/* Apply for Insurance — gated by kycComplete */}
          {canApplyForInsurance ? (
            <button className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#1A6B4A]/40 transition-colors">
              <span className="text-[24px]">🛡️</span>
              <span className="font-dm text-[12px] text-zovu-text-light text-center">Apply for Insurance</span>
            </button>
          ) : (
            <div className="relative group">
              <button 
                onClick={() => navigate('/dashboard/job-seeker/complete-profile/kyc')}
                className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-[#F4A11D]/40 transition-colors"
              >
                <span className="text-[24px]">🔒</span>
                <span className="font-dm text-[12px] text-zovu-text-light text-center">Apply for Insurance</span>
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zovu-surface-2 text-zovu-text text-[10px] font-dm px-3 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-zovu-border">
                Complete KYC to unlock insurance
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Recent Transactions</h2>
          {canViewTransactions && (
            <Link to="/dashboard/job-seeker/transactions" className="font-dm text-[13px] text-[#1A6B4A] hover:underline">View all →</Link>
          )}
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] divide-y divide-zovu-border/50">
          {!canViewTransactions ? (
            <button 
              onClick={() => navigate('/dashboard/job-seeker/complete-profile/kyc')}
              className="w-full p-8 text-center font-dm text-[14px] text-zovu-text hover:bg-zovu-surface-2 transition-colors rounded-[16px]"
            >
              <span className="text-[24px] block mb-2">🔒</span>
              Complete KYC to view transactions
            </button>
          ) : recentTxns.length === 0 ? (
            <div className="p-8 text-center font-dm text-[14px] text-zovu-text">No transactions yet.</div>
          ) : recentTxns.map(txn => (
            <div key={txn.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] ${txn.type === 'inflow' ? 'bg-[#1A6B4A]/10 text-[#1A6B4A]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                  {txn.type === 'inflow' ? '↓' : '↑'}
                </div>
                <div>
                  <p className="font-dm text-[14px] text-zovu-text-light">{txn.counterparty}</p>
                  <p className="font-dm text-[11px] text-zovu-text">{formatTime(txn.timestamp)}</p>
                </div>
              </div>
              <span className={`font-syne text-[16px] font-bold ${txn.type === 'inflow' ? 'text-[#1A6B4A]' : 'text-[#EF4444]'}`}>
                {txn.type === 'inflow' ? '+' : '-'}₦{txn.amount.toLocaleString('en-NG')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
