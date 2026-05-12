import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLenderStore } from '../../stores/lenderStore';
import { useAuthStore } from '../../stores/authStore';
import { lenderAPI } from '../../lib/api';

export const LenderSidebar: React.FC = () => {
  return (
    <div className="w-64 bg-zovu-surface-1 border-r border-zovu-border flex flex-col min-h-screen p-6 hidden md:flex">
      <h2 className="font-syne text-[24px] font-bold text-zovu-primary mb-10">Zovu</h2>
      <nav className="flex flex-col gap-2">
        <Link to="/dashboard/lender" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Home</Link>
        <Link to="/dashboard/lender/borrowers" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Borrowers</Link>
        <Link to="/dashboard/lender/loans" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">My Loans</Link>
        <Link to="/dashboard/lender/settings" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Settings</Link>
      </nav>
    </div>
  );
};

export const LenderHome: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { stats, borrowers, setStats, setBorrowers } = useLenderStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const role = user?.role as string | undefined;
    if (role && role.toLowerCase() !== 'lender' && role.toLowerCase() !== 'both') {
      navigate('/dashboard/trader');
    }
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, borrowersRes] = await Promise.all([
        lenderAPI.getStats(),
        lenderAPI.getBorrowers({ limit: 3 })
      ]);
      setStats(statsRes);
      setBorrowers(borrowersRes);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10';
      case 'silver': return 'text-[#C0C0C0] bg-[#C0C0C0]/10';
      case 'gold': return 'text-[#F4A11D] bg-[#F4A11D]/10';
      case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10';
      default: return 'text-zovu-text bg-zovu-surface-2';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-10 w-48 bg-zovu-surface-1 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zovu-surface-1 rounded-[12px] border border-zovu-border" />)}
        </div>
        <div className="h-6 w-32 bg-zovu-surface-1 rounded-md mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-zovu-surface-1 rounded-[12px] border border-zovu-border" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[12px] text-center">
        <p className="text-red-400 font-dm mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="font-syne text-[24px] sm:text-[30px] font-bold text-zovu-text-light leading-tight">
          Lender Dashboard
        </h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">Overview of your lending portfolio.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Total Funded</p>
          <p className="font-syne text-[24px] font-bold text-zovu-text-light">
            ₦{stats?.total_funded.toLocaleString('en-NG')}
          </p>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Active Loans</p>
          <p className="font-syne text-[24px] font-bold text-zovu-text-light">
            {stats?.active_loans}
          </p>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Repayment Rate</p>
          <p className="font-syne text-[24px] font-bold text-zovu-primary">
            {stats?.repayment_rate}%
          </p>
        </div>
      </div>

      {/* Borrower Pool Preview */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Borrower Pool Preview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {borrowers.map((b) => (
            <div key={b.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5 flex flex-col gap-3 hover:border-zovu-primary/30 transition-colors">
              <div className="flex justify-between items-start">
                <p className="font-dm text-[16px] font-bold text-zovu-text-light">{b.display_name}</p>
                <div className={`px-2 py-0.5 rounded-full font-dm text-[11px] font-semibold tracking-wider uppercase ${getTierColor(b.tier)}`}>
                  {b.tier}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-dm text-[13px] text-zovu-text">Score: <span className="text-zovu-text-light font-semibold">{b.pulse_score}</span></p>
                <p className="font-dm text-[13px] text-zovu-text">LGA: <span className="text-zovu-text-light">{b.lga}</span></p>
                <p className="font-dm text-[13px] text-zovu-text">Purpose: <span className="text-zovu-text-light">{b.purpose}</span></p>
                <p className="font-dm text-[13px] text-zovu-text mt-1">Requested: <span className="text-zovu-primary font-bold text-[15px]">₦{b.loan_amount_requested.toLocaleString('en-NG')}</span></p>
              </div>
              <Link
                to={`/dashboard/lender/borrowers/${b.id}`}
                className="mt-2 w-full py-2.5 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] text-center transition-colors border border-zovu-border"
              >
                View Profile
              </Link>
            </div>
          ))}
          {borrowers.length === 0 && (
            <div className="col-span-3 text-center py-10 border border-zovu-border border-dashed rounded-[12px] text-zovu-text font-dm text-[14px]">
              No borrowers available right now.
            </div>
          )}
        </div>
        <div className="mt-4">
          <Link to="/dashboard/lender/borrowers" className="font-dm text-[14px] text-zovu-primary hover:underline">
            View All Borrowers →
          </Link>
        </div>
      </div>
    </div>
  );
};
