import type React from 'react';
import { Link } from 'react-router-dom';
import ZovuLogo from '../../../assets/zovu.svg';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  step?: { current: number; total: number; label: string };
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, step }) => (
  <div className="min-h-screen bg-zovu-bg flex flex-col">
    {/* Top Bar */}
    <nav className="border-b border-zovu-border px-6 py-4 md:px-12 flex justify-between items-center">
      <Link to="/" className="flex items-center gap-2 group">
        <img src={ZovuLogo} alt="Logo" />
      </Link>
    </nav>

    {/* Content */}
    <main className="flex-1 flex items-center justify-center px-6 py-12 md:py-20">
      <div className="w-full max-w-[480px]">
        {/* Step Indicator */}
        {step && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <span className="font-dm text-[12px] font-bold text-zovu-text uppercase tracking-wider">
                {step.label}
              </span>
              <span className="font-dm text-[12px] font-bold text-zovu-amber">
                {step.current}/{step.total}
              </span>
            </div>
            <div className="w-full h-1 bg-zovu-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-zovu-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step.current / step.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-syne text-[32px] md:text-[40px] font-bold text-zovu-text-light leading-[1.1] mb-3">
            {title}
          </h1>
          {subtitle && (
            <p className="font-dm text-[16px] text-zovu-text leading-[1.5]">{subtitle}</p>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 md:p-8">
          {children}
        </div>
      </div>
    </main>
  </div>
);
