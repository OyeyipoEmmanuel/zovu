import React, { useEffect, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { fetchVaDepositDetails, type VaDepositDetails } from '../../lib/api';

interface DepositModalProps {
  userId: string;
  onClose: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ userId, onClose }) => {
  const [amount, setAmount] = useState('5000');
  const [details, setDetails] = useState<VaDepositDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchVaDepositDetails(userId)
      .then((res) => {
        if (alive) setDetails(res);
      })
      .catch(() => {
        if (alive) setError('Could not load your deposit account details.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const amountValue = Number(amount || 0);
  const amountValid = amountValue >= 100;

  const handleAmountChange = (value: string) => {
    setAmount(value.replace(/[^\d]/g, ''));
  };

  const handleCopy = async () => {
    if (!details?.account_number) return;
    await navigator.clipboard.writeText(details.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[12px] border border-zovu-border bg-zovu-surface-1 shadow-xl">
        <div className="flex items-center justify-between border-b border-zovu-border px-5 py-4">
          <h2 className="font-syne text-[18px] font-bold text-zovu-text-light">Fund Wallet</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zovu-text hover:bg-zovu-surface-2 hover:text-zovu-text-light"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <label className="flex flex-col gap-2">
            <span className="font-dm text-[12px] uppercase tracking-wider text-zovu-text">Amount</span>
            <div className="flex items-center rounded-[8px] border border-zovu-border bg-zovu-surface-2 px-3">
              <span className="font-dm text-zovu-text">₦</span>
              <input
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                inputMode="numeric"
                className="w-full bg-transparent px-2 py-3 font-dm text-[16px] text-zovu-text-light outline-none"
                placeholder="5000"
              />
            </div>
            {!amountValid && <span className="font-dm text-[12px] text-red-400">Minimum deposit is ₦100.</span>}
          </label>

          {loading ? (
            <div className="h-36 animate-pulse rounded-[10px] bg-zovu-surface-2" />
          ) : error ? (
            <div className="rounded-[10px] border border-red-500/20 bg-red-500/10 p-4 font-dm text-[13px] text-red-300">
              {error}
            </div>
          ) : details ? (
            <>
              <div className="rounded-[10px] border border-[#1A6B4A]/30 bg-[#1A6B4A]/10 p-4">
                <p className="font-dm text-[11px] uppercase tracking-wider text-zovu-text">Account Number</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-syne text-[28px] font-bold tracking-wider text-zovu-text-light">
                    {details.account_number}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded-[8px] border border-zovu-border bg-zovu-surface-1 px-3 py-2 font-dm text-[12px] text-zovu-text-light hover:border-[#1A6B4A]"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 font-dm text-[13px] text-zovu-text">
                  <p>Bank name: <span className="text-zovu-text-light">{details.bank_name}</span></p>
                  <p>Account name: <span className="text-zovu-text-light">{details.account_name}</span></p>
                  <p>Reference: <span className="text-zovu-text-light">{details.payment_reference}</span></p>
                </div>
              </div>

              <p className="font-dm text-[13px] leading-6 text-zovu-text">
                Transfer ₦{(amountValid ? amountValue : 100).toLocaleString('en-NG')} to the account above using your
                GTBank app or any bank transfer. Your wallet balance will update automatically once the transfer clears.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
