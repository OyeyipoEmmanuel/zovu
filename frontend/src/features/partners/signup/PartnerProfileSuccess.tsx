import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerStore } from '../../../stores/partnerStore';

export const PartnerProfileSuccess: React.FC = () => {
  const navigate = useNavigate();
  const { setLenderVerified } = usePartnerStore();

  useEffect(() => {
    // Lift the feature gates!
    setLenderVerified(true);
  }, [setLenderVerified]);

  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 py-10">
      <div className="w-20 h-20 bg-zovu-primary/20 rounded-full flex items-center justify-center mb-4">
        <div className="w-12 h-12 bg-zovu-primary rounded-full flex items-center justify-center text-zovu-primary-text shadow-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="font-syne text-[28px] font-bold text-zovu-text-light">
        ✓ You're verified as a Partner on Zovu
      </h2>

      <p className="font-dm text-[16px] text-zovu-text max-w-md mx-auto leading-relaxed">
        You can now browse verified customers, unlock profiles, and offer financial services directly to their Zovu Squad accounts.
      </p>

      <div className="bg-zovu-surface-2 border border-zovu-border rounded-[12px] p-6 text-left w-full mt-4">
        <h3 className="font-syne text-[16px] font-bold text-zovu-text-light mb-3">What's next:</h3>
        <ul className="flex flex-col gap-3 font-dm text-[14px] text-zovu-text">
          <li className="flex gap-2"><span>→</span> Browse the customer pool</li>
          <li className="flex gap-2"><span>→</span> Filter by Pulse Score, tier, and location</li>
          <li className="flex gap-2"><span>→</span> Unlock a profile to see full details</li>
          <li className="flex gap-2"><span>→</span> Offer services with one click via Squad</li>
        </ul>
      </div>

      <button
        onClick={() => navigate('/dashboard/partners/customers')}
        className="w-full mt-6 bg-zovu-primary text-zovu-primary-text font-dm font-bold text-[16px] py-4 rounded-[8px] hover:brightness-110 transition-all flex items-center justify-center gap-2"
      >
        Go to Customer Pool →
      </button>
    </div>
  );
};
