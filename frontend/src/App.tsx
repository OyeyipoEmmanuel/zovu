import React from 'react';
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

const DashboardPlaceholder = () => (
  <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
    <h1>Dashboard — coming soon</h1>
    <p>You are logged in. Dashboard UI is under construction.</p>
    <a href="/login">Log out</a>
  </div>
);

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
        <Route path="/dashboard" element={<DashboardPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
