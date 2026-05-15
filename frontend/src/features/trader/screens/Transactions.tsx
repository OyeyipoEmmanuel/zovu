import React, { useEffect, useState, useCallback } from 'react';
import {
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { SkeletonTransaction, ErrorCard } from '../components';
import { fetchTransactions } from '../../../lib/api';
import { formatCurrency, formatRelativeTime } from '../../../lib/utils';
import type { Transaction } from '../../../lib/mockData';
import { useKYCGuard, KYCModal } from '../hooks';
import { useNavigate } from 'react-router-dom';
import { ComplaintModal } from '../../shared/ComplaintModal';

type FilterTab = 'all' | 'inflow' | 'outflow';

export const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const { kycComplete } = useKYCGuard();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complaintFor, setComplaintFor] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTransactions(filter);
      setTransactions(res.data);
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'inflow', label: 'Inflow' },
    { key: 'outflow', label: 'Outflow' },
  ];

  if (!kycComplete) {
    return <KYCModal onCancel={() => navigate('/dashboard/trader')} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">Transactions</h1>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zovu-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zovu-primary" />
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-zovu-surface-1 border border-zovu-border rounded-[10px] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-[8px] font-dm text-[13px] font-medium transition-all duration-200 ${
              filter === tab.key
                ? 'bg-zovu-primary text-zovu-primary-text'
                : 'text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && <ErrorCard message={error} onRetry={load} />}

      {/* Transactions List */}
      {!error && (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] overflow-hidden">
          {loading ? (
            <div className="divide-y divide-zovu-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonTransaction key={i} />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-zovu-surface-2 flex items-center justify-center mx-auto mb-4">
                <HiOutlineArrowDown size={28} className="text-zovu-text/40" />
              </div>
              <p className="font-dm text-[15px] text-zovu-text-light mb-1">No transactions yet</p>
              <p className="font-dm text-[13px] text-zovu-text max-w-xs mx-auto">
                Share your account number to receive your first payment.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zovu-border">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-4 hover:bg-zovu-surface-2/50 transition-colors duration-150">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      txn.type === 'inflow' ? 'bg-zovu-primary/10' : 'bg-red-500/10'
                    }`}
                  >
                    {txn.type === 'inflow' ? (
                      <HiOutlineArrowDown size={18} className="text-zovu-primary" />
                    ) : (
                      <HiOutlineArrowUp size={18} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-dm text-[14px] text-zovu-text-light truncate">{txn.counterparty}</p>
                    <p className="font-dm text-[11px] text-zovu-text mt-0.5">{txn.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-dm text-[14px] font-medium tabular-nums ${
                        txn.type === 'inflow' ? 'text-zovu-primary' : 'text-red-400'
                      }`}
                    >
                      {txn.type === 'inflow' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </p>
                    <p className="font-dm text-[11px] text-zovu-text mt-0.5">{formatRelativeTime(txn.timestamp)}</p>
                    <p className="font-dm text-[10px] text-zovu-text/50 mt-0.5 font-mono">{txn.reference}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComplaintFor(txn)}
                    title="Report an issue with this transaction"
                    aria-label="Report an issue with this transaction"
                    className="p-2 text-zovu-text hover:text-[#F4A11D] transition-colors"
                  >
                    <HiOutlineExclamationCircle size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {complaintFor && (
        <ComplaintModal
          transactionId={complaintFor.id}
          transactionLabel={`${complaintFor.counterparty} • ${formatCurrency(complaintFor.amount)}`}
          onClose={() => setComplaintFor(null)}
        />
      )}
    </div>
  );
};
