import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

export const CompleteProfileLayout: React.FC = () => {
  const location = useLocation();

  let step = 1;
  if (location.pathname.includes('/business')) step = 2;
  if (location.pathname.includes('/success')) step = 3;

  return (
    <div className="min-h-screen bg-zovu-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {step < 3 && (
          <div className="mb-8">
            <h1 className="font-syne text-[24px] font-bold text-zovu-text-light text-center mb-2">
              Complete your profile
            </h1>
            <p className="font-dm text-[14px] text-zovu-text text-center mb-6">
              Step {step} of 3
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-8 bg-zovu-primary'
                      : s < step
                      ? 'w-4 bg-zovu-primary/50'
                      : 'w-4 bg-zovu-surface-2'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 sm:p-8 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
