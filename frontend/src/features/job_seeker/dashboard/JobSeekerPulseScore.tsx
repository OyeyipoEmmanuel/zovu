import React, { useEffect, useState } from 'react';
import { jobSeekerAPI } from '../../../lib/api';

const getTierColorHex = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'bronze': return '#CD7F32';
    case 'silver': return '#C0C0C0';
    case 'gold': return '#F4A11D';
    case 'platinum': return '#E5E4E2';
    default: return '#1A6B4A';
  }
};

export const JobSeekerPulseScore: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState<any>(null);
  const [history, setHistory] = useState<{ month: string; score: number }[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pulseRes, histRes] = await Promise.all([
        jobSeekerAPI.getPulseScore(),
        jobSeekerAPI.getPulseHistory(),
      ]);
      setPulse(pulseRes);
      setHistory(histRes as { month: string; score: number }[]);
    } catch {
      setError('Failed to load Pulse Score');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-40 bg-zovu-surface-1 rounded" />
        <div className="h-48 bg-zovu-surface-1 rounded-[16px]" />
        <div className="h-40 bg-zovu-surface-1 rounded-[16px]" />
        <div className="h-60 bg-zovu-surface-1 rounded-[16px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto w-full">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      </div>
    );
  }

  const score = pulse.score;
  const tier = pulse.tier;
  const signals = pulse.signals;
  const tierHex = getTierColorHex(tier);
  const nextTierScore = 400;
  const progressToNext = Math.min((score / nextTierScore) * 100, 100);

  // SVG arc
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = Math.min(score / 1000, 1);
  const arcOffset = circumference - (scorePercent * circumference) / 2;

  // Chart dimensions
  const chartW = 600;
  const chartH = 160;
  const chartPadX = 40;
  const chartPadY = 20;
  const maxScore = Math.max(...history.map(h => h.score), 400);
  const points = history.map((h, i) => {
    const x = chartPadX + (i / (history.length - 1)) * (chartW - chartPadX * 2);
    const y = chartH - chartPadY - ((h.score / maxScore) * (chartH - chartPadY * 2));
    return { x, y, ...h };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-8">
      <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">Pulse Score</h1>

      {/* Score Arc */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-8 flex flex-col items-center">
        <div className="relative w-48 h-24 overflow-hidden mb-4">
          <svg className="w-full h-48" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="#2A2A2A" strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={circumference / 2} transform="rotate(180 80 80)" />
            <circle cx="80" cy="80" r={radius} fill="none" stroke={tierHex} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={arcOffset} strokeLinecap="round" transform="rotate(180 80 80)" className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute bottom-0 left-0 w-full text-center">
            <span className="font-syne text-[40px] font-bold text-zovu-text-light">{score}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-1 rounded-full text-[12px] font-dm font-semibold uppercase tracking-wider" style={{ backgroundColor: `${tierHex}20`, color: tierHex, border: `1px solid ${tierHex}30` }}>{tier}</span>
        </div>
        <p className="font-dm text-[14px] text-zovu-text">Reach 400 to unlock loans</p>

        {/* Progress to next tier */}
        <div className="w-full max-w-sm mt-6">
          <div className="flex justify-between font-dm text-[12px] text-zovu-text mb-2">
            <span>{score} / {nextTierScore}</span>
            <span>Silver</span>
          </div>
          <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progressToNext}%`, backgroundColor: tierHex }} />
          </div>
        </div>
      </div>

      {/* Signal Breakdown */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6">
        <h2 className="font-syne text-[18px] font-bold text-zovu-text-light mb-5">Signal Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {signals.map((sig: { label: string; value: number }, i: number) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-dm text-[13px] text-zovu-text">{sig.label}</span>
                <span className="font-dm text-[13px] font-medium text-zovu-text-light">{sig.value}%</span>
              </div>
              <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${sig.value}%`, backgroundColor: sig.value === 0 ? '#A0A0A0' : tierHex }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score History */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6">
        <h2 className="font-syne text-[18px] font-bold text-zovu-text-light mb-5">Score History</h2>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto min-w-[300px]" preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0, 100, 200, 300, 400].map(v => {
              const y = chartH - chartPadY - ((v / maxScore) * (chartH - chartPadY * 2));
              return (
                <g key={v}>
                  <line x1={chartPadX} y1={y} x2={chartW - chartPadX} y2={y} stroke="#2A2A2A" strokeWidth="0.5" />
                  <text x={chartPadX - 8} y={y + 4} fill="#A0A0A0" fontSize="10" textAnchor="end" fontFamily="DM Sans">{v}</text>
                </g>
              );
            })}
            {/* Area fill */}
            <polygon points={`${points[0].x},${chartH - chartPadY} ${polyline} ${points[points.length - 1].x},${chartH - chartPadY}`} fill={`${tierHex}10`} />
            {/* Line */}
            <polyline points={polyline} fill="none" stroke={tierHex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dots + labels */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="4" fill={tierHex} />
                <text x={p.x} y={p.y - 10} fill="#F5F5F5" fontSize="10" textAnchor="middle" fontFamily="DM Sans" fontWeight="600">{p.score}</text>
                <text x={p.x} y={chartH - 4} fill="#A0A0A0" fontSize="10" textAnchor="middle" fontFamily="DM Sans">{p.month}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6">
        <h2 className="font-syne text-[18px] font-bold text-zovu-text-light mb-5">What Affects Your Score</h2>
        <div className="flex flex-col gap-4">
          {[
            { icon: '⏱️', text: 'Complete gigs on time — boosts Punctuality Index' },
            { icon: '💰', text: 'Receive payments consistently — boosts Transaction Frequency' },
            { icon: '✅', text: 'Accept and complete more gigs — boosts Gig Completion Rate' },
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3 bg-zovu-surface-2/50 rounded-[12px] p-4 border border-zovu-border/50">
              <span className="text-[20px]">{tip.icon}</span>
              <p className="font-dm text-[14px] text-zovu-text-light">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Loan CTA */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-syne text-[18px] font-bold text-zovu-text-light mb-1">Apply for a Loan</h3>
          <p className="font-dm text-[14px] text-zovu-text">Reach 400 to unlock · You're {nextTierScore - score} points away</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progressToNext}%`, backgroundColor: tierHex }} />
          </div>
          <button disabled className="px-6 py-3 bg-zovu-surface-2 text-zovu-text font-dm font-bold text-[14px] rounded-[8px] cursor-not-allowed opacity-50 flex items-center gap-2">
            🔒 Locked
          </button>
        </div>
      </div>
    </div>
  );
};
