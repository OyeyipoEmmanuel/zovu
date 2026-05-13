import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePartnerStore } from '../../stores/partnerStore';
import type { PartnerProduct } from '../../stores/partnerStore';
import { useAuthStore } from '../../stores/authStore';
import { lenderAPI, partnerAPI } from '../../lib/api';
import type { PartnerStats } from '../../lib/api';

const getProductTypeBadge = (type: string) => {
  switch (type) {
    case 'loan': return 'bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/20';
    case 'insurance': return 'bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/20';
    case 'savings': return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20';
    default: return 'bg-zovu-surface-2 text-zovu-text border-zovu-border';
  }
};

export const PartnersSidebar: React.FC = () => {
  return (
    <div className="w-64 bg-zovu-surface-1 border-r border-zovu-border flex flex-col min-h-screen p-6 hidden md:flex">
      <h2 className="font-syne text-[24px] font-bold text-zovu-primary mb-10">Zovu</h2>
      <nav className="flex flex-col gap-2">
        <Link to="/dashboard/partners" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Home</Link>
        <Link to="/dashboard/partners/customers" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Customer Pool</Link>
        <Link to="/dashboard/partners/services" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">My Services</Link>
        <Link to="/dashboard/partners/products" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Products</Link>
        <Link to="/dashboard/partners/settings" className="py-3 px-4 rounded-[8px] hover:bg-zovu-surface-2 font-dm text-[14px] text-zovu-text-light transition-colors">Settings</Link>
      </nav>
    </div>
  );
};

export const PartnersDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { borrowers, setStats, setBorrowers, setProducts } = usePartnerStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partnerStats, setPartnerStats] = useState<PartnerStats | null>(null);
  const [products, setLocalProducts] = useState<PartnerProduct[]>([]);

  useEffect(() => {
    const role = user?.role as string | undefined;
    if (role && role.toLowerCase() !== 'lender' && role.toLowerCase() !== 'both' && role.toLowerCase() !== 'partner') {
      navigate('/dashboard/trader');
    }
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, borrowersRes, productsRes, pStatsRes] = await Promise.all([
        lenderAPI.getStats(),
        lenderAPI.getBorrowers({ limit: 3 }),
        partnerAPI.getMyProducts(),
        partnerAPI.getStats()
      ]);
      setStats(statsRes);
      setBorrowers(borrowersRes);
      setLocalProducts(productsRes as PartnerProduct[]);
      setProducts(productsRes as PartnerProduct[]);
      setPartnerStats(pStatsRes);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'bronze': return 'text-[#CD7F32] bg-[#CD7F32]/10';
      case 'silver': return 'text-[#C0C0C0] bg-[#C0C0C0]/10';
      case 'gold': return 'text-[#F4A11D] bg-[#F4A11D]/10';
      case 'platinum': return 'text-[#E5E4E2] bg-[#E5E4E2]/10';
      default: return 'text-zovu-text bg-zovu-surface-2';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-10 w-48 bg-zovu-surface-1 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zovu-surface-1 rounded-[12px] border border-zovu-border" />)}
        </div>
        <div className="h-6 w-32 bg-zovu-surface-1 rounded-md mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-zovu-surface-1 rounded-[12px] border border-zovu-border" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[12px] text-center">
        <p className="text-red-400 font-dm mb-4">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <div>
        <h1 className="font-syne text-[24px] sm:text-[30px] font-bold text-zovu-text-light leading-tight">
          Partners Dashboard
        </h1>
        <p className="font-dm text-[14px] text-zovu-text mt-1">Overview of your services portfolio.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Total Disbursed</p>
          <p className="font-syne text-[24px] font-bold text-zovu-text-light">
            ₦{partnerStats?.total_disbursed.toLocaleString('en-NG')}
          </p>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Active Services</p>
          <p className="font-syne text-[24px] font-bold text-zovu-text-light">
            {partnerStats?.active_services}
          </p>
        </div>
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5">
          <p className="font-dm text-[13px] text-zovu-text mb-1">Customers Served</p>
          <p className="font-syne text-[24px] font-bold text-zovu-primary">
            {partnerStats?.customers_served}
          </p>
        </div>
      </div>

      {/* My Products */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">My Products</h2>
          <Link to="/dashboard/partners/products" className="font-dm text-[14px] text-zovu-primary hover:underline">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.slice(0, 3).map((p) => (
            <div key={p.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5 flex flex-col gap-3 hover:border-zovu-primary/30 transition-colors">
              <div className="flex justify-between items-start">
                <p className="font-dm text-[16px] font-bold text-zovu-text-light">{p.name}</p>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-dm font-semibold tracking-wider uppercase ${getProductTypeBadge(p.type)}`}>
                  {p.type}
                </span>
              </div>
              <p className="font-dm text-[13px] text-zovu-text">
                {p.type === 'loan' && p.max_amount ? `Up to ₦${p.max_amount.toLocaleString('en-NG')} at ${p.interest_rate}%/month` : ''}
                {p.type === 'insurance' && p.premium_amount ? `₦${p.premium_amount.toLocaleString('en-NG')}/month premium` : ''}
                {p.type === 'savings' ? p.description : ''}
              </p>
              <div className="flex flex-col gap-1">
                <p className="font-dm text-[12px] text-zovu-text">Min Pulse Score: <span className="text-zovu-text-light font-semibold">{p.min_pulse_score}</span></p>
                <p className="font-dm text-[12px] text-zovu-text">Active Enrollments: <span className="text-zovu-text-light font-semibold">{p.active_enrollments}</span></p>
              </div>
              <button className="mt-auto w-full py-2 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] text-center transition-colors border border-zovu-border">
                Edit
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button className="font-dm text-[14px] text-zovu-primary hover:underline">
            + Add New Product
          </button>
        </div>
      </div>

      {/* Customer Pool Preview */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Customer Pool Preview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {borrowers.map((b) => (
            <div key={b.id} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-5 flex flex-col gap-3 hover:border-zovu-primary/30 transition-colors">
              <div className="flex justify-between items-start">
                <p className="font-dm text-[16px] font-bold text-zovu-text-light">{b.display_name}</p>
                <div className={`px-2 py-0.5 rounded-full font-dm text-[11px] font-semibold tracking-wider uppercase ${getTierColor(b.tier)}`}>
                  {b.tier}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-dm text-[13px] text-zovu-text">Score: <span className="text-zovu-text-light font-semibold">{b.pulse_score}</span></p>
                <p className="font-dm text-[13px] text-zovu-text">LGA: <span className="text-zovu-text-light">{b.lga}</span></p>
                <p className="font-dm text-[13px] text-zovu-text">Purpose: <span className="text-zovu-text-light">{b.purpose}</span></p>
                <p className="font-dm text-[13px] text-zovu-text mt-1">Requested: <span className="text-zovu-primary font-bold text-[15px]">₦{b.loan_amount_requested.toLocaleString('en-NG')}</span></p>
              </div>
              <Link
                to={`/dashboard/partners/customers/${b.id}`}
                className="mt-2 w-full py-2.5 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[13px] font-medium rounded-[8px] text-center transition-colors border border-zovu-border"
              >
                View Profile
              </Link>
            </div>
          ))}
          {borrowers.length === 0 && (
            <div className="col-span-3 text-center py-10 border border-zovu-border border-dashed rounded-[12px] text-zovu-text font-dm text-[14px]">
              No customers available right now.
            </div>
          )}
        </div>
        <div className="mt-4">
          <Link to="/dashboard/partners/customers" className="font-dm text-[14px] text-zovu-primary hover:underline">
            View All Customers →
          </Link>
        </div>
      </div>
    </div>
  );
};
