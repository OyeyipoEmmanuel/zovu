import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCheck, HiOutlineClipboardCopy, HiOutlineRefresh } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuthStore } from '../../../../stores';
import { copyToClipboard } from '../../../../lib/utils';
import { fetchKYCStatus } from '../../../../lib/api';
import { getMe } from '../../../../services/authService';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 10; // ~30s

export const Step3Success: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasNumber = Boolean(user?.squadVaNumber);

  useEffect(() => {
    // Mark completion to 100%
    updateUser({ profileCompletion: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for the VA if it isn't ready yet. The backend may still be running
  // the Celery `retry_squad_provisioning` task after a transient Squad error.
  useEffect(() => {
    if (hasNumber || pollExhausted) {
      setPolling(false);
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    let cancelled = false;
    setPolling(true);

    const runOnce = async () => {
      if (cancelled) return;
      try {
        // Direct /auth/me call (bypasses cache but doesn't invalidate it —
        // invalidation triggered every other component on the page to also
        // refetch, causing a request storm).
        const me = await getMe().catch(() => null);
        if (me?.squad_account_number) {
          updateUser({
            squad_provisioned: Boolean(me.squad_provisioned),
            squadVaNumber: me.squad_account_number,
            squadVaBank: me.squad_account_bank ?? null,
          });
          return;
        }
        // Fallback to /kyc-status (some deploys serve it more cheaply)
        const status = await fetchKYCStatus().catch(() => null);
        if (status?.squad_va_number) {
          updateUser({
            squad_provisioned: true,
            squadVaNumber: status.squad_va_number,
          });
        }
      } catch {
        // ignore — we'll retry below
      } finally {
        if (cancelled) return;
        setPollAttempts((n) => {
          const next = n + 1;
          if (next >= POLL_MAX_ATTEMPTS) {
            setPollExhausted(true);
            setPolling(false);
          } else {
            pollTimer.current = setTimeout(runOnce, POLL_INTERVAL_MS);
          }
          return next;
        });
      }
    };

    // Kick off the first attempt immediately, then continue on interval.
    pollTimer.current = setTimeout(runOnce, 0);

    return () => {
      cancelled = true;
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNumber, pollExhausted]);

  const handleCopy = async () => {
    if (user?.squadVaNumber) {
      const ok = await copyToClipboard(user.squadVaNumber);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleRetryPoll = () => {
    setPollAttempts(0);
    setPollExhausted(false);
  };

  const whatsappText = `Pay me via my Zovu account:\n\nAccount Name: ${user?.firstName} ${user?.lastName}\nAccount Number: ${user?.squadVaNumber}\nBank: ${user?.squadVaBank}\n\nPowered by Zovu ✨`;

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 bg-zovu-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <div className="w-14 h-14 bg-zovu-primary rounded-full flex items-center justify-center text-zovu-primary-text shadow-lg transform scale-110">
          <HiCheck size={32} />
        </div>
      </div>

      <h2 className="font-syne text-[24px] font-bold text-zovu-text-light mb-2">
        {hasNumber ? 'Your Zovu account is ready' : 'Finalising your Zovu account…'}
      </h2>
      <p className="font-dm text-[14px] text-zovu-text mb-8">
        {hasNumber
          ? 'You can now receive payments directly into your wallet.'
          : "Hang tight — your bank account is being created in the background."}
      </p>

      <div className="w-full bg-zovu-surface-2 border border-zovu-primary/30 rounded-[12px] p-6 mb-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-zovu-primary/10 to-transparent pointer-events-none" />

        <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-2">
          Your Account Number
        </p>

        {hasNumber ? (
          <>
            <p className="font-syne text-[36px] font-bold text-zovu-text-light leading-none tracking-tight mb-2">
              {user?.squadVaNumber}
            </p>
            <p className="font-dm text-[14px] font-medium text-zovu-primary mb-6">
              {user?.squadVaBank || 'GTBank'}
            </p>

            <div className="flex items-center justify-center gap-3 relative z-10">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 flex-1 bg-zovu-surface-1 border border-zovu-border py-2.5 rounded-[8px] font-dm text-[13px] font-medium text-zovu-text-light hover:border-zovu-primary transition-colors"
              >
                <HiOutlineClipboardCopy size={16} />
                {copied ? 'Copied!' : 'Copy Number'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 flex-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 py-2.5 rounded-[8px] font-dm text-[13px] font-medium hover:bg-[#25D366]/20 transition-colors"
              >
                <FaWhatsapp size={16} />
                Share via WhatsApp
              </a>
            </div>
          </>
        ) : pollExhausted ? (
          <>
            <p className="font-syne text-[20px] font-bold text-zovu-text-light leading-tight tracking-tight mb-2">
              Setup is taking longer than usual
            </p>
            <p className="font-dm text-[13px] text-zovu-text mb-6">
              Your KYC has been received, but the bank account is still being created.
              You can continue to your dashboard — the number will appear there shortly,
              or tap retry.
            </p>
            <button
              type="button"
              onClick={handleRetryPoll}
              className="flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[13px] font-medium text-zovu-text-light hover:border-zovu-primary transition-colors"
            >
              <HiOutlineRefresh size={16} />
              Check again
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-5 h-5 border-2 border-zovu-primary/40 border-t-zovu-primary rounded-full animate-spin" />
              <p className="font-syne text-[20px] font-bold text-zovu-text-light leading-none">
                Creating account…
              </p>
            </div>
            <p className="font-dm text-[13px] text-zovu-text mb-2">
              {polling ? `Checking with the bank (${pollAttempts}/${POLL_MAX_ATTEMPTS})…` : 'Please wait…'}
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/dashboard/trader')}
        className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all"
      >
        Go to Dashboard
      </button>
    </div>
  );
};
