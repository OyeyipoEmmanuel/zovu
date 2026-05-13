import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineLockClosed, HiOutlineCheck } from 'react-icons/hi';
import { useAuthStore, useTraderStore } from '../../../stores';
import { formatCurrency } from '../../../lib/utils';
import { applyForLoan } from '../../../lib/api';

export const LoanFlowModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const navigate = useNavigate();
  // const { user } = useAuthStore();
  const { pulseScore, pulseTier } = useTraderStore();
  
  const [step, setStep] = useState<1 | 2>(1);
  
  const [amount, setAmount] = useState<string>('');
  const [purpose, setPurpose] = useState('');
  const [repaymentPeriod, setRepaymentPeriod] = useState<'30' | '60' | '90'>('30');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMaxAmount = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 150000;
      case 'silver': return 300000;
      case 'gold': return 500000;
      case 'platinum': return 2000000;
      default: return 0;
    }
  };
  
  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10';
      case 'silver': return 'text-gray-300 bg-gray-300/10';
      case 'gold': return 'text-zovu-amber bg-zovu-amber/10';
      case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10';
      default: return 'text-zovu-text bg-zovu-surface-2';
    }
  };

  const maxAmount = getMaxAmount(pulseTier);
  const parsedAmount = parseInt(amount.replace(/\D/g, '')) || 0;
  const isAmountValid = parsedAmount > 0 && parsedAmount <= maxAmount;
  const isValid = isAmountValid && purpose !== '';
  
  // 3% per month
  const months = parseInt(repaymentPeriod) / 30;
  const interestRate = 0.03 * months;
  const totalRepayment = parsedAmount + (parsedAmount * interestRate);
  const monthlyRepayment = totalRepayment / months;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      await applyForLoan({
        amount: parsedAmount,
        purpose,
        repayment_period: repaymentPeriod,
      });
      setStep(2);
    } catch {
      setError('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (pulseScore < 400) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] max-w-md w-full p-6 sm:p-8 shadow-2xl animate-slide-in relative">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-zovu-text hover:text-zovu-text-light transition-colors"
          >
            ✕
          </button>
          
          <div className="w-16 h-16 rounded-full bg-zovu-surface-2 flex items-center justify-center mb-6 border border-zovu-border">
            <HiOutlineLockClosed size={28} className="text-zovu-text-light" />
          </div>
          
          <h2 className="font-syne text-[22px] font-bold text-zovu-text-light mb-2">
            You're not eligible yet
          </h2>
          <p className="font-dm text-[14px] text-zovu-text mb-6 leading-relaxed">
            Your current Pulse Score is <span className="font-semibold text-zovu-text-light">{pulseScore}</span>.<br />
            You need 400 to apply for a loan.
          </p>

          <div className="mb-8">
            <div className="flex justify-between font-dm text-[12px] text-zovu-text-light mb-2">
              <span>{pulseScore}</span>
              <span>400</span>
            </div>
            <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-zovu-amber rounded-full"
                style={{ width: `${Math.min((pulseScore / 400) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-zovu-surface-2/50 rounded-[12px] p-4 mb-6">
            <p className="font-dm text-[13px] font-medium text-zovu-text-light mb-3">
              What will raise your score fastest:
            </p>
            <ul className="flex flex-col gap-2">
              <li className="flex items-start gap-2 font-dm text-[13px] text-zovu-text">
                <span className="text-zovu-amber">✦</span> Receive payments consistently into your Zovu account
              </li>
              <li className="flex items-start gap-2 font-dm text-[13px] text-zovu-text">
                <span className="text-zovu-amber">✦</span> Complete gigs on time
              </li>
              <li className="flex items-start gap-2 font-dm text-[13px] text-zovu-text">
                <span className="text-zovu-amber">✦</span> Build your repayment history
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              onCancel();
              navigate('/dashboard/trader/pulse');
            }}
            className="w-full bg-transparent border border-zovu-border text-zovu-text-light font-dm font-medium text-[15px] py-3.5 rounded-[10px] hover:border-zovu-amber transition-colors duration-200"
          >
            See what affects my score →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] max-w-md w-full p-6 sm:p-8 shadow-2xl animate-slide-in relative my-8">
        {step === 1 && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-zovu-text hover:text-zovu-text-light transition-colors z-10"
          >
            ✕
          </button>
        )}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 pt-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-syne text-[22px] font-bold text-zovu-text-light">Loan Application</h2>
                <span className={`font-dm text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTierColor(pulseTier)}`}>
                  {pulseTier}
                </span>
              </div>
              <p className="font-dm text-[13px] text-zovu-text">
                Max loan amount: <span className="font-semibold text-zovu-text-light">{formatCurrency(maxAmount)}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 text-center">
                <p className="font-dm text-[13px] text-red-400">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="font-dm text-[13px] text-zovu-text-light font-medium">How much do you need?</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-syne text-[16px] text-zovu-text">₦</span>
                <input
                  type="text"
                  value={amount ? parseInt(amount.replace(/\D/g, '') || '0').toLocaleString('en-NG') : ''}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent border border-zovu-border rounded-[8px] font-syne text-[16px] font-bold text-zovu-text-light pl-8 pr-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                />
              </div>
              {parsedAmount > maxAmount && (
                <span className="font-dm text-[11px] text-red-400 mt-1">Amount exceeds your tier maximum.</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-dm text-[13px] text-zovu-text-light font-medium">What is it for?</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
              >
                <option value="" disabled>Select purpose</option>
                <option value="Restocking">Restocking</option>
                <option value="Equipment">Equipment</option>
                <option value="Rent">Rent</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-dm text-[13px] text-zovu-text-light font-medium">Repayment period</label>
              <div className="flex gap-1 p-1 bg-zovu-surface-2 border border-zovu-border rounded-[8px]">
                {(['30', '60', '90'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRepaymentPeriod(p)}
                    className={`flex-1 py-2 rounded-[6px] font-dm text-[12px] font-medium transition-all ${
                      repaymentPeriod === p ? 'bg-zovu-primary text-zovu-primary-text' : 'text-zovu-text'
                    }`}
                  >
                    {p} days
                  </button>
                ))}
              </div>
            </div>

            {/* Live Summary Card */}
            <div className="bg-[#121212] border border-zovu-border rounded-[12px] p-4 mt-2">
              <h4 className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-3">Summary</h4>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between font-dm text-[13px]">
                  <span className="text-zovu-text">Loan amount:</span>
                  <span className="text-zovu-text-light">{formatCurrency(parsedAmount)}</span>
                </div>
                <div className="flex justify-between font-dm text-[13px]">
                  <span className="text-zovu-text">Interest rate:</span>
                  <span className="text-zovu-text-light">3%/month</span>
                </div>
                <div className="w-full h-px bg-zovu-border my-1" />
                <div className="flex justify-between font-dm text-[13px]">
                  <span className="text-zovu-text">Total repayment:</span>
                  <span className="text-zovu-text-light font-semibold">{formatCurrency(totalRepayment)}</span>
                </div>
                <div className="flex justify-between font-dm text-[13px]">
                  <span className="text-zovu-text">Monthly repayment:</span>
                  <span className="text-zovu-primary font-medium">{formatCurrency(monthlyRepayment)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center text-center pt-4">
            <div className="w-16 h-16 bg-zovu-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <div className="w-10 h-10 bg-zovu-primary rounded-full flex items-center justify-center text-zovu-primary-text shadow-lg">
                <HiOutlineCheck size={24} />
              </div>
            </div>

            <h2 className="font-syne text-[22px] font-bold text-zovu-text-light mb-2">
              Application Submitted
            </h2>
            <p className="font-dm text-[14px] text-zovu-text mb-8 leading-relaxed">
              Your loan request of <span className="font-semibold text-zovu-text-light">{formatCurrency(parsedAmount)}</span> has been sent to verified lenders on the Zovu network.
            </p>

            <div className="w-full bg-zovu-surface-2 rounded-[12px] p-5 text-left mb-8">
              <p className="font-dm text-[13px] font-medium text-zovu-text-light mb-3">
                What happens next:
              </p>
              <ol className="flex flex-col gap-2 font-dm text-[13px] text-zovu-text">
                <li><span className="text-zovu-text-light mr-1">1.</span> Lenders review your Pulse Score and profile</li>
                <li><span className="text-zovu-text-light mr-1">2.</span> A matched lender approves your request</li>
                <li><span className="text-zovu-text-light mr-1">3.</span> Funds are sent directly to your Zovu account</li>
              </ol>
              <p className="font-dm text-[12px] text-zovu-primary mt-4 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zovu-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-zovu-primary" />
                </span>
                Estimated time: within 24 hours
              </p>
            </div>

            <button
              onClick={() => {
                onCancel();
                navigate('/dashboard/trader');
              }}
              className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
