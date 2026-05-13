import React from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { usePartnerStore } from '../../../stores/partnerStore';

export const PartnerCompleteProfile: React.FC = () => {
  const { currentProfileStep } = usePartnerStore();
  const location = useLocation();

  const isSuccess = location.pathname.includes('/success');

  const getStepProgress = () => {
    if (isSuccess) return 100;
    switch (currentProfileStep) {
      case 1: return 33;
      case 2: return 66;
      case 3: return 100;
      default: return 100;
    }
  };

  const getStepColor = (step: number) => {
    if (isSuccess || currentProfileStep === 'complete') return 'bg-zovu-primary text-zovu-primary-text border-zovu-primary';
    if (currentProfileStep > step) return 'bg-zovu-primary text-zovu-primary-text border-zovu-primary'; // completed
    if (currentProfileStep === step) return 'bg-[#F4A11D] text-[#0D0D0D] border-[#F4A11D]'; // active (amber)
    return 'bg-zovu-surface-2 text-zovu-text border-zovu-border'; // upcoming
  };

  const getTextClass = (step: number) => {
    if (isSuccess || currentProfileStep === 'complete' || currentProfileStep > step) return 'text-zovu-primary font-medium';
    if (currentProfileStep === step) return 'text-[#F4A11D] font-bold';
    return 'text-zovu-text';
  };

  // Redirect to step 1 if trying to access wrapper without sub-route
  if (location.pathname === '/dashboard/partners/complete-profile') {
    return <Navigate to="/dashboard/partners/complete-profile/account" replace />;
  }

  return (
    <div className="flex bg-zovu-background min-h-screen">
      <div className="flex-1 flex flex-col items-center p-6 md:p-10 overflow-y-auto">
        <div className="w-full max-w-2xl bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 sm:p-10">
          
          {/* Step Indicator */}
          {!isSuccess && (
            <div className="mb-10">
              <div className="flex justify-between items-center relative mb-3">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zovu-surface-2 rounded-full -z-10" />
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-zovu-primary rounded-full -z-10 transition-all duration-500" 
                  style={{ width: `${getStepProgress()}%` }}
                />
                
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-syne text-[14px] font-bold transition-colors ${getStepColor(1)}`}>
                  1
                </div>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-syne text-[14px] font-bold transition-colors ${getStepColor(2)}`}>
                  2
                </div>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-syne text-[14px] font-bold transition-colors ${getStepColor(3)}`}>
                  3
                </div>
              </div>
              <div className="flex justify-between text-center font-dm text-[12px] uppercase tracking-wider">
                <span className={`w-20 ${getTextClass(1)}`}>Account</span>
                <span className={`w-20 ${getTextClass(2)}`}>Identity</span>
                <span className={`w-20 ${getTextClass(3)}`}>Funding</span>
              </div>
            </div>
          )}

          {/* Child Routes Render Here */}
          <Outlet />

        </div>
      </div>
    </div>
  );
};
