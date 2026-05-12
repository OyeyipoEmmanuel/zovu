import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-zovu-surface-2 rounded-[8px] ${className}`} />
);

export const SkeletonCard: React.FC = () => (
  <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
    <Skeleton className="h-3 w-24 mb-3" />
    <Skeleton className="h-7 w-36 mb-2" />
    <Skeleton className="h-3 w-20" />
  </div>
);

export const SkeletonTransaction: React.FC = () => (
  <div className="flex items-center gap-3 py-3 px-4">
    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
    <div className="flex-1">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
    <div className="text-right">
      <Skeleton className="h-4 w-20 mb-2 ml-auto" />
      <Skeleton className="h-3 w-16 ml-auto" />
    </div>
  </div>
);
