import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  // Card: surface #161616, border #2A2A2A, padding 24px (p-6)
  return (
    <div className={`bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    {children}
  </div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`font-syne text-[24px] font-semibold text-zovu-text-light leading-[1.3] ${className}`}>
    {children}
  </h3>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`font-dm text-[16px] text-zovu-text leading-[1.5] ${className}`}>
    {children}
  </div>
);
