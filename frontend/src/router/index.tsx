
import React, { useState } from 'react';
import { Route, Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useJobSeekerStore } from '../stores/jobSeekerStore';
import { submitKYC } from '../lib/api';
import { PartnersDashboard, PartnersSidebar, PartnersMobileNav } from '../features/partners/PartnersDashboard';
import { CustomerPool } from '../features/partners/CustomerPool';
import { CustomerProfile } from '../features/partners/CustomerProfile';
import { MyServices } from '../features/partners/MyServices';
import { PartnerCompleteProfile } from '../features/partners/signup/PartnerCompleteProfile';
import { PartnerStep1Account } from '../features/partners/signup/PartnerStep1Account';
import { PartnerStep2Identity } from '../features/partners/signup/PartnerStep2Identity';
import { PartnerStep3Funding } from '../features/partners/signup/PartnerStep3Funding';
import { PartnerProfileSuccess } from '../features/partners/signup/PartnerProfileSuccess';

// Job Seeker Onboarding Imports
import { JobSeekerOnboarding } from '../features/job_seeker/onboarding/JobSeekerOnboarding';
import { JobSeekerStep1Skills } from '../features/job_seeker/onboarding/JobSeekerStep1Skills';
import { JobSeekerStep2Experience } from '../features/job_seeker/onboarding/JobSeekerStep2Experience';
import { JobSeekerStep3CV } from '../features/job_seeker/onboarding/JobSeekerStep3CV';
import { JobSeekerStep4Preferences } from '../features/job_seeker/onboarding/JobSeekerStep4Preferences';
import { JobSeekerOnboardingSuccess } from '../features/job_seeker/onboarding/JobSeekerOnboardingSuccess';

// Job Seeker Dashboard Imports
import { JobSeekerDashboard } from '../features/job_seeker/dashboard/JobSeekerDashboard';
import { JobSeekerJobs } from '../features/job_seeker/dashboard/JobSeekerJobs';
import { JobSeekerTransactions } from '../features/job_seeker/dashboard/JobSeekerTransactions';
import { JobSeekerPulseScore } from '../features/job_seeker/dashboard/JobSeekerPulseScore';
import { JobSeekerGigHistory } from '../features/job_seeker/dashboard/JobSeekerGigHistory';
import { JobSeekerQRCheckin } from '../features/job_seeker/dashboard/JobSeekerQRCheckin';
import { JobSeekerNotifications } from '../features/job_seeker/dashboard/JobSeekerNotifications';

// Shared
import { AjoTab } from '../features/shared/AjoTab';
import { ServicesTab } from '../features/shared/ServicesTab';
import { LogoutButton } from '../features/shared/LogoutButton';

// Admin Imports
import { AdminGuard } from '../features/admin/AdminGuard';
import { AdminLayout } from '../features/admin/AdminLayout';
import AdminOverview from '../features/admin/screens/AdminOverview';
import ComplaintManagement from '../features/admin/screens/ComplaintManagement';
import ComplaintDetail from '../features/admin/screens/ComplaintDetail';
import FraudManagement from '../features/admin/screens/FraudManagement';
import MetricsDashboard from '../features/admin/screens/MetricsDashboard';
import PartnershipManagement from '../features/admin/screens/PartnershipManagement';
import AuditLog from '../features/admin/screens/AuditLog';
import AjoManagement from '../features/admin/screens/AjoManagement';

const PartnerProtectedRoute = () => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role as string || '').toLowerCase();
  if (role !== 'lender' && role !== 'both' && role !== 'partner') {
    return <Navigate to="/dashboard/trader" replace />;
  }

  return (
    <div className="flex bg-zovu-background min-h-screen">
      <PartnersSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 pb-24 md:pb-10">
        <Outlet />
      </main>
      <PartnersMobileNav />
    </div>
  );
};

export const PartnerRoutes = (
  <Route element={<PartnerProtectedRoute />}>
    <Route path="/dashboard/partners" element={<PartnersDashboard />} />
    <Route path="/dashboard/partners/customers" element={<CustomerPool />} />
    <Route path="/dashboard/partners/customers/:id" element={<CustomerProfile />} />
    <Route path="/dashboard/partners/services" element={<MyServices />} />
    <Route path="/dashboard/partners/complete-profile" element={<PartnerCompleteProfile />}>
      <Route path="account" element={<PartnerStep1Account />} />
      <Route path="identity" element={<PartnerStep2Identity />} />
      <Route path="funding" element={<PartnerStep3Funding />} />
      <Route path="success" element={<PartnerProfileSuccess />} />
    </Route>
  </Route>
);

// ─── Job Seeker Sidebar / Bottom Nav ────────────────────────

