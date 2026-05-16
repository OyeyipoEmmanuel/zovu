import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { PartnerRoutes, JobSeekerRoutes, AdminRoutes } from './router';
import { LandingPage, PublicJobsPage } from './features/LandingPage';
import {
  Login,
  Signup,
} from './features/Auth';
import {
  TraderLayout,
  DashboardHome,
  Transactions,
  PulseScore,
  PostGig,
  Payments,
  Settings,
  Applicants,
  CompleteProfileLayout,
  Step1KYC,
  Step2Business,
  Step3Success,
} from './features/trader';
import { AjoTab } from './features/shared/AjoTab';
import { ServicesTab } from './features/shared/ServicesTab';

const DashboardRouter = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  
  const role = user.role?.toLowerCase();
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (role === 'partner' || role === 'lender' || role === 'both') {
    return <Navigate to="/dashboard/partners" replace />;
  }
  
  if (role === 'job_seeker') {
    return <Navigate to="/dashboard/job-seeker/onboarding" replace />;
  }

  return <Navigate to="/dashboard/trader" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/jobs" element={<PublicJobsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Trader Dashboard */}
        <Route path="/dashboard/trader" element={<TraderLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="ajo" element={<AjoTab />} />
          <Route path="services" element={<ServicesTab />} />
          <Route path="applicants" element={<Applicants />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="pulse" element={<PulseScore />} />
          <Route path="gig/post" element={<PostGig />} />
          <Route path="payments" element={<Payments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="complete-profile" element={<CompleteProfileLayout />}>
            <Route path="kyc" element={<Step1KYC />} />
            <Route path="business" element={<Step2Business />} />
            <Route path="success" element={<Step3Success />} />
          </Route>
        </Route>

        {/* Partners Dashboard Routes */}
        {PartnerRoutes}

        {/* Job Seeker Dashboard Routes */}
        {JobSeekerRoutes}

        {/* Admin Dashboard Routes */}
        {AdminRoutes}

        {/* Redirect /dashboard to appropriate dashboard based on role */}
        <Route path="/dashboard" element={<DashboardRouter />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
