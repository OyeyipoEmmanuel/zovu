import React, { useEffect, useState } from 'react';
import type { ApplicationStatus } from '../../lib/api';

interface StyleSpec {
  label: string;
  /** Tailwind classes for bg + text + border. */
  classes: string;
}

const STATUS_STYLES: Record<ApplicationStatus, StyleSpec> = {
  pending: {
    label: 'Pending review',
    classes: 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20',
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  waiting_for_worker: {
    label: 'Waiting for worker',
    classes: 'bg-[#2A2A2A] text-zovu-text border-zovu-border',
  },
  worker_done: {
    label: 'Awaiting your confirmation',
    classes: 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20',
  },
  trader_confirmed: {
    label: 'Complete — Paid',
    classes: 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20',
  },
  trader_disputed: {
    label: 'Sent back to worker',
    classes: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  in_dispute: {
    label: 'In dispute — support reviewing',
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  resolved_paid: {
    label: 'Resolved — paid',
    classes: 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20',
  },
  resolved_refunded: {
    label: 'Resolved — refunded',
    classes: 'bg-zovu-surface-2 text-zovu-text border-zovu-border',
  },
};

export const EscrowStatusPill: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
  const spec = STATUS_STYLES[status] ?? {
    label: status,
    classes: 'bg-zovu-surface-2 text-zovu-text border-zovu-border',
  };
  return (
    <span
      className={`px-3 py-1 rounded-full border text-[11px] font-syne font-bold tracking-wider uppercase ${spec.classes}`}
    >
      {spec.label}
    </span>
  );
};

/**
 * Live-counts down to an ISO deadline. Ticks once a second while visible.
 * Renders "Expired" once the deadline has passed.
 */
export const Countdown: React.FC<{ deadline: string; className?: string }> = ({ deadline, className }) => {
  const computeRemaining = () => {
    const ms = new Date(deadline).getTime() - Date.now();
    return Math.max(0, ms);
  };
  const [remaining, setRemaining] = useState<number>(computeRemaining);

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(computeRemaining()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  if (remaining <= 0) {
    return <span className={className}>Expired</span>;
  }
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <span className={className}>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)} left
    </span>
  );
};

export default EscrowStatusPill;
