import React, { useEffect, useState, useCallback } from 'react';
import { SkeletonCard, ErrorCard } from '../components';
import { fetchPulseScore, fetchPulseHistory } from '../../../lib/api';
import { formatCurrency } from '../../../lib/utils';
import { useKYCGuard, KYCModal } from '../hooks';
import { LoanFlowModal } from './LoanFlowModal';
import { useNavigate } from 'react-router-dom';
import type { PulseSignal, PulseHistoryPoint } from '../../../lib/mockData';

const ArcGauge: React.FC<{ score: number; maxScore: number }> = ({ score, maxScore }) => {
  const radius = 100;
  const stroke = 12;
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  const progress = score / maxScore;
  const cx = 120;
  const cy = 120;

  const polarToCartesian = (angle: number): { x: number; y: number } => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arcPath = (start: number, end: number): string => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const progressAngle = startAngle + totalAngle * progress;

  return (
    <svg viewBox="0 0 240 200" className="w-full max-w-[280px] mx-auto">
      {/* Background arc */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke="#2A2A2A"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* Progress arc */}
      <path
        d={arcPath(startAngle, progressAngle)}
        fill="none"
        stroke="#1A6B4A"
        strokeWidth={stroke}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
      {/* Score text */}
      <text x={cx} y={cy - 10} textAnchor="middle" className="fill-zovu-text-light font-syne text-[48px] font-bold">
        {score}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-[#A0A0A0] font-dm text-[14px]">
        out of {maxScore}
      </text>
    </svg>
  );
};

const SignalBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <span className="font-dm text-[13px] text-zovu-text-light">{label}</span>
      <span className="font-dm text-[13px] text-zovu-text font-medium tabular-nums">{value}%</span>
    </div>
    <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
      <div
        className="h-full bg-zovu-primary rounded-full transition-all duration-700 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const HistoryChart: React.FC<{ data: PulseHistoryPoint[] }> = ({ data }) => {
  if (data.length === 0) return null;
  const maxScore = 850;
  const chartW = 500;
  const chartH = 180;
  const padX = 40;
  const padY = 20;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * plotW,
    y: padY + plotH - (d.score / maxScore) * plotH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padY + plotH} L ${points[0].x} ${padY + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1A6B4A" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#1A6B4A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={padX}
          y1={padY + plotH * (1 - t)}
          x2={padX + plotW}
          y2={padY + plotH * (1 - t)}
          stroke="#2A2A2A"
          strokeWidth="1"
        />
      ))}
      {/* Area fill */}
      <path d={areaD} fill="url(#areaGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="#1A6B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#1A6B4A" stroke="#0D0D0D" strokeWidth="2" />
          <text x={p.x} y={chartH - 2} textAnchor="middle" className="fill-[#A0A0A0] font-dm text-[11px]">
            {data[i].month}
          </text>
          <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-[#F5F5F5] font-dm text-[10px] font-medium">
            {data[i].score}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const PulseScore: React.FC = () => {
  const navigate = useNavigate();
  const { kycComplete } = useKYCGuard();
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(850);
  const [tier, setTier] = useState('');
  const [loanEligibility, setLoanEligibility] = useState(0);
  const [signals, setSignals] = useState<PulseSignal[]>([]);
  const [history, setHistory] = useState<PulseHistoryPoint[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pulseData, historyData] = await Promise.all([
        fetchPulseScore(),
        fetchPulseHistory(),
      ]);
      setScore(pulseData.score);
      setMaxScore(pulseData.maxScore);
      setTier(pulseData.tier);
      setLoanEligibility(pulseData.loanEligibility);
      setSignals(pulseData.signals);
      setHistory(historyData);
    } catch {
      setError('Failed to load Pulse Score.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApplyClick = () => {
    if (!kycComplete) {
      setShowKYCModal(true);
    } else {
      setShowLoanModal(true);
    }
  };

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      {showKYCModal && <KYCModal onCancel={() => setShowKYCModal(false)} />}
      {showLoanModal && <LoanFlowModal onCancel={() => setShowLoanModal(false)} />}
      
      <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">Pulse Score</h1>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          {/* Score Arc */}
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 text-center">
            <ArcGauge score={score} maxScore={maxScore} />
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="font-dm text-[12px] font-semibold text-zovu-amber bg-zovu-amber/10 px-3 py-1 rounded-full uppercase tracking-wider">
                {tier}
              </span>
            </div>
            <p className="font-dm text-[14px] text-zovu-text mt-3">
              You are eligible for loans up to <span className="text-zovu-primary font-semibold">{formatCurrency(loanEligibility)}</span>
            </p>
          </div>

          {/* Signal Breakdown */}
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 sm:p-6">
            <h3 className="font-syne text-[16px] font-semibold text-zovu-text-light mb-5">Signal Breakdown</h3>
            <div className="flex flex-col gap-4">
              {signals.map((s) => (
                <SignalBar key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          </div>

          {/* Score History */}
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 sm:p-6">
            <h3 className="font-syne text-[16px] font-semibold text-zovu-text-light mb-4">Score History</h3>
            <HistoryChart data={history} />
          </div>

          {/* Apply for Loan CTA */}
          <button 
            onClick={handleApplyClick}
            className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all duration-200"
          >
            Apply for a Loan
          </button>
        </>
      )}
    </div>
  );
};
