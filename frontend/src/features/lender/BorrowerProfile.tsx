import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLenderStore } from '../../stores/lenderStore';
import { lenderAPI } from '../../lib/api';
import { FundConfirmationModal } from './FundConfirmationModal';

export const BorrowerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedBorrower, setSelectedBorrower, setDisburseSuccess, lenderVerified } = useLenderStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadBorrower = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await lenderAPI.getBorrowerById(id);
      setSelectedBorrower(data);
    } catch (err) {
      setError('Failed to fetch borrower details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBorrower();
    return () => setSelectedBorrower(null);
  }, [id]);

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10';
      case 'silver': return 'text-[#C0C0C0] bg-[#C0C0C0]/10';
      case 'gold': return 'text-[#F4A11D] bg-[#F4A11D]/10';
      case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10';
      default: return 'text-zovu-text bg-zovu-surface-2';
    }
  };

  const getTierColorHex = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return '#CD7F32';
      case 'silver': return '#C0C0C0';
      case 'gold': return '#F4A11D';
      case 'platinum': return '#E5E4E2';
      default: return '#1A6B4A';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-zovu-surface-1" />
          <div className="flex flex-col gap-2">
            <div className="h-6 w-48 bg-zovu-surface-1 rounded" />
            <div className="h-4 w-24 bg-zovu-surface-1 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="h-64 bg-zovu-surface-1 rounded-[12px]" />
          <div className="h-64 bg-zovu-surface-1 rounded-[12px]" />
        </div>
      </div>
    );
  }

  if (error || !selectedBorrower) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[12px] text-center">
          <p className="text-red-400 font-dm mb-4">{error || 'Borrower not found'}</p>
          <button onClick={() => navigate('/dashboard/lender/borrowers')} className="px-4 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">
            Back to Pool
          </button>
        </div>
      </div>
    );
  }

  const b = selectedBorrower;
  const initials = b.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
  const tierHex = getTierColorHex(b.tier);

  // SVG Arc Calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Arc goes from -180 deg to 0 deg
  const scorePercent = Math.min(Math.max(b.pulse_score / 1000, 0), 1);
  const offset = circumference - (scorePercent * circumference) / 2;

  const signalItems = [
    { label: 'Transaction Frequency', val: b.signals.transaction_frequency },
    { label: 'Transaction Growth', val: b.signals.transaction_growth },
    { label: 'Gig Completion Rate', val: b.signals.gig_completion_rate },
    { label: 'Repayment History', val: b.signals.repayment_history },
    { label: 'Network Density', val: b.signals.network_density },
    { label: 'Financial Discipline', val: b.signals.financial_discipline },
  ];

  return (
    <div className="flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full relative min-h-screen pb-32">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-zovu-text hover:text-zovu-text-light font-dm text-[14px] transition-colors w-fit">
        ← Back
      </button>

      {!lenderVerified && (
        <div className="bg-[#F4A11D]/10 border border-[#F4A11D]/30 rounded-[12px] p-5 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 items-center">
            <span className="text-[24px]">🔒</span>
            <p className="font-dm text-[15px] text-[#F4A11D]">
              Complete your lender profile to disburse loans.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/lender/complete-profile')}
            className="px-6 py-2.5 bg-[#F4A11D] text-[#0D0D0D] font-dm text-[14px] font-bold rounded-[8px] hover:brightness-110 whitespace-nowrap"
          >
            Complete Profile →
          </button>
        </div>
      )}

      {/* Top Section */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zovu-surface-2 border border-zovu-border flex items-center justify-center font-syne text-[24px] font-bold text-zovu-text-light">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">{b.full_name}</h1>
            <div className="flex items-center gap-3">
              <span className="font-dm text-[14px] text-zovu-text">{b.lga}</span>
              <div className={`px-2 py-0.5 rounded-full font-dm text-[11px] font-semibold tracking-wider uppercase ${getTierColor(b.tier)}`}>
                {b.tier}
              </div>
            </div>
          </div>
        </div>

        {/* Pulse Score Arc */}
        <div className="flex flex-col items-center mt-6 md:mt-0">
          <div className="relative w-32 h-16 overflow-hidden">
            <svg className="w-full h-32" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#2A2A2A"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference / 2}
                transform="rotate(180 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={tierHex}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(180 50 50)"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-0 left-0 w-full text-center">
              <span className="font-syne text-[24px] font-bold text-zovu-text-light">{b.pulse_score}</span>
            </div>
          </div>
          <p className="font-dm text-[11px] text-zovu-text uppercase tracking-widest mt-1">Pulse Score</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Loan Request Details */}
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-syne text-[18px] font-bold text-zovu-text-light mb-4">Loan Request</h3>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-dm text-[13px] text-zovu-text mb-1">Amount</p>
                <p className="font-syne text-[28px] font-bold text-zovu-primary">₦{b.loan_amount_requested.toLocaleString('en-NG')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-dm text-[13px] text-zovu-text mb-1">Purpose</p>
                  <p className="font-dm text-[15px] font-medium text-zovu-text-light">{b.purpose}</p>
                </div>
                <div>
                  <p className="font-dm text-[13px] text-zovu-text mb-1">Repayment Period</p>
                  <p className="font-dm text-[15px] font-medium text-zovu-text-light">{b.repayment_days} days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6">
          <h3 className="font-syne text-[18px] font-bold text-zovu-text-light mb-4">Transaction Summary</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-zovu-border/50">
              <span className="font-dm text-[14px] text-zovu-text">Avg Monthly Volume</span>
              <span className="font-dm text-[15px] font-semibold text-zovu-text-light">₦{b.transaction_summary.avg_monthly_volume.toLocaleString('en-NG')}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-zovu-border/50">
              <span className="font-dm text-[14px] text-zovu-text">Transaction Days/Month</span>
              <span className="font-dm text-[15px] font-semibold text-zovu-text-light">{b.transaction_summary.transaction_days_per_month}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-dm text-[14px] text-zovu-text">Longest Streak</span>
              <span className="font-dm text-[15px] font-semibold text-zovu-text-light">{b.transaction_summary.longest_streak} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Signals */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 mb-6">
        <h3 className="font-syne text-[18px] font-bold text-zovu-text-light mb-5">Trust Signals</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {signalItems.map((item, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-dm text-[13px] text-zovu-text">{item.label}</span>
                <span className="font-dm text-[13px] font-medium text-zovu-text-light">{item.val}%</span>
              </div>
              <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${item.val}%`, backgroundColor: tierHex }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-zovu-background/90 backdrop-blur-md border-t border-zovu-border z-40">
        <div className="max-w-4xl mx-auto w-full">
          <button 
            disabled={!lenderVerified}
            onClick={() => {
              setDisburseSuccess(false);
              setShowModal(true);
            }}
            className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-bold text-[16px] py-4 rounded-[12px] hover:brightness-110 transition-all shadow-[0_0_20px_rgba(26,107,74,0.3)] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {lenderVerified ? 'Fund This Borrower' : 'Complete Profile to Fund'}
          </button>
        </div>
      </div>

      {showModal && <FundConfirmationModal onClose={() => setShowModal(false)} />}
    </div>
  );
};
