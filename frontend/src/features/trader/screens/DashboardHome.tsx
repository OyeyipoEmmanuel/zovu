import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineTrendingUp,
  HiOutlineCurrencyDollar,
  HiOutlineBriefcase,
  HiOutlineArrowDown,
  HiOutlineArrowUp,
  HiOutlinePlusCircle,
  HiOutlineLockClosed,
  HiOutlineClipboardCopy,
  HiOutlineChevronRight,
} from 'react-icons/hi';
import { useTraderStore, useAuthStore } from '../../../stores';
import { SkeletonCard, SkeletonTransaction, ErrorCard } from '../components';
import { fetchVirtualAccount, fetchTransactions, fetchPulseScore, fetchUserProfile, fetchMyGigs } from '../../../lib/api';
import { formatCurrency, formatRelativeTime, getGreeting, copyToClipboard } from '../../../lib/utils';
import type { Transaction } from '../../../lib/mockData';
import { useKYCGuard, KYCModal } from '../hooks';
import { LoanFlowModal } from './LoanFlowModal';
import { DepositModal } from '../../shared/DepositModal';

export const DashboardHome: React.FC = () => {
  const { kycComplete } = useKYCGuard();
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const setUser = useAuthStore((s) => s.setUser);
  const setAccount = useTraderStore((s) => s.setAccount);
  const setTransactions = useTraderStore((s) => s.setTransactions);
  const setPulse = useTraderStore((s) => s.setPulse);
  const setGigs = useTraderStore((s) => s.setGigs);
  const balance = useTraderStore((s) => s.balance);
  const accountNumber = useTraderStore((s) => s.accountNumber);
  const bankName = useTraderStore((s) => s.bankName);
  const pulseScore = useTraderStore((s) => s.pulseScore);
  const pulseTier = useTraderStore((s) => s.pulseTier);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [profileCompletion, setProfileCompletion] = useState(60);
  const [activeGigCount, setActiveGigCount] = useState(0);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const didLoad = useRef(false);

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [acct, txnRes, pulse, profile, gigs] = await Promise.all([
        fetchVirtualAccount(),
        fetchTransactions('all', 1, 5),
        fetchPulseScore(),
        fetchUserProfile(),
        fetchMyGigs(),
      ]);
      setAccount(acct);
      setTransactions(txnRes.data);
      setPulse(pulse);
      setGigs(gigs);
      setUser({
        id: profile.id ?? profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        role: profile.role,
        businessName: profile.businessName,
        profileCompletion: profile.profileCompletion,
        kycComplete: profile.kycComplete,
        squadVaNumber: profile.squadVaNumber,
        squadVaBank: profile.squadVaBank,
      });
      setRecentTxns(txnRes.data.slice(0, 5));
      setProfileCompletion(profile.profileCompletion);
      setActiveGigCount(gigs.filter((g) => g.status === 'active').length);
      setUserId(profile.id ?? '');
      const greeting =
        profile.role === 'trader' && profile.businessName?.trim()
          ? profile.businessName.trim()
          : [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.email;
      setUserName(greeting);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!didLoad.current) {
      didLoad.current = true;
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(accountNumber);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoanClick = () => {
    if (pulseScore < 400) {
      setShowLoanModal(true); // LoanFlowModal handles the < 400 state
      return;
    }
    
    if (!kycComplete) {
      setShowKYCModal(true);
    } else {
      setShowLoanModal(true);
    }
  };

  if (error) return <ErrorCard message={error} onRetry={loadData} />;

  return (
    <div className="flex flex-col gap-6">
      {showKYCModal && <KYCModal onCancel={() => setShowKYCModal(false)} />}
      {showLoanModal && <LoanFlowModal onCancel={() => setShowLoanModal(false)} />}
      {showDepositModal && userId && <DepositModal userId={userId} onClose={() => setShowDepositModal(false)} />}
      
      {/* Greeting */}
      <div>
        <h1 className="font-syne text-[24px] sm:text-[30px] font-bold text-zovu-text-light leading-tight">
          {getGreeting()}, {loading ? '...' : userName} 👋
        </h1>
      </div>

      {/* Wallet Balance Card */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <div className="bg-gradient-to-br from-zovu-primary/20 via-zovu-surface-1 to-zovu-surface-1 border border-zovu-primary/20 rounded-[16px] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-1">
            <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider"> Wallet Balance</p>
            <span className="font-dm text-[11px] text-zovu-text bg-zovu-surface-2 px-2 py-0.5 rounded-full">
              {bankName}
            </span>
          </div>
          <p className="font-syne text-[32px] sm:text-[40px] font-bold text-zovu-text-light leading-none mt-2 mb-3">
            {formatCurrency(balance)}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-dm text-[14px] text-zovu-text tabular-nums">{accountNumber}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-zovu-surface-2 border border-zovu-border text-[12px] font-dm text-zovu-text-light hover:border-zovu-primary transition-all duration-200"
            >
              <HiOutlineClipboardCopy size={14} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => setShowDepositModal(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-[6px] bg-zovu-primary text-white text-[12px] font-dm font-semibold hover:brightness-110 transition-all duration-200"
            >
              Fund Wallet
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* Pulse Score */}
            <Link
              to="/dashboard/trader/pulse"
              className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 hover:border-zovu-primary/40 transition-colors duration-200 group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-zovu-amber/10 flex items-center justify-center">
                  <HiOutlineTrendingUp size={16} className="text-zovu-amber" />
                </div>
                <span className="font-dm text-[12px] text-zovu-text uppercase tracking-wider">Pulse Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-syne text-[28px] font-bold text-zovu-text-light">{pulseScore}</span>
                <span className="font-dm text-[11px] font-semibold text-zovu-amber bg-zovu-amber/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {pulseTier}
                </span>
              </div>
            </Link>

            {/* Monthly Revenue */}
            <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-zovu-primary/10 flex items-center justify-center">
                  <HiOutlineCurrencyDollar size={16} className="text-zovu-primary" />
                </div>
                <span className="font-dm text-[12px] text-zovu-text uppercase tracking-wider">Monthly Revenue</span>
              </div>
              <span className="font-syne text-[28px] font-bold text-zovu-text-light">{formatCurrency(balance)}</span>
            </div>

            {/* Active Gigs */}
            <Link
              to="/dashboard/trader/gig/post"
              className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 hover:border-zovu-primary/40 transition-colors duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-zovu-primary/10 flex items-center justify-center">
                  <HiOutlineBriefcase size={16} className="text-zovu-primary" />
                </div>
                <span className="font-dm text-[12px] text-zovu-text uppercase tracking-wider">Active Gigs</span>
              </div>
              <span className="font-syne text-[28px] font-bold text-zovu-text-light">{activeGigCount}</span>
            </Link>
          </>
        )}
      </div>

      {/* Profile Completion Banner */}
      {!loading && profileCompletion < 100 && (
        <Link
          to="/dashboard/trader/complete-profile/kyc"
          className="bg-zovu-surface-1 border border-zovu-amber/20 rounded-[12px] p-4 flex items-center gap-4 hover:border-zovu-amber/40 transition-colors duration-200 group"
        >
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="font-dm text-[13px] text-zovu-text-light font-medium">Complete your profile</p>
              <span className="font-dm text-[12px] text-zovu-amber font-semibold">{profileCompletion}%</span>
            </div>
            <div className="w-full h-2 bg-zovu-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-zovu-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <p className="font-dm text-[12px] text-zovu-text mt-2">
              Add your BVN to start receiving payments →
            </p>
          </div>
          <HiOutlineChevronRight size={20} className="text-zovu-text group-hover:text-zovu-amber shrink-0 transition-colors" />
        </Link>
      )}

      {/* Recent Transactions */}
      <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zovu-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zovu-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zovu-primary" />
            </span>
            <h3 className="font-syne text-[16px] font-semibold text-zovu-text-light">Recent Transactions</h3>
            <span className="font-dm text-[11px] text-zovu-primary font-medium uppercase tracking-wider">Live</span>
          </div>
          <Link
            to="/dashboard/trader/transactions"
            className="font-dm text-[13px] text-zovu-primary hover:underline transition-colors"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-zovu-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTransaction key={i} />
            ))}
          </div>
        ) : recentTxns.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-dm text-[14px] text-zovu-text">No transactions yet.</p>
            <p className="font-dm text-[12px] text-zovu-text/60 mt-1">
              Share your account number to receive your first payment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zovu-border">
            {recentTxns.map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zovu-surface-2/50 transition-colors duration-150">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    txn.type === 'inflow' ? 'bg-zovu-primary/10' : 'bg-red-500/10'
                  }`}
                >
                  {txn.type === 'inflow' ? (
                    <HiOutlineArrowDown size={16} className="text-zovu-primary" />
                  ) : (
                    <HiOutlineArrowUp size={16} className="text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-[14px] text-zovu-text-light truncate">{txn.counterparty}</p>
                  <p className="font-dm text-[11px] text-zovu-text">{formatRelativeTime(txn.timestamp)}</p>
                </div>
                <span
                  className={`font-dm text-[14px] font-medium tabular-nums ${
                    txn.type === 'inflow' ? 'text-zovu-primary' : 'text-red-400'
                  }`}
                >
                  {txn.type === 'inflow' ? '+' : '-'}{formatCurrency(txn.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/dashboard/trader/payments"
          className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-zovu-primary/40 transition-colors duration-200 text-center"
        >
          <div className="w-10 h-10 rounded-full bg-zovu-primary/10 flex items-center justify-center">
            <HiOutlineArrowDown size={20} className="text-zovu-primary" />
          </div>
          <span className="font-dm text-[12px] text-zovu-text-light">Receive Payment</span>
        </Link>

        <Link
          to="/dashboard/trader/gig/post"
          className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 hover:border-zovu-primary/40 transition-colors duration-200 text-center"
        >
          <div className="w-10 h-10 rounded-full bg-zovu-primary/10 flex items-center justify-center">
            <HiOutlinePlusCircle size={20} className="text-zovu-primary" />
          </div>
          <span className="font-dm text-[12px] text-zovu-text-light">Post a Gig</span>
        </Link>

        <div
          onClick={handleLoanClick}
          className={`bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 flex flex-col items-center gap-2 text-center ${
            pulseScore < 400 ? 'opacity-50 cursor-pointer' : 'hover:border-zovu-primary/40 cursor-pointer transition-colors duration-200'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-zovu-amber/10 flex items-center justify-center relative">
            <HiOutlineCurrencyDollar size={20} className="text-zovu-amber" />
            {pulseScore < 400 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-zovu-surface-1 border border-zovu-border rounded-full flex items-center justify-center">
                <HiOutlineLockClosed size={10} className="text-zovu-text" />
              </div>
            )}
          </div>
          <span className="font-dm text-[12px] text-zovu-text-light">Apply for Loan</span>
        </div>
      </div>
    </div>
  );
};
