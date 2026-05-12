import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineLockClosed } from 'react-icons/hi';
import { useAuthStore } from '../../../stores';

export const useKYCGuard = () => {
  const { user } = useAuthStore();
  const kycComplete = user?.kycComplete ?? false;

  return {
    kycComplete,
  };
};

export const KYCModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] max-w-md w-full p-6 text-center shadow-2xl animate-slide-in">
        <div className="w-16 h-16 rounded-full bg-zovu-surface-2 flex items-center justify-center mx-auto mb-4 border border-zovu-border">
          <HiOutlineLockClosed size={28} className="text-zovu-text-light" />
        </div>
        <h2 className="font-syne text-[22px] font-bold text-zovu-text-light mb-2">
          Complete your profile first
        </h2>
        <p className="font-dm text-[14px] text-zovu-text mb-4 leading-relaxed">
          You need to verify your identity before you can receive payments, view transactions, or apply for a loan.
        </p>
        <p className="font-dm text-[13px] text-zovu-primary font-medium mb-6">
          This takes less than 2 minutes.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/dashboard/trader/complete-profile/kyc')}
            className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[15px] py-3.5 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all duration-200"
          >
            Complete Profile →
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-transparent text-zovu-text font-dm font-medium text-[14px] py-3 rounded-[10px] hover:text-zovu-text-light transition-colors duration-200"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
