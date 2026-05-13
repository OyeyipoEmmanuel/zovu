import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePartnerStore } from '../../stores/partnerStore';
import { lenderAPI } from '../../lib/api';
import debounce from 'lodash/debounce';

export const CustomerPool: React.FC = () => {
  const { borrowers, filters, setFilters, setBorrowers, lenderVerified } = usePartnerStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBorrowers = async (currentFilters: typeof filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await lenderAPI.getBorrowers(currentFilters);
      setBorrowers(data);
    } catch (err) {
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useCallback(
    debounce((newFilters) => fetchBorrowers(newFilters), 500),
    []
  );

  useEffect(() => {
    debouncedFetch(filters);
    return () => debouncedFetch.cancel();
  }, [filters, debouncedFetch]);

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters({ [key]: value });
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10';
      case 'silver': return 'text-[#C0C0C0] bg-[#C0C0C0]/10';
      case 'gold': return 'text-[#F4A11D] bg-[#F4A11D]/10';
      case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10';
      default: return 'text-zovu-text bg-zovu-surface-2';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">
        Customer Pool
      </h1>

      {!lenderVerified && (
        <div className="bg-[#F4A11D]/10 border border-[#F4A11D]/30 rounded-[12px] p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 items-center">
            <span className="text-[24px]">🔒</span>
            <p className="font-dm text-[15px] text-[#F4A11D]">
              Complete your partner profile to unlock customer profiles and offer services.
            </p>
          </div>
          <Link
            to="/dashboard/partners/complete-profile"
            className="px-6 py-2.5 bg-[#F4A11D] text-[#0D0D0D] font-dm text-[14px] font-bold rounded-[8px] hover:brightness-110 whitespace-nowrap"
          >
            Complete Profile →
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">Product Type</label>
          <select
            value={filters.productType || ''}
            onChange={(e) => handleFilterChange('productType', e.target.value || undefined)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2 outline-none focus:border-zovu-primary appearance-none"
          >
            <option value="">All Types</option>
            <option value="loan">Loan</option>
            <option value="insurance">Insurance</option>
            <option value="savings">Savings</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">Min Score</label>
          <input
            type="number"
            value={filters.minScore || ''}
            onChange={(e) => handleFilterChange('minScore', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary transition-colors"
            placeholder="e.g. 400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">Tier</label>
          <select
            value={filters.tier || 'All'}
            onChange={(e) => handleFilterChange('tier', e.target.value === 'All' ? undefined : e.target.value)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2 outline-none focus:border-zovu-primary appearance-none"
          >
            <option value="All">All Tiers</option>
            <option value="Bronze">Bronze</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
            <option value="Platinum">Platinum</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">LGA</label>
          <select
            value={filters.lga || ''}
            onChange={(e) => handleFilterChange('lga', e.target.value || undefined)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-3 py-2 outline-none focus:border-zovu-primary appearance-none"
          >
            <option value="">All LGAs</option>
            <option value="Surulere">Surulere</option>
            <option value="Ikeja">Ikeja</option>
            <option value="Oshodi">Oshodi</option>
            <option value="Lagos Island">Lagos Island</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">Min Amount (₦)</label>
          <input
            type="number"
            value={filters.minAmount || ''}
            onChange={(e) => handleFilterChange('minAmount', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary transition-colors"
            placeholder="0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-dm text-[12px] text-zovu-text">Max Amount (₦)</label>
          <input
            type="number"
            value={filters.maxAmount || ''}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary transition-colors"
            placeholder="1,000,000"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-[8px] text-center">
          <p className="text-red-400 font-dm text-[13px]">{error}</p>
          <button onClick={() => fetchBorrowers(filters)} className="mt-2 text-[12px] text-zovu-text-light bg-zovu-surface-2 px-3 py-1 rounded">Retry</button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-zovu-surface-1 rounded-[12px] border border-zovu-border" />)}
        </div>
      ) : borrowers.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border border-dashed rounded-[12px] p-10 text-center flex flex-col items-center">
          <p className="font-dm text-[15px] text-zovu-text-light font-medium mb-1">No customers match your filters.</p>
          <p className="font-dm text-[13px] text-zovu-text">Try adjusting your criteria to see more requests.</p>
          <button 
            onClick={() => setFilters({ minScore: undefined, tier: undefined, lga: undefined, minAmount: undefined, maxAmount: undefined, productType: undefined })}
            className="mt-4 px-4 py-2 bg-zovu-surface-2 hover:bg-zovu-border text-zovu-text-light font-dm text-[13px] rounded-[8px] transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                <p className="font-dm text-[13px] text-zovu-text">Repayment: <span className="text-zovu-text-light">{b.repayment_days} days</span></p>
                <p className="font-dm text-[13px] text-zovu-text mt-1">Requested: <span className="text-zovu-primary font-bold text-[15px]">₦{b.loan_amount_requested.toLocaleString('en-NG')}</span></p>
              </div>
              {lenderVerified ? (
                <Link
                  to={`/dashboard/partners/customers/${b.id}`}
                  className="mt-2 w-full py-2.5 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] text-center transition-colors border border-zovu-border"
                >
                  View Full Profile
                </Link>
              ) : (
                <button
                  disabled
                  className="mt-2 w-full py-2.5 bg-zovu-surface-2 opacity-60 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] text-center transition-colors border border-zovu-border cursor-not-allowed flex items-center justify-center gap-2"
                  title="Complete your profile to unlock customer profiles."
                >
                  <span>🔒</span> View Full Profile
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
