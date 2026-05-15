import React, { useEffect, useState } from 'react';
import { lenderAPI, fetchUserProfile, type UserProfile } from '../../lib/api';

type ServiceType = 'loan' | 'insurance';

interface ServiceRecord {
  id: string;
  lender_id: string;
  name: string;
  type: ServiceType | 'savings';
  description: string | null;
  min_pulse_score: number;
  max_amount: number | null;       // kobo
  interest_rate: number | null;
  premium_amount: number | null;   // kobo
  repayment_days: number | null;
  status: string;
}

const formatNaira = (kobo: number | null | undefined): string => {
  if (kobo == null) return '—';
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
};

const TYPE_BADGE: Record<string, string> = {
  loan: 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20',
  insurance: 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20',
};

const TABS: { key: 'all' | ServiceType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'loan', label: 'Loans' },
  { key: 'insurance', label: 'Insurance' },
];

export const MyServices: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<'all' | ServiceType>('all');
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prof, list] = await Promise.all([
        fetchUserProfile(),
        lenderAPI.getMyServices(tab === 'all' ? undefined : tab),
      ]);
      setProfile(prof);
      setServices(Array.isArray(list) ? (list as ServiceRecord[]) : []);
    } catch (e) {
      setError((e as Error).message || 'Could not load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const approved = Boolean(profile?.partnerApproved);

  return (
    <div className="max-w-5xl mx-auto text-zovu-text">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="font-syne text-[26px] sm:text-[28px] font-bold text-zovu-text-light">
          My Services
        </h1>
        {approved && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110"
          >
            + Add service
          </button>
        )}
      </div>

      {!approved && (
        <div className="bg-[#F4A11D]/10 border border-[#F4A11D]/30 rounded-[12px] p-4 mb-6">
          <p className="font-dm text-[13px] text-[#F4A11D] font-semibold">
            Your partner account is pending admin approval.
          </p>
          <p className="font-dm text-[12px] text-zovu-text mt-1">
            You&apos;ll be able to post loan or insurance services as soon as an admin
            approves your account.
          </p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-zovu-border mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-6 py-3 font-dm text-[14px] font-medium whitespace-nowrap transition-colors duration-200 border-b-2 -mb-[1px] ${
              tab === t.key
                ? 'border-[#1A6B4A] text-[#1A6B4A]'
                : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 mb-4 font-dm text-[13px] text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zovu-surface-1 border border-zovu-border rounded-[16px] animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-10 text-center">
          <p className="font-dm text-[15px] text-zovu-text">
            You haven&apos;t posted any services yet.
          </p>
          {approved && (
            <p className="font-dm text-[13px] text-zovu-text/70 mt-1">
              Click &quot;+ Add service&quot; to publish a new loan or insurance product.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((svc) => (
            <article
              key={svc.id}
              className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-syne text-[18px] font-bold text-zovu-text-light">
                    {svc.name}
                  </h3>
                  {svc.description && (
                    <p className="font-dm text-[13px] text-zovu-text mt-1">
                      {svc.description}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-dm font-semibold tracking-wider uppercase ${
                    TYPE_BADGE[svc.type] ||
                    'bg-zovu-surface-2 text-zovu-text border-zovu-border'
                  }`}
                >
                  {svc.type}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-dm text-[13px]">
                {svc.type === 'loan' && (
                  <>
                    <Stat label="Max amount" value={formatNaira(svc.max_amount)} />
                    <Stat
                      label="Interest"
                      value={svc.interest_rate != null ? `${svc.interest_rate}%/mo` : '—'}
                    />
                    <Stat
                      label="Repayment"
                      value={svc.repayment_days != null ? `${svc.repayment_days} days` : '—'}
                    />
                    <Stat label="Min Pulse" value={String(svc.min_pulse_score)} />
                  </>
                )}
                {svc.type === 'insurance' && (
                  <>
                    <Stat label="Premium" value={`${formatNaira(svc.premium_amount)}/mo`} />
                    <Stat label="Coverage" value={formatNaira(svc.max_amount)} />
                    <Stat label="Min Pulse" value={String(svc.min_pulse_score)} />
                    <Stat label="Status" value={svc.status} />
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateServiceModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
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

const CreateServiceModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [type, setType] = useState<ServiceType>('loan');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minPulse, setMinPulse] = useState('400');
  const [maxAmount, setMaxAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [repaymentDays, setRepaymentDays] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');

    const payload: Parameters<typeof lenderAPI.offerService>[0] = {
      name: name.trim(),
      type,
      description: description.trim(),
      min_pulse_score: Math.max(0, Math.min(850, Number(minPulse) || 0)),
    };
    if (type === 'loan') {
      const amt = Number(maxAmount);
      const ir = Number(interestRate);
      const days = Number(repaymentDays);
      if (!amt || amt <= 0) return setError('Max amount is required');
      if (Number.isNaN(ir) || ir < 0) return setError('Interest rate is required');
      if (!days || days <= 0) return setError('Repayment days are required');
      payload.max_amount = amt;
      payload.interest_rate = ir;
      payload.repayment_days = days;
    } else {
      const premium = Number(premiumAmount);
      const cover = Number(maxAmount);
      if (!premium || premium <= 0) return setError('Premium is required');
      if (!cover || cover <= 0) return setError('Coverage amount is required');
      payload.premium_amount = premium;
      payload.max_amount = cover;
    }

    setSubmitting(true);
    try {
      await lenderAPI.offerService(payload);
      onCreated();
    } catch (e) {
      setError((e as Error).message || 'Failed to create service');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-4">
          New service
        </h2>

        <div className="flex gap-2 mb-4">
          {(['loan', 'insurance'] as ServiceType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-[8px] font-dm text-[13px] font-medium capitalize transition-all ${
                type === t
                  ? 'bg-[#1A6B4A] text-white'
                  : 'bg-zovu-surface-2 text-zovu-text-light'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <Field label="Service name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'loan' ? 'e.g. Quick cash loan' : 'e.g. Trader liability cover'}
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short pitch shown to users browsing the Services tab"
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary resize-none"
          />
        </Field>

        <Field label="Min Pulse Score (0-850)">
          <input
            type="number"
            min={0}
            max={850}
            value={minPulse}
            onChange={(e) => setMinPulse(e.target.value)}
            aria-label="Minimum pulse score"
            placeholder="400"
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
          />
        </Field>

        {type === 'loan' ? (
          <>
            <Field label="Max amount (₦)">
              <input
                type="number"
                min={1}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="50000"
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
              />
            </Field>
            <Field label="Interest rate (%/month)">
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="5"
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
              />
            </Field>
            <Field label="Repayment days">
              <input
                type="number"
                min={1}
                value={repaymentDays}
                onChange={(e) => setRepaymentDays(e.target.value)}
                aria-label="Repayment days"
                placeholder="30"
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Premium (₦/month)">
              <input
                type="number"
                min={1}
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
                placeholder="2500"
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
              />
            </Field>
            <Field label="Coverage amount (₦)">
              <input
                type="number"
                min={1}
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="250000"
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
              />
            </Field>
          </>
        )}

        {error && (
          <p className="font-dm text-[12px] text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zovu-surface-2 text-zovu-text-light font-dm text-[13px] rounded-[8px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Create service'}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label className="flex flex-col gap-1 mb-3">
    <span className="font-dm text-[12px] text-zovu-text-light font-medium">{label}</span>
    {children}
  </label>
);
