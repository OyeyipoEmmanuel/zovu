import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUIStore } from '../../../stores';
import {
  HiOutlineHome,
  HiOutlineSwitchHorizontal,
  HiOutlineChartBar,
  HiOutlinePlusCircle,
  HiOutlineCreditCard,
  HiOutlineCog,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineCurrencyDollar,
} from 'react-icons/hi';

const navItems = [
  { to: '/dashboard/trader', icon: HiOutlineHome, label: 'Home', end: true },
  { to: '/dashboard/trader/ajo', icon: HiOutlineCurrencyDollar, label: 'Ajo' },
  { to: '/dashboard/trader/transactions', icon: HiOutlineSwitchHorizontal, label: 'Transactions' },
  { to: '/dashboard/trader/pulse', icon: HiOutlineChartBar, label: 'Pulse Score' },
  { to: '/dashboard/trader/gig/post', icon: HiOutlinePlusCircle, label: 'Post a Gig' },
  { to: '/dashboard/trader/payments', icon: HiOutlineCreditCard, label: 'Payments' },
  { to: '/dashboard/trader/settings', icon: HiOutlineCog, label: 'Settings' },
];

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center gap-3 px-4 py-3 rounded-[8px] font-dm text-[14px] transition-all duration-200 ${
    isActive
      ? 'bg-zovu-primary/10 text-zovu-primary font-medium'
      : 'text-zovu-text hover:text-zovu-text-light hover:bg-zovu-surface-2'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex flex-col items-center gap-1 py-2 px-1 text-[10px] font-dm transition-all duration-200 ${
    isActive ? 'text-zovu-primary font-medium' : 'text-zovu-text'
  }`;

export const TraderLayout: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const location = useLocation();

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <div className="min-h-screen bg-zovu-bg flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-zovu-border bg-zovu-surface-1 fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-5 border-b border-zovu-border">
          <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Zovu</h2>
          <p className="font-dm text-[11px] text-zovu-text mt-0.5 uppercase tracking-wider">Trader Dashboard</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-zovu-border">
          <p className="font-dm text-[11px] text-zovu-text/60">Powered by Squad</p>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 inset-y-0 w-[280px] bg-zovu-surface-1 border-r border-zovu-border flex flex-col animate-slide-in">
            <div className="px-6 py-5 border-b border-zovu-border flex items-center justify-between">
              <div>
                <h2 className="font-syne text-[20px] font-bold text-zovu-text-light">Zovu</h2>
                <p className="font-dm text-[11px] text-zovu-text mt-0.5 uppercase tracking-wider">
                  Trader Dashboard
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-zovu-text hover:text-zovu-text-light transition-colors"
              >
                <HiOutlineX size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-[260px] min-h-screen pb-20 lg:pb-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-zovu-bg/80 backdrop-blur-md border-b border-zovu-border px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-zovu-text hover:text-zovu-text-light transition-colors"
          >
            <HiOutlineMenu size={22} />
          </button>
          <h2 className="font-syne text-[16px] font-bold text-zovu-text-light">Zovu</h2>
          <div className="w-8" />
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1200px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-zovu-surface-1/95 backdrop-blur-md border-t border-zovu-border">
        <div className="grid grid-cols-7 px-1 py-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