const jsNavItems = [
  { to: '/dashboard/job-seeker', label: 'Home', icon: '🏠' },
  { to: '/dashboard/job-seeker/jobs', label: 'Jobs', icon: '💼' },
  { to: '/dashboard/job-seeker/services', label: 'Services', icon: '🛍️' },
  { to: '/dashboard/job-seeker/ajo', label: 'Ajo', icon: '🪙' },
  { to: '/dashboard/job-seeker/transactions', label: 'Transactions', icon: '💳' },
  { to: '/dashboard/job-seeker/pulse', label: 'Pulse Score', icon: '📊' },
  { to: '/dashboard/job-seeker/gig-history', label: 'Gig History', icon: '📋' },
  { to: '/dashboard/job-seeker/notifications', label: 'Notifications', icon: '🔔' },
];

const JobSeekerSidebar = () => {
  const location = useLocation();
  return (
    <div className="w-64 bg-[#161616] border-r border-[#2A2A2A] flex-col min-h-screen p-6 hidden md:flex">
      <h2 className="font-syne text-[24px] font-bold text-[#1A6B4A] mb-10">Zovu</h2>
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {jsNavItems.map(item => {
          const isActive = location.pathname === item.to || (item.to !== '/dashboard/job-seeker' && location.pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`py-3 px-4 rounded-[8px] font-dm text-[14px] transition-colors flex items-center gap-3 ${
                isActive
                  ? 'bg-[#1A6B4A]/10 text-[#1A6B4A] font-medium'
                  : 'text-[#F5F5F5] hover:bg-[#2A2A2A]/50'
              }`}
            >
              <span className="text-[16px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="pt-4 mt-4 border-t border-[#2A2A2A]">
        <LogoutButton variant="sidebar" />
      </div>
    </div>
  );
};

const JobSeekerBottomNav = () => {
  const location = useLocation();
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#161616] border-t border-[#2A2A2A] flex md:hidden overflow-x-auto no-scrollbar items-center py-2 px-1 z-50 gap-1">
      {jsNavItems.map(item => {
        const isActive = location.pathname === item.to || (item.to !== '/dashboard/job-seeker' && location.pathname.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-md transition-colors shrink-0 min-w-[64px] ${
              isActive ? 'text-[#1A6B4A]' : 'text-[#A0A0A0]'
            }`}
          >
            <span className="text-[18px]">{item.icon}</span>
            <span className="font-dm text-[9px]">{item.label}</span>
          </Link>
        );
      })}
      <LogoutButton variant="bottom-bar" className="shrink-0 min-w-[64px]" />
    </div>
  );
};

// ─── Job Seeker Protected Route (with sidebar) ──────────────

const JobSeekerProtectedRoute = () => {
  const { kycComplete, squadVaCreated, setRedirectReason } = useJobSeekerStore();
  const location = useLocation();
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role as string || '').toLowerCase();
  if (role !== 'job_seeker' && role !== 'both') {
    return <Navigate to="/dashboard/trader" replace />;
  }

  // Route-level guards for sensitive routes
  const path = location.pathname;

  // Transactions — requires squadVaCreated
  if (path === '/dashboard/job-seeker/transactions' && !squadVaCreated) {
    setRedirectReason('Complete KYC to view transactions');
    return <Navigate to="/dashboard/job-seeker" replace />;
  }

  // Loans — requires kycComplete + squadVaCreated
  if (path === '/dashboard/job-seeker/loans' && (!kycComplete || !squadVaCreated)) {
    setRedirectReason(!kycComplete ? 'Complete KYC to apply for loans' : 'Set up your Zovu account to apply for loans');
    return <Navigate to="/dashboard/job-seeker" replace />;
  }

  // Insurance — requires kycComplete
  if (path === '/dashboard/job-seeker/insurance' && !kycComplete) {
    setRedirectReason('Complete KYC to apply for insurance');
    return <Navigate to="/dashboard/job-seeker" replace />;
  }

  return (
    <div className="bg-[#0D0D0D] min-h-screen text-white flex">
      <JobSeekerSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
        <Outlet />
      </main>
      <JobSeekerBottomNav />
    </div>
  );
};

// ─── Job Seeker Onboarding Protected Route (no sidebar) ─────

const JobSeekerOnboardingProtectedRoute = () => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = (user.role as string || '').toLowerCase();
  if (role !== 'job_seeker' && role !== 'both') {
    return <Navigate to="/dashboard/trader" replace />;
  }

  return (
    <div className="bg-[#0D0D0D] min-h-screen text-white">
      <Outlet />
    </div>
  );
};

// ─── Job Seeker KYC Flow ─────────────────────────────────────

const JobSeekerKYCLayout: React.FC = () => {
  const location = useLocation();
  const isSuccess = location.pathname.includes('/success');

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {!isSuccess && (
          <div className="mb-8">
            <h1 className="font-syne text-[24px] font-bold text-[#F5F5F5] text-center mb-2">
              Verify Your Identity
            </h1>
            <p className="font-dm text-[14px] text-[#A0A0A0] text-center">
              Complete KYC to unlock payments, loans, and insurance
            </p>
          </div>
        )}
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-[16px] p-6 sm:p-8 shadow-2xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const JobSeekerKYC: React.FC = () => {
  const navigate = useNavigate();
  const { setKycComplete, setSquadVaCreated, setSquadVaNumber } = useJobSeekerStore();

  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'1' | '2'>('1');
  const [address, setAddress] = useState('');

  const [ninFocused, setNinFocused] = useState(false);
  const [bvnFocused, setBvnFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    /^\d{11}$/.test(nin) &&
    /^\d{11}$/.test(bvn) &&
    middleName.trim().length > 0 &&
    dob !== '' &&
    address.trim().length > 0;

  const handleMask = (val: string, isFocused: boolean) => {
    if (isFocused || val.length <= 4) return val;
    return '*'.repeat(val.length - 4) + val.slice(-4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      const [y, m, d] = dob.split('-');
      const formattedDob = `${m}/${d}/${y}`;

      const res = await submitKYC({
        nin,
        bvn,
        middle_name: middleName,
        dob: formattedDob,
        gender,
        address,
      });

      if (res.kyc_complete) {
        setKycComplete(true);
        setSquadVaCreated(true);
        if (res.squad_va_number) {
          setSquadVaNumber(res.squad_va_number);
        }
        navigate('/dashboard/job-seeker/complete-profile/success');
      }
    } catch {
      setError('We could not verify your identity. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 border-4 border-[#1A6B4A]/30 border-t-[#1A6B4A] rounded-full animate-spin mb-6" />
        <p className="font-dm text-[15px] text-[#F5F5F5] font-medium animate-pulse">
          Creating your Zovu account...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-syne text-[20px] font-bold text-[#F5F5F5] mb-1">
        KYC Verification
      </h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 text-center">
          <p className="font-dm text-[13px] text-red-400 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="px-4 py-1.5 bg-[#2A2A2A] text-[#F5F5F5] font-dm text-[12px] rounded-[6px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* NIN */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">NIN (11 digits)</label>
        <input
          type="text"
          value={handleMask(nin, ninFocused)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (ninFocused) setNin(val);
          }}
          onFocus={() => setNinFocused(true)}
          onBlur={() => setNinFocused(false)}
          placeholder="Enter your NIN"
          className="w-full bg-transparent border border-[#2A2A2A] rounded-[8px] font-dm text-[14px] text-[#F5F5F5] px-4 py-3 outline-none focus:border-[#1A6B4A] transition-colors"
        />
        <div className="flex justify-between items-center mt-0.5">
          <span className="font-dm text-[11px] text-[#A0A0A0]">Dial *346# to get your NIN</span>
          {nin.length > 0 && nin.length !== 11 && (
            <span className="font-dm text-[11px] text-red-400">Must be 11 digits</span>
          )}
        </div>
      </div>

      {/* BVN */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">BVN (11 digits)</label>
        <input
          type="text"
          value={handleMask(bvn, bvnFocused)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (bvnFocused) setBvn(val);
          }}
          onFocus={() => setBvnFocused(true)}
          onBlur={() => setBvnFocused(false)}
          placeholder="Enter your BVN"
          className="w-full bg-transparent border border-[#2A2A2A] rounded-[8px] font-dm text-[14px] text-[#F5F5F5] px-4 py-3 outline-none focus:border-[#1A6B4A] transition-colors"
        />
        <div className="flex justify-between items-center mt-0.5">
          <span className="font-dm text-[11px] text-[#A0A0A0]">Dial *565*0# to get your BVN</span>
          {bvn.length > 0 && bvn.length !== 11 && (
            <span className="font-dm text-[11px] text-red-400">Must be 11 digits</span>
          )}
        </div>
      </div>

      {/* Middle Name */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">Middle Name</label>
        <input
          type="text"
          value={middleName}
          onChange={(e) => setMiddleName(e.target.value)}
          placeholder="As it appears on your ID"
          className="w-full bg-transparent border border-[#2A2A2A] rounded-[8px] font-dm text-[14px] text-[#F5F5F5] px-4 py-3 outline-none focus:border-[#1A6B4A] transition-colors"
        />
      </div>

      {/* DOB & Gender */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-transparent border border-[#2A2A2A] rounded-[8px] font-dm text-[14px] text-[#F5F5F5] px-4 py-3 outline-none focus:border-[#1A6B4A] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">Gender</label>
          <div className="flex gap-1 p-1 bg-[#2A2A2A] border border-[#2A2A2A] rounded-[8px]">
            <button
              type="button"
              onClick={() => setGender('1')}
              className={`flex-1 py-2 rounded-[6px] font-dm text-[12px] font-medium transition-all ${
                gender === '1' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0]'
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender('2')}
              className={`flex-1 py-2 rounded-[6px] font-dm text-[12px] font-medium transition-all ${
                gender === '2' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0]'
              }`}
            >
              Female
            </button>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-[#F5F5F5] font-medium">Full Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your residential address"
          rows={2}
          className="w-full bg-transparent border border-[#2A2A2A] rounded-[8px] font-dm text-[14px] text-[#F5F5F5] px-4 py-3 outline-none focus:border-[#1A6B4A] transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full mt-2 bg-[#1A6B4A] text-white font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Verify Identity
      </button>

      <Link to="/dashboard/job-seeker" className="font-dm text-[13px] text-[#A0A0A0] hover:text-[#F5F5F5] text-center transition-colors">
        ← Back to Dashboard
      </Link>
    </form>
  );
};

const JobSeekerKYCSuccess: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="w-16 h-16 rounded-full bg-[#1A6B4A]/20 flex items-center justify-center mb-6">
        <span className="text-[32px]">✅</span>
      </div>
      <h2 className="font-syne text-[24px] font-bold text-[#F5F5F5] mb-2">Identity Verified!</h2>
      <p className="font-dm text-[14px] text-[#A0A0A0] mb-6 max-w-sm">
        Your Zovu account has been created. You can now receive payments, apply for loans, and access insurance.
      </p>
      <button
        onClick={() => navigate('/dashboard/job-seeker')}
        className="w-full bg-[#1A6B4A] text-white font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 transition-all"
      >
        Go to Dashboard
      </button>
    </div>
  );
};

export const JobSeekerRoutes = (
  <>
    {/* Dashboard Routes (with sidebar) */}
    <Route element={<JobSeekerProtectedRoute />}>
      <Route path="/dashboard/job-seeker" element={<JobSeekerDashboard />} />
      <Route path="/dashboard/job-seeker/jobs" element={<JobSeekerJobs />} />
      <Route path="/dashboard/job-seeker/services" element={<ServicesTab />} />
      <Route path="/dashboard/job-seeker/ajo" element={<AjoTab />} />
      <Route path="/dashboard/job-seeker/transactions" element={<JobSeekerTransactions />} />
      <Route path="/dashboard/job-seeker/pulse" element={<JobSeekerPulseScore />} />
      <Route path="/dashboard/job-seeker/gig-history" element={<JobSeekerGigHistory />} />
      <Route path="/dashboard/job-seeker/qr-checkin" element={<JobSeekerQRCheckin />} />
      <Route path="/dashboard/job-seeker/notifications" element={<JobSeekerNotifications />} />
    </Route>

    {/* Onboarding Routes (no sidebar) */}
    <Route element={<JobSeekerOnboardingProtectedRoute />}>
      <Route path="/dashboard/job-seeker/onboarding" element={<JobSeekerOnboarding />}>
        <Route index element={<Navigate to="skills" replace />} />
        <Route path="skills" element={<JobSeekerStep1Skills />} />
        <Route path="experience" element={<JobSeekerStep2Experience />} />
        <Route path="cv" element={<JobSeekerStep3CV />} />
        <Route path="preferences" element={<JobSeekerStep4Preferences />} />
        <Route path="success" element={<JobSeekerOnboardingSuccess />} />
      </Route>

      {/* KYC / Complete Profile Routes (no sidebar) */}
      <Route path="/dashboard/job-seeker/complete-profile" element={<JobSeekerKYCLayout />}>
        <Route path="kyc" element={<JobSeekerKYC />} />
        <Route path="success" element={<JobSeekerKYCSuccess />} />
      </Route>
    </Route>
  </>
);

// ─── Admin Dashboard Routes ───────────────────────────────────

export const AdminRoutes = (
  <Route
    element={
      <AdminGuard>
        <AdminLayout />
      </AdminGuard>
    }
  >
    <Route path="/admin" element={<AdminOverview />} />
    <Route path="/admin/complaints" element={<ComplaintManagement />} />
    <Route path="/admin/complaints/:id" element={<ComplaintDetail />} />
    <Route path="/admin/fraud" element={<FraudManagement />} />
    <Route path="/admin/metrics" element={<MetricsDashboard />} />
    <Route path="/admin/partnerships" element={<PartnershipManagement />} />
    <Route path="/admin/ajo" element={<AjoManagement />} />
    <Route path="/admin/audit" element={<AuditLog />} />
  </Route>
);
