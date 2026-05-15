import React, { useEffect, useState } from 'react';
import {
  fetchPartnerServicesMarketplace,
  type PartnerServiceListing,
} from '../../lib/api';

const formatNaira = (kobo: number | null | undefined): string => {
  if (kobo == null) return '—';
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
};

type TabFilter = 'all' | 'loan' | 'insurance';

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'loan', label: 'Loans' },
  { key: 'insurance', label: 'Insurance' },
];

const typeBadge = (type: string): string => {
  if (type === 'loan') return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
  if (type === 'insurance') return 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20';
  return 'bg-zovu-surface-2 text-zovu-text border-zovu-border';
};

/**
 * Shared Services marketplace used by trader and job seeker dashboards.
 * Only shows services posted by admin-approved lenders/partners.
 */
export const ServicesTab: React.FC = () => {
  const [filter, setFilter] = useState<TabFilter>('all');
  const [services, setServices] = useState<PartnerServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPartnerServicesMarketplace(
        filter === 'all' ? undefined : { type: filter },
      );
      setServices(rows);
    } catch (e) {
      setError((e as Error).message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-syne text-[26px] sm:text-[30px] font-bold text-zovu-text-light">
          Services
        </h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">
          Loans and insurance from Zovu&apos;s admin-approved partners.
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex border-b border-zovu-border overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-6 py-3 font-dm text-[14px] font-medium whitespace-nowrap transition-colors duration-200 border-b-2 -mb-[1px] ${
              filter === tab.key
                ? 'border-[#1A6B4A] text-[#1A6B4A]'
                : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Service list */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 font-dm text-[13px] text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-zovu-surface-1 border border-zovu-border rounded-[16px] animate-pulse"
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-10 text-center">
          <p className="font-dm text-[15px] text-zovu-text">
            No approved partners are currently offering services in this category.
          </p>
          <p className="font-dm text-[13px] text-zovu-text/70 mt-1">
            Check back soon — new partners are added regularly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {services.map((svc) => (
            <article
              key={svc.id}
              className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 flex flex-col gap-3 hover:border-zovu-border/80 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-syne text-[18px] font-bold text-zovu-text-light">
                    {svc.name}
                  </h3>
                  <p className="font-dm text-[12px] text-zovu-text mt-0.5">
                    by {svc.lender.company_name}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-dm font-semibold tracking-wider uppercase ${typeBadge(
                    svc.type,
                  )}`}
                >
                  {svc.type}
                </span>
              </div>

              {svc.description && (
                <p className="font-dm text-[13px] text-zovu-text leading-relaxed">
                  {svc.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 font-dm text-[13px]">
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
                  </>
                )}
              </div>
            </article>
          ))}
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

export default ServicesTab;
