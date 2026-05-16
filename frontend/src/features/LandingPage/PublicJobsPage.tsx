/**
 * Standalone /jobs route — same component as the embedded landing-page section,
 * but rendered as its own page so external visitors can deep-link / share.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../assets/zovu.svg';
import { PublicJobs } from './components/PublicJobs';
import { Button } from './components/Button';

export const PublicJobsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zovu-bg flex flex-col">
      <nav className="sticky top-0 w-full z-50 bg-zovu-bg border-b border-zovu-border px-6 py-4 md:px-12 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="Zovu" />
        </Link>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="secondary" className="hidden sm:flex">
              Log In
            </Button>
          </Link>
          <Link to="/signup?role=job_seeker">
            <Button variant="primary">Open Account</Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 py-10 px-2">
        <div className="max-w-6xl mx-auto mb-8 px-4">
          <h1 className="font-syne text-[32px] md:text-[40px] font-bold text-zovu-text-light mb-2">
            Open gigs near you
          </h1>
          <p className="font-dm text-[14px] md:text-[16px] text-zovu-text max-w-2xl">
            Browse real jobs posted by traders on Zovu. Sign up free to apply and
            start building your financial identity with every gig completed.
          </p>
        </div>
        <PublicJobs embedded={false} />
      </main>

      <footer className="border-t border-zovu-border py-8 px-6 text-center text-zovu-text text-sm">
        <p>&copy; {new Date().getFullYear()} Zovu Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};
