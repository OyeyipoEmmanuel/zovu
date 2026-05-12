import React, { useEffect, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { HiOutlineClipboardCopy } from 'react-icons/hi';
import { SkeletonCard, ErrorCard } from '../components';
import { fetchVirtualAccount, fetchRecentPayments } from '../../../lib/api';
import { formatCurrency, formatRelativeTime, copyToClipboard } from '../../../lib/utils';
import { useKYCGuard, KYCModal } from '../hooks';
import { useNavigate } from 'react-router-dom';

export const Payments: React.FC = () => {
  const navigate = useNavigate();
  const { kycComplete } = useKYCGuard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [recentPayments, setRecentPayments] = useState<
    { id: string; sender: string; amount: number; timestamp: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acct, payments] = await Promise.all([
        fetchVirtualAccount(),
        fetchRecentPayments(),
      ]);
      setAccountNumber(acct.accountNumber);
      setAccountName(acct.accountName);
      setBankName(acct.bankName);
      setRecentPayments(payments);
    } catch {
      setError('Failed to load payment info.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = async (): Promise<void> => {
    const ok = await copyToClipboard(accountNumber);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Pay me via my Zovu account:\n\nAccount Name: ${accountName}\nAccount Number: ${accountNumber}\nBank: ${bankName}\n\nPowered by Zovu ✨`
  );

  if (!kycComplete) {
    return <KYCModal onCancel={() => navigate('/dashboard/trader')} />;
  }

  if (error) return <ErrorCard message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">Payments</h1>

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          {/* QR Code + Account Details */}
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 sm:p-8 flex flex-col items-center text-center">
            <div className="bg-white rounded-[12px] p-4 mb-5">
              <QRCodeSVG
                value={`https://pay.zovu.ng/${accountNumber}`}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#0D0D0D"
                level="M"
              />
            </div>

            <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-1">{bankName}</p>
            <p className="font-syne text-[20px] font-bold text-zovu-text-light mb-1">{accountName}</p>

            <div className="flex items-center gap-2 mt-2">
              <span className="font-dm text-[18px] text-zovu-text-light tabular-nums font-medium tracking-wider">
                {accountNumber}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-zovu-surface-2 border border-zovu-border text-[12px] font-dm text-zovu-text-light hover:border-zovu-primary transition-all duration-200"
              >
                <HiOutlineClipboardCopy size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-[10px] font-dm font-medium text-[14px] hover:brightness-110 transition-all duration-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Share via WhatsApp
            </a>
          </div>

          {/* Recent Payments */}
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] overflow-hidden">
            <div className="px-5 py-4 border-b border-zovu-border">
              <h3 className="font-syne text-[16px] font-semibold text-zovu-text-light">Recent Incoming Payments</h3>
            </div>
            {recentPayments.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-dm text-[14px] text-zovu-text">No payments received yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-zovu-border">
                {recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-zovu-surface-2/50 transition-colors duration-150">
                    <div>
                      <p className="font-dm text-[14px] text-zovu-text-light">{p.sender}</p>
                      <p className="font-dm text-[11px] text-zovu-text mt-0.5">{formatRelativeTime(p.timestamp)}</p>
                    </div>
                    <span className="font-dm text-[14px] font-medium text-zovu-primary tabular-nums">
                      +{formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
