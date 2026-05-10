import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components';
import backgroundDesign from '../../../assets/backgroundDesign.png';
import zovu  from '../../../assets/zovu.svg';
const generateVirtualNumber = (): string => {
  const segments = Array.from({ length: 4 }, () =>
    String(Math.floor(1000 + Math.random() * 9000))
  );
  return segments.join(' ');
};

const formatExpiry = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear() + 3).slice(-2);
  return `${month}/${year}`;
};

export const SignupSuccess: React.FC = () => {
  const [showContent, setShowContent] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const virtualNumber = useMemo(() => generateVirtualNumber(), []);
  const expiry = useMemo(() => formatExpiry(), []);

  // Retrieve user name from session data
  const userName = useMemo(() => {
    try {
      const personal = sessionStorage.getItem('zovu_personal');
      if (personal) {
        const data = JSON.parse(personal);
        return `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || 'ZOVU USER';
      }
    } catch { /* fallback */ }
    return 'ZOVU USER';
  }, []);

  useEffect(() => {
    const contentTimer = setTimeout(() => setShowContent(true), 300);
    const cardTimer = setTimeout(() => setShowCard(true), 700);
    return () => {
      clearTimeout(contentTimer);
      clearTimeout(cardTimer);
    };
  }, []);

  return (
    <AuthLayout
      title="You're All Set!"
      subtitle="Your Zovu account has been created successfully."
      step={{ current: 5, total: 5, label: 'Account Created' }}
    >
      <div
        className={`flex flex-col items-center text-center gap-6 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
      >
        {/* Success Checkmark */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-zovu-primary/10 flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-zovu-primary/20 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zovu-primary"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Welcome Info */}
        <div className="flex flex-col gap-2">
          <h2 className="font-syne text-[24px] font-semibold text-zovu-text-light">
            Welcome to Zovu
          </h2>
          <p className="font-dm text-[14px] text-zovu-text leading-[1.5] max-w-sm">
            Your identity has been verified and your financial profile is set up.
            Here's your Squad Virtual Account.
          </p>
        </div>

        {/* ── Squad Virtual Card ────────────────────────────────── */}
        <div
          className={`w-full h-fit transition-all duration-700 rounded-2xl delay-200 ${showCard ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
            }`}
          style={{
            backgroundImage: `url(${backgroundDesign})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(5, 4, 4, 0.9)",
            backgroundBlendMode: "overlay",
          }}
        >
          <div
            className="
              relative w-full md:aspect-[1.6/1] rounded-[16px] p-5 sm:p-6 overflow-hidden
              flex flex-col justify-between gap-5
              
              border border-zovu-primary/20
              shadow-[0_8px_32px_rgba(26,107,74,0.15)]
            "
          >
            {/* Background pattern */}
            {/* <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div> */}
            {/* Corner glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-zovu-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-zovu-amber/8 blur-2xl pointer-events-none" />

            {/* Top row: Logo + Chip */}
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <img src={zovu} alt="" />
              </div>
              {/* EMV Chip */}
              <div className="w-10 h-7 rounded-[4px] bg-gradient-to-br from-[#d4af37] via-[#f0d060] to-[#b8962e] flex items-center justify-center">
                <div className="w-6 h-4 rounded-[2px] border border-[#a07d20]/50 bg-gradient-to-b from-[#e8c84a] to-[#c9a533]">
                  <div className="w-full h-[1px] bg-[#a07d20]/30 mt-[5px]" />
                  <div className="w-[1px] h-full bg-[#a07d20]/30 absolute top-0 left-1/2 -translate-x-1/2" />
                </div>
              </div>
            </div>

            {/* Card Number */}
            <div className="relative z-10 my-auto">
              <p className="font-dm text-[10px] text-zovu-text/80 uppercase tracking-[0.15em] mb-1">
                Squad Virtual Number
              </p>
              <p className="font-dm text-[16px] md:text-[26px] font-medium text-zovu-text-light tracking-[0.12em] tabular-nums">
                {virtualNumber}
              </p>
            </div>

            {/* Bottom row: Name + Expiry + Network */}
            <div className="relative z-10 flex items-end justify-between">
              <div className="flex gap-6">
                <div>
                  <p className="font-dm text-[9px] text-zovu-text/40 uppercase tracking-[0.1em] mb-0.5">
                    Card Holder
                  </p>
                  <p className="font-dm text-[13px] font-medium text-zovu-text-light uppercase tracking-wide">
                    {userName}
                  </p>
                </div>
                <div>
                  <p className="font-dm text-[9px] text-zovu-text/40 uppercase tracking-[0.1em] mb-0.5">
                    Expires
                  </p>
                  <p className="font-dm text-[13px] font-medium text-zovu-text-light tracking-wide tabular-nums">
                    {expiry}
                  </p>
                </div>
              </div>
              {/* Network logo circles (Mastercard-inspired) */}
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-zovu-amber/80" />
                <div className="w-7 h-7 rounded-full bg-zovu-primary/70" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Status Cards ──────────────────────────────────────── */}
        <div className="w-full grid grid-cols-1 gap-3">
          {/* Account Verified */}
          <div className="bg-zovu-bg border border-zovu-border rounded-[12px] p-4 text-left flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-zovu-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zovu-primary">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11.5 14.5 15 9.5" />
              </svg>
            </div>
            <div>
              <h4 className="font-syne text-[14px] font-semibold text-zovu-text-light mb-0.5">
                Account Verified
              </h4>
              <p className="font-dm text-[12px] text-zovu-text leading-[1.4]">
                Your identity and reputation score are now active.
              </p>
            </div>
          </div>

          {/* Instant Transfers */}
          <div className="bg-zovu-bg border border-zovu-border rounded-[12px] p-4 text-left flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-zovu-amber/10 flex items-center justify-center shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zovu-amber">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h4 className="font-syne text-[14px] font-semibold text-zovu-text-light mb-0.5">
                Instant Transfers
              </h4>
              <p className="font-dm text-[12px] text-zovu-text leading-[1.4]">
                You can now receive funds and post Gigs immediately.
              </p>
            </div>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="w-full flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="
              w-full bg-zovu-primary text-zovu-primary-text rounded-[8px]
              font-dm font-medium text-[16px] px-6 py-3.5
              inline-flex items-center justify-center
              transition-all duration-200
              hover:brightness-110 active:scale-[0.98]
            "
          >
            Go to Dashboard
          </Link>
          <Link
            to="/login"
            className="
              w-full bg-transparent border border-zovu-border text-zovu-text-light rounded-[8px]
              font-dm font-medium text-[14px] px-6 py-3
              inline-flex items-center justify-center
              transition-all duration-200
              hover:border-zovu-primary
            "
          >
            Log in to another account
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
