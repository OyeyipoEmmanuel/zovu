import React, { useEffect, useState } from 'react';
import { jobSeekerAPI, fetchUserProfile, type UserProfile } from '../../../lib/api';
import type { JSTransaction } from '../../../lib/mockData';
import { ComplaintModal } from '../../shared/ComplaintModal';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, Check } from 'lucide-react';

const formatTime = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
};

export const JobSeekerTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<JSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [copiedAcct, setCopiedAcct] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [vaBalance, setVaBalance] = useState(0);
  const [complaintFor, setComplaintFor] = useState<JSTransaction | null>(null);

  const vaNumber = profile?.squadVaNumber || '';
  const vaBank = profile?.squadVaBank || '';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, prof, dash] = await Promise.all([
        jobSeekerAPI.getTransactions(filter === 'all' ? undefined : filter),
        fetchUserProfile(),
        jobSeekerAPI.getDashboard().catch(() => null),
      ]);
      setTransactions(data);
      setProfile(prof);
      if (dash) setVaBalance(Math.round((dash.squad_va_balance ?? 0) / 100));
    } catch {
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleCopyRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const handleCopyAcct = () => {
    navigator.clipboard.writeText(vaNumber);
    setCopiedAcct(true);
    setTimeout(() => setCopiedAcct(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">Transactions</h1>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#1A6B4A] animate-pulse" />
          <span className="font-dm text-[12px] text-[#1A6B4A] font-medium">Live</span>
        </div>
      </div>

      {/* Squad VA Card */}
      <div className="bg-gradient-to-br from-[#1A6B4A]/20 to-zovu-surface-1 border border-[#1A6B4A]/30 rounded-[16px] p-6">
        <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-1">Squad Virtual Account</p>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-syne text-[20px] font-bold text-zovu-text-light tracking-wider">{vaNumber}</span>
          <button
            type="button"
            onClick={handleCopyAcct}
            className="text-zovu-text hover:text-[#1A6B4A] transition-colors font-dm text-[12px] flex items-center gap-1"
          >
            {copiedAcct ? (
              <>
                <Check size={12} /> Copied
              </>
            ) : (
              <>
                <Copy size={12} /> Copy
              </>
            )}
          </button>
        </div>
        <p className="font-dm text-[13px] text-zovu-text mb-2">{vaBank}</p>
        <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-1">Balance</p>
        <span className="font-syne text-[28px] font-bold text-[#1A6B4A]">₦{vaBalance.toLocaleString('en-NG')}</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-zovu-border">
        {(['all', 'inflow', 'outflow'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-6 py-3 font-dm text-[14px] font-medium capitalize border-b-2 -mb-[1px] transition-colors ${
              filter === tab ? 'border-[#1A6B4A] text-[#1A6B4A]' : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'inflow' ? 'Inflow' : 'Outflow'}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 animate-pulse flex justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zovu-surface-2" />
                <div className="flex flex-col gap-2"><div className="h-4 w-32 bg-zovu-surface-2 rounded" /><div className="h-3 w-20 bg-zovu-surface-2 rounded" /></div>
              </div>
              <div className="h-5 w-20 bg-zovu-surface-2 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-12 text-center">
          <p className="font-dm text-[15px] text-zovu-text">No transactions yet. Share your account number to receive your first payment.</p>
        </div>
      ) : (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] divide-y divide-zovu-border/50">
          {transactions.map(txn => {
            // Phase-1 enrichment: backend now provides purpose, senderName,
            // receiverName. Surface all three so the row clearly answers
            // "what was this, from whom, to whom".
            const purpose = txn.purpose || txn.description;
            const senderName = txn.senderName || 'ZOVU system';
            const receiverName = txn.receiverName || 'ZOVU system';
            return (
              <div key={txn.id} className="flex items-center justify-between p-4 hover:bg-zovu-surface-2/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${txn.type === 'inflow' ? 'bg-[#1A6B4A]/10 text-[#1A6B4A]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                    {txn.type === 'inflow' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-dm text-[14px] text-zovu-text-light font-medium truncate">{txn.counterparty}</p>
                    <p className="font-dm text-[12px] text-zovu-text mt-0.5 truncate">{purpose}</p>
                    <p className="font-dm text-[11px] text-zovu-text/70 mt-0.5 truncate">
                      <span className="text-zovu-text/50">From</span> {senderName}{' '}
                      <span className="text-zovu-text/50">→</span> {receiverName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-dm text-[11px] text-zovu-text">{formatTime(txn.timestamp)}</span>
                      <span className="text-zovu-border">·</span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(txn.reference)}
                        className="font-dm text-[11px] text-zovu-text hover:text-[#1A6B4A] transition-colors inline-flex items-center gap-1"
                      >
                        {copiedRef === txn.reference ? (
                          <><Check size={10} /> Copied</>
                        ) : (
                          txn.reference
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-syne text-[16px] font-bold ${txn.type === 'inflow' ? 'text-[#1A6B4A]' : 'text-[#EF4444]'}`}>
                    {txn.type === 'inflow' ? '+' : '-'}₦{txn.amount.toLocaleString('en-NG')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setComplaintFor(txn)}
                    title="Report an issue"
                    aria-label="Report an issue"
                    className="p-2 rounded-md text-zovu-text hover:text-[#F4A11D] hover:bg-zovu-surface-2/60 transition-colors"
                  >
                    <AlertTriangle size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {complaintFor && (
        <ComplaintModal
          transactionId={complaintFor.id}
          transactionLabel={`${complaintFor.counterparty} • ₦${complaintFor.amount.toLocaleString('en-NG')}`}
          onClose={() => setComplaintFor(null)}
        />
      )}
    </div>
  );
};
