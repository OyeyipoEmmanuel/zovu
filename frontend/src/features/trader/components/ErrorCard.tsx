import React from 'react';
import { HiOutlineRefresh } from 'react-icons/hi';

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  message = 'Something went wrong. Please try again.',
  onRetry,
}) => (
  <div className="bg-zovu-surface-1 border border-red-500/20 rounded-[12px] p-6 text-center">
    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </div>
    <p className="font-dm text-[14px] text-zovu-text mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[13px] text-zovu-text-light hover:border-zovu-primary transition-colors duration-200"
      >
        <HiOutlineRefresh size={16} />
        Retry
      </button>
    )}
  </div>
);
