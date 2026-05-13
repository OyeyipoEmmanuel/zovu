import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerStore } from '../../../stores/partnerStore';
import { lenderProfileAPI } from '../../../lib/api';

const BANKS = ['GTBank', 'Access Bank', 'First Bank', 'UBA', 'Zenith', 'Sterling', 'Kuda', 'Opay', 'Palmpay', 'Other'];
const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const LGAS = ['Surulere', 'Ikeja', 'Oshodi', 'Lagos Island', 'Yaba', 'Lekki'];

export const PartnerStep3Funding: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentProfileStep } = usePartnerStore();

  const [bankName, setBankName] = useState(BANKS[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [fetchingName, setFetchingName] = useState(false);
  
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  const [preferredTiers, setPreferredTiers] = useState<string[]>([]);
  const [preferredLgas, setPreferredLgas] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto fetch account name when account number is 10 digits
  useEffect(() => {
    if (accountNumber.length === 10) {
      setFetchingName(true);
      // Simulate fetching
      const timer = setTimeout(() => {
        setAccountName("ADEOLA JAMES COOPERATIVE");
        setFetchingName(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setAccountName('');
    }
  }, [accountNumber, bankName]);

  const toggleTier = (tier: string) => {
    setPreferredTiers(prev => 
      prev.includes(tier) ? prev.filter(t => t !== tier) : [...prev, tier]
    );
  };

  const min = Number(minAmount);
  const max = Number(maxAmount);
  
  const isValid = 
    accountNumber.length === 10 && 
    accountName !== '' && 
    minAmount !== '' && 
    maxAmount !== '' && 
    max > min;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      await lenderProfileAPI.step3({
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        min_lending_amount: min,
        max_lending_amount: max,
        preferred_tiers: preferredTiers,
        preferred_lgas: preferredLgas,
      });

      setCurrentProfileStep('complete');
      navigate('/dashboard/partners/complete-profile/success');
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-syne text-[24px] font-bold text-zovu-text-light">Funding & Preferences</h2>
        <p className="font-dm text-[14px] text-zovu-text">Connect your wallet and set your lending preferences.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-dm text-[14px] text-zovu-text-light font-medium">Bank Name</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
            >
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-dm text-[14px] text-zovu-text-light font-medium">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if (val.length <= 10) setAccountNumber(val);
              }}
              className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
              placeholder="10 digit account number"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Account Name</label>
          <div className="relative">
            <input
              type="text"
              value={accountName}
              readOnly
              className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none opacity-80 cursor-not-allowed"
              placeholder={fetchingName ? 'Verifying account...' : ''}
            />
            {fetchingName && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-zovu-primary/30 border-t-zovu-primary rounded-full animate-spin" />
            )}
          </div>
          <p className="font-dm text-[12px] text-zovu-text">We use this to verify your funding account</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-dm text-[14px] text-zovu-text-light font-medium">Minimum Loan Amount (₦)</label>
            <input
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
              placeholder="e.g. 10000"
            />
            <p className="font-dm text-[12px] text-zovu-text">The minimum amount you are willing to lend per borrower</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-dm text-[14px] text-zovu-text-light font-medium">Maximum Loan Amount (₦)</label>
            <input
              type="number"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
              placeholder="e.g. 500000"
            />
            {maxAmount !== '' && minAmount !== '' && max <= min && (
              <span className="font-dm text-[12px] text-red-400">Max amount must be greater than min amount</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Preferred Borrower Tiers (Optional)</label>
          <div className="flex flex-wrap gap-3">
            {TIERS.map(tier => (
              <button
                key={tier}
                type="button"
                onClick={() => toggleTier(tier)}
                className={`py-2 px-4 rounded-full border text-left font-dm text-[13px] transition-all ${
                  preferredTiers.includes(tier)
                    ? 'bg-zovu-primary text-zovu-primary-text border-zovu-primary' 
                    : 'bg-zovu-surface-2 border-zovu-border text-zovu-text hover:border-zovu-text/30'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Preferred LGAs (Optional)</label>
          <select
            multiple
            value={preferredLgas}
            onChange={(e) => {
              const options = Array.from(e.target.selectedOptions, option => option.value);
              setPreferredLgas(options);
            }}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors h-32"
          >
            {LGAS.map(lga => <option key={lga} value={lga}>{lga}</option>)}
          </select>
          <p className="font-dm text-[12px] text-zovu-text">Hold Ctrl/Cmd to select multiple. Leave empty to show all LGAs</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 text-red-400 font-dm text-[13px]">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setCurrentProfileStep(2);
              navigate('/dashboard/partners/complete-profile/identity');
            }}
            className="flex-1 py-4 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[15px] font-medium rounded-[8px] transition-colors border border-zovu-border"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!isValid || loading || fetchingName}
            className="flex-[2] bg-zovu-primary text-zovu-primary-text font-dm font-bold text-[16px] py-4 rounded-[8px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
            {loading ? 'Submitting...' : 'Complete Profile →'}
          </button>
        </div>
      </form>
    </div>
  );
};
