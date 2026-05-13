import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerStore } from '../../../stores/partnerStore';
import { lenderProfileAPI } from '../../../lib/api';

export const PartnerStep1Account: React.FC = () => {
  const navigate = useNavigate();
  const { setAccountType, setOrganizationName, setCurrentProfileStep, setPartnerType } = usePartnerStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<'microfinance' | 'insurance' | 'cooperative' | 'fintech' | 'individual' | ''>('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountTypes = [
    { id: 'microfinance', label: 'Microfinance Bank', description: 'Offer loans to verified Zovu users' },
    { id: 'insurance', label: 'Insurance Provider', description: 'Offer insurance products to Zovu users' },
    { id: 'cooperative', label: 'Cooperative Society', description: 'Offer loans and savings to members' },
    { id: 'fintech', label: 'Fintech', description: 'Offer digital financial products' },
    { id: 'individual', label: 'Individual Lender', description: 'Lend directly to verified borrowers' },
  ] as const;

  const isValid = name.trim().length > 0 && type !== '' && phone.trim().length === 11 && /^\d+$/.test(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      await lenderProfileAPI.step1({
        organization_name: name,
        account_type: type as any,
        phone,
      });

      setAccountType(type);
      setPartnerType(type);
      setOrganizationName(name);
      setCurrentProfileStep(2);
      navigate('/dashboard/partners/complete-profile/identity');
    } catch (err: any) {
      setError(err.message || 'Failed to submit profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-syne text-[24px] font-bold text-zovu-text-light">Account Details</h2>
        <p className="font-dm text-[14px] text-zovu-text">Tell us about yourself or your organization.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Full Name / Organization Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
            placeholder="e.g. Zovu Capital"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Partner Type</label>
          <div className="grid grid-cols-1 gap-3">
            {accountTypes.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`py-3 px-4 rounded-[8px] border text-left transition-all ${
                  type === opt.id 
                    ? 'bg-zovu-primary/10 border-zovu-primary' 
                    : 'bg-zovu-surface-2 border-zovu-border hover:border-zovu-text/30'
                }`}
              >
                <p className={`font-dm text-[14px] font-medium ${type === opt.id ? 'text-zovu-primary' : 'text-zovu-text-light'}`}>
                  {opt.label}
                </p>
                <p className="font-dm text-[12px] text-zovu-text mt-0.5">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-dm text-[14px] text-zovu-text-light font-medium">Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length <= 11) setPhone(val);
            }}
            className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
            placeholder="08012345678"
          />
          {phone.length > 0 && phone.length !== 11 && (
            <span className="font-dm text-[12px] text-red-400">Phone number must be exactly 11 digits</span>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 text-red-400 font-dm text-[13px]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-bold text-[16px] py-4 rounded-[8px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
          {loading ? 'Saving...' : 'Continue →'}
        </button>
      </form>
    </div>
  );
};
