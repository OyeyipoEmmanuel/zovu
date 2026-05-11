import React from 'react';
import { Button } from './components/Button';
import { Card, CardHeader, CardTitle, CardContent } from './components/Card';
import HeroImg from "../../assets/hero.png"
import { GoBriefcase } from "react-icons/go";
import { CiShop } from "react-icons/ci";
import { CiBank } from "react-icons/ci";
import Logo from '../../assets/zovu.svg';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zovu-bg flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-zovu-border px-6 py-4 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={Logo} alt="" />
        </div>
        <div className="hidden md:flex gap-8 items-center">
          <Button variant="tertiary">Features</Button>
          <Button variant="tertiary">Solutions</Button>
          <Button variant="tertiary">Pricing</Button>
        </div>
        <div className="flex gap-4">
          <Link to="/login">
            <Button variant="secondary" className="hidden sm:flex">Log In</Button>
          </Link>
          <Link to="/signup">
              <Button variant="primary">Open Account</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center gap-12 md:gap-0 px-6 py-20 md:py-20 w-full md:max-w-7xl md:flex-row md:justify-between ">
        <div className='md:w-[60%]'>
          <h1 className="font-syne text-[48px] md:text-[64px] font-bold leading-[1.1] tracking-tight mb-6">
            Your hustle deserves a
            <span className="text-zovu-primary"> Financial Identity</span>
          </h1>

          <p className="font-dm text-[18px] md:text-[20px] text-zovu-text md:max-w-lg mb-10 leading-[1.6]">
            We turn how you trade, work, and save into a credit identity that unlocks real financial services — loans, savings, insurance.
          </p>

          <div className="">
            <Link to="/signup"><Button variant="primary" className="text-[16px] w-full md:w-[50%] px-8">Get Started</Button></Link>
          </div>

        </div>
        <div>
          <img src={HeroImg} alt="Vovu" />
        </div>
      </main>

      {/* Features Section */}
      <section className="px-6 py-20 border-t border-zovu-border bg-zovu-surface-2 bg-opacity-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="font-syne text-[32px] font-semibold mb-4 text-zovu-text-light">Precision built for the Real Economy</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-[8px] bg-[#1C1C1C] border border-zovu-border flex items-center justify-center mb-4 text-zovu-primary">
                  <GoBriefcase size={24} />
                </div>
                <CardTitle>Job Seeker Engine</CardTitle>
              </CardHeader>
              <CardContent>
                Get matched to opportunities based on your real skills and location — and build a financial reputation with every gig you complete.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-[8px] bg-[#1C1C1C] border border-zovu-border flex items-center justify-center mb-4 text-zovu-amber">
                  <CiShop size={24} />
                </div>
                <CardTitle>Informal Trade Layer</CardTitle>
              </CardHeader>
              <CardContent>
                Receive payments, and build a credit score from every transaction — so your market stall can finally access a loan.
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-[8px] bg-[#1C1C1C] border border-zovu-border flex items-center justify-center mb-4 text-zovu-text-light">
                  <CiBank size={24} />
                </div>
                <CardTitle>Finaicial Inclusion Core</CardTitle>
              </CardHeader>
              <CardContent>
                Access a verified pool of creditworthy borrowers backed by real behavioural data — not paperwork.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zovu-border py-8 px-6 text-center text-zovu-text text-sm">
        <p>&copy; {new Date().getFullYear()} Zovu Platform. All rights reserved.</p>
      </footer>
    </div>
  );
};
