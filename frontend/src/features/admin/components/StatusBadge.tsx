
import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'complaint' | 'fraud' | 'partnership' | 'urgency' | 'account';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'complaint' }) => {
  const getStyles = () => {
    const s = status.toLowerCase();
    
    if (type === 'urgency') {
      if (s === 'high') return 'bg-red-500/10 text-red-400 border-red-500/20';
      if (s === 'medium') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }

    if (type === 'fraud' || type === 'account') {
      if (s === 'active' || s === 'resolved') return 'bg-green-500/10 text-green-400 border-green-500/20';
      if (s === 'paused' || s === 'investigating') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      if (s === 'deleted' || s === 'high') return 'bg-red-500/10 text-red-400 border-red-500/20';
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }

    if (type === 'partnership') {
      if (s === 'active' || s === 'approved') return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
      if (s === 'pending' || s === 'under_review') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      if (s === 'rejected' || s === 'suspended') return 'bg-red-500/10 text-red-400 border-red-500/20';
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }

    // Default: complaint status
    switch (s) {
      case 'new': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'investigating': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'resolved': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'escalated': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'invalid': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'fraud_detected': return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const label = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${getStyles()}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
