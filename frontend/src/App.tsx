import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './features/LandingPage';
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
  CompleteProfileLayout,
  Step1KYC,
  Step2Business,
  Step3Success,
} from './features/trader';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Trader Dashboard */}
        <Route path="/dashboard/trader" element={<TraderLayout />}>
          <Route index element={<DashboardHome />} />
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

        {/* Redirect /dashboard to trader dashboard */}
        <Route path="/dashboard" element={<Navigate to="/dashboard/trader" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
