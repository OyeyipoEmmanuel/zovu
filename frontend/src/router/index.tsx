
import { Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LenderHome, LenderSidebar } from '../features/lender/LenderHome';
import { BorrowerPool } from '../features/lender/BorrowerPool';
import { BorrowerProfile } from '../features/lender/BorrowerProfile';
import { MyLoans } from '../features/lender/MyLoans';
import { LenderCompleteProfile } from '../features/lender/signup/LenderCompleteProfile';
import { LenderStep1Account } from '../features/lender/signup/LenderStep1Account';
import { LenderStep2Identity } from '../features/lender/signup/LenderStep2Identity';
import { LenderStep3Funding } from '../features/lender/signup/LenderStep3Funding';
import { LenderProfileSuccess } from '../features/lender/signup/LenderProfileSuccess';

const LenderProtectedRoute = () => {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow 'Lender' or 'Both'
  const role = user.role as string;
  if (role.toLowerCase() !== 'lender' && role.toLowerCase() !== 'both') {
    return <Navigate to="/dashboard/trader" replace />;
  }

  return (
    <div className="flex bg-zovu-background min-h-screen">
      <LenderSidebar />
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  );
};

export const LenderRoutes = (
  <Route element={<LenderProtectedRoute />}>
    <Route path="/dashboard/lender" element={<LenderHome />} />
    <Route path="/dashboard/lender/borrowers" element={<BorrowerPool />} />
    <Route path="/dashboard/lender/borrowers/:id" element={<BorrowerProfile />} />
    <Route path="/dashboard/lender/loans" element={<MyLoans />} />
    <Route path="/dashboard/lender/complete-profile" element={<LenderCompleteProfile />}>
      <Route path="account" element={<LenderStep1Account />} />
      <Route path="identity" element={<LenderStep2Identity />} />
      <Route path="funding" element={<LenderStep3Funding />} />
      <Route path="success" element={<LenderProfileSuccess />} />
    </Route>
  </Route>
);
