import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './features/LandingPage';
import {
  Login,
  PersonalInfo,
  RoleInfo,
  IdentityVerification,
  FinancialProfile,
  SignupSuccess,
} from './features/Auth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup/personal-info" element={<PersonalInfo />} />
        <Route path="/signup/role-info" element={<RoleInfo />} />
        <Route path="/signup/identity-verification" element={<IdentityVerification />} />
        <Route path="/signup/financial-profile" element={<FinancialProfile />} />
        <Route path="/signup/success" element={<SignupSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
