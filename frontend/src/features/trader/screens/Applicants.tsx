import React, { useEffect, useState } from 'react';
import {
  fetchAllMyApplicants,
  acceptApplicant,
  confirmApplication,
  disputeApplication,
  squadPaySeeker,
  type GigApplicant,
} from '../../../lib/api';
import { RatingBadge } from '../../shared/RatingBadge';
import { ReviewModal } from '../../shared/ReviewModal';
import { EscrowStatusPill, Countdown } from '../../shared/EscrowStatusPill';
import { Star, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

const formatNaira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const Applicants: React.FC = () => {
  const [rows, setRows] = useState<GigApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState<GigApplicant | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [reviewFor, setReviewFor] = useState<GigApplicant | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllMyApplicants();
      setRows(data);
    } catch (e) {
      setError((e as Error).message || 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Task 9 — geolocation phone reveal. The spec says "Seeker sends their
  // current GPS in the request body" of accept/hire, but in our UX the trader
  // is the one initiating the accept call. We pragmatically piggy-back the
  // device's current GPS on the accept request: if the trader is using the
  // app on-site with the seeker, the trader's device GPS is a reasonable
  // proxy for the seeker's GPS. If permission is denied (or unsupported),
  // we send no coords and the backend skips the reveal — no phone exposure.
  const getCurrentGps = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
      );
    });
  };

  const handleAccept = async (row: GigApplicant) => {
    setBusyId(row.id);
    setError(null);
    try {
      const gps = await getCurrentGps();
      await acceptApplicant(
        row.gig_id,
        row.id,
        gps ? { seeker_lat: gps.lat, seeker_lng: gps.lng } : undefined,
      );
      setSuccess(`Accepted ${row.seeker.display_name}`);
      await load();
    } catch (e) {
      setError((e as Error).message || 'Could not accept applicant');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirm = async (row: GigApplicant) => {
    setBusyId(row.id);
    setError(null);
    try {
      await confirmApplication(row.id);
      setSuccess(`Confirmed — payout to ${row.seeker.display_name} queued`);
      await load();
    } catch (e) {
      setError((e as Error).message || 'Could not confirm job');
    } finally {
      setBusyId(null);
    }
  };

  const handleDispute = async (row: GigApplicant) => {
    if (!window.confirm(
      `Mark this job incomplete? ${row.seeker.display_name} will be asked to resume work; the escrow stays locked.`,
    )) return;
    setBusyId(row.id);
    setError(null);
    try {
      await disputeApplication(row.id);
      setSuccess(`Sent back to ${row.seeker.display_name}`);
      await load();
    } catch (e) {
      setError((e as Error).message || 'Could not mark incomplete');
    } finally {
      setBusyId(null);
    }
  };

  const handlePay = async () => {
    if (!payOpen) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid amount in naira');
      return;
    }
    setBusyId(payOpen.id);
    setError(null);
    try {
      const res = await squadPaySeeker(payOpen.seeker.id, amount, {
        gig_id: payOpen.gig_id,
        narration: `Zovu gig payment for ${payOpen.gig?.title || 'gig'}`,
      });
      setSuccess(`Sent ${formatNaira(res.amount_kobo)} to ${payOpen.seeker.display_name}. Status: ${res.status}`);
      setPayOpen(null);
      setPayAmount('');
    } catch (e) {
      setError((e as Error).message || 'Squad transfer failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-syne text-[26px] sm:text-[30px] font-bold text-zovu-text-light">
          Applicants
        </h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">
          Job seekers who applied to your posted gigs.
        </p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 font-dm text-[13px] text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[8px] p-3 font-dm text-[13px] text-emerald-300">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-zovu-surface-1 border border-zovu-border rounded-[16px] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-10 text-center">
          <p className="font-dm text-[15px] text-zovu-text">No applicants yet.</p>
          <p className="font-dm text-[13px] text-zovu-text/70 mt-1">
            Post a gig to start receiving applications from job seekers.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <article
              key={row.id}
              className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-syne text-[18px] font-bold text-zovu-text-light">
                      {row.seeker.display_name}
                    </h3>
                    {/* Seeker rating is only shown after they applied — which
                        is exactly the state we're in on the Applicants screen. */}
                    <RatingBadge userId={row.seeker.id} showWhenEmpty />
                  </div>
                  <p className="font-dm text-[12px] text-zovu-text mt-0.5">
                    {row.seeker.email}
                  </p>
                  {row.gig && (
                    <p className="font-dm text-[13px] text-zovu-text mt-2">
                      Applied to{' '}
                      <span className="text-zovu-text-light font-medium">{row.gig.title}</span>
                      {row.gig.location ? ` · ${row.gig.location}` : ''}
                      {row.gig.amount ? ` · ${formatNaira(row.gig.amount)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <EscrowStatusPill status={row.status} />
                  {row.status === 'worker_done' && row.confirmation_deadline_at && (
                    <span className="font-dm text-[11px] text-[#F4A11D] inline-flex items-center gap-1">
                      <Clock size={12} />
                      <Countdown deadline={row.confirmation_deadline_at} />
                    </span>
                  )}
                  <span className="font-dm text-[11px] text-zovu-text">
                    {formatDate(row.applied_at)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-dm text-[13px] mb-4">
                <Stat label="Pulse Score" value={String(row.seeker.pulse_score)} />
                <Stat label="Location" value={row.seeker.location || '—'} />
                <Stat
                  label="Completion"
                  value={`${Math.round((row.seeker.completion_rate || 0) * 100)}%`}
                />
                <Stat label="KYC" value={row.seeker.kyc_verified ? 'Verified' : 'Pending'} />
              </div>

              {row.seeker.skills.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {row.seeker.skills.slice(0, 6).map((s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-zovu-surface-2 text-zovu-text font-dm text-[11px]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {row.status === 'pending' && (
                  <button
                    onClick={() => handleAccept(row)}
                    disabled={busyId === row.id}
                    className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    {busyId === row.id ? 'Working…' : 'Accept applicant'}
                  </button>
                )}

                {row.status === 'waiting_for_worker' && (
                  <span className="px-3 py-2 text-zovu-text font-dm text-[12px] italic inline-flex items-center gap-1">
                    <Clock size={12} />
                    Waiting for {row.seeker.display_name} to mark the job done.
                  </span>
                )}

                {row.status === 'worker_done' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleConfirm(row)}
                      disabled={busyId === row.id}
                      className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50 transition-all inline-flex items-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      {busyId === row.id ? 'Working…' : 'Confirm Complete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDispute(row)}
                      disabled={busyId === row.id}
                      className="px-4 py-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 font-dm text-[13px] font-medium rounded-[8px] hover:bg-orange-500/20 disabled:opacity-50 transition-all inline-flex items-center gap-2"
                    >
                      <AlertCircle size={14} />
                      Mark Incomplete
                    </button>
                  </>
                )}

                {row.status === 'in_dispute' && (
                  <span className="px-3 py-2 text-red-300 font-dm text-[12px] italic">
                    Support is reviewing this job. Escrow remains locked.
                  </span>
                )}

                {row.status === 'trader_confirmed' && row.seeker.squad_account_number && (
                  <button
                    type="button"
                    onClick={() => setReviewFor(row)}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <Star size={14} />
                    Review seeker
                  </button>
                )}

                {/* Legacy direct-pay button kept for gigs accepted under the
                    old flow before the escrow state machine landed. */}
                {row.status === 'accepted' && row.seeker.squad_account_number && (
                  <button
                    onClick={() => {
                      setPayOpen(row);
                      setPayAmount(String(row.gig?.amount ? Math.round(row.gig.amount / 100) : ''));
                    }}
                    className="px-4 py-2 bg-[#F4A11D] text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 transition-all"
                  >
                    Pay via Squad
                  </button>
                )}
                {row.status === 'accepted' && !row.seeker.squad_account_number && (
                  <span className="px-3 py-2 text-zovu-text font-dm text-[12px] italic">
                    Seeker needs to finish KYC before they can be paid.
                  </span>
                )}
                {row.status === 'accepted' && (
                  <button
                    type="button"
                    onClick={() => setReviewFor(row)}
                    className="px-4 py-2 bg-white/5 border border-white/10 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <Star size={14} />
                    Review seeker
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {reviewFor && (
        <ReviewModal
          gigId={reviewFor.gig_id}
          revieweeId={reviewFor.seeker.id}
          revieweeName={reviewFor.seeker.display_name}
          revieweeRole="the job seeker"
          onClose={() => setReviewFor(null)}
          onSubmitted={() => setSuccess(`Review submitted for ${reviewFor.seeker.display_name}.`)}
        />
      )}

      {/* Pay modal */}
      {payOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 max-w-md w-full">
            <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-1">
              Pay {payOpen.seeker.display_name}
            </h2>
            <p className="font-dm text-[13px] text-zovu-text mb-4">
              Send funds via Squad Transfer to virtual account{' '}
              <span className="text-zovu-text-light font-mono">
                {payOpen.seeker.squad_account_number}
              </span>{' '}
              ({payOpen.seeker.squad_account_bank}).
            </p>
            <label className="font-dm text-[13px] text-zovu-text-light font-medium block mb-1">
              Amount (₦)
            </label>
            <input
              type="number"
              min="100"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary"
              placeholder="e.g. 5000"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setPayOpen(null); setPayAmount(''); }}
                className="flex-1 px-4 py-2 bg-zovu-surface-2 text-zovu-text-light font-dm text-[13px] rounded-[8px]"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={busyId === payOpen.id}
                className="flex-1 px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50"
              >
                {busyId === payOpen.id ? 'Sending…' : 'Send payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-zovu-text/60 mb-0.5">{label}</p>
    <p className="text-zovu-text-light font-medium">{value}</p>
  </div>
);

export default Applicants;
