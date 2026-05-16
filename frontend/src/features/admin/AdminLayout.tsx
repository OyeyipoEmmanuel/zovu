/**
 * AdminLayout - Main admin dashboard layout
 * Features: sidebar navigation, responsive design, alert badges
 */
import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminMetricsAPI } from "@/services/adminApi";
import { LogoutButton } from "../shared/LogoutButton";
import {
  LayoutDashboard,
  FolderOpen,
  ShieldAlert,
  LineChart,
  Handshake,
  Coins,
  FileClock,
  Building2,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  Icon: LucideIcon;
  path: string;
  badge?: number;
}

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch overview for alert badges
  const { data: overview } = useQuery({
    queryKey: ["admin", "metrics", "overview"],
    queryFn: () => adminMetricsAPI.getOverview(),
    refetchInterval: 120000, // 2 minutes
  });

  // request() unwraps the envelope, so `overview` IS the metrics payload.
  const alerts = ((overview as any) || {}).alerts || {};

  const navItems: NavItem[] = [
    { label: "Overview", Icon: LayoutDashboard, path: "/admin" },
    {
      label: "Complaints",
      Icon: FolderOpen,
      path: "/admin/complaints",
      badge: alerts.unresolved_complaints,
    },
    {
      label: "Fraud Management",
      Icon: ShieldAlert,
      path: "/admin/fraud",
      badge: alerts.new_fraud_flags,
    },
    { label: "Metrics", Icon: LineChart, path: "/admin/metrics" },
    {
      label: "Partnerships",
      Icon: Handshake,
      path: "/admin/partnerships",
      badge: alerts.pending_partnerships,
    },
    { label: "Partners", Icon: Building2, path: "/admin/partners" },
    { label: "Ajo", Icon: Coins, path: "/admin/ajo" },
    { label: "Audit Log", Icon: FileClock, path: "/admin/audit" },
  ];

  return (
    <div className="flex h-screen bg-[#0D0D0D]">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-[#0D0D0D] border-r border-white/8 transition-all duration-300 flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-4 border-b border-white/8">
          <h1
            className={`font-syne font-bold text-[#F4A11D] ${
              sidebarOpen ? "text-2xl" : "text-center text-sm"
            }`}
          >
            {sidebarOpen ? "ZOVU Admin" : "Z"}
          </h1>
          {sidebarOpen && (
            <p className="text-white/60 text-xs font-dm-sans">
              Operations Dashboard
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            // Treat the route as active if it matches exactly OR a deeper
            // child route is open (e.g. /admin/complaints/<id>).
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(`${item.path}/`));
            const Icon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${
                  isActive
                    ? "bg-[#1A6B4A] text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} strokeWidth={1.75} />
                {sidebarOpen && (
                  <>
                    <span className="font-dm-sans text-sm font-medium">
                      {item.label}
                    </span>
                    {item.badge && item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: logout + toggle */}
        <div className="p-4 border-t border-white/8 flex flex-col gap-2">
          {sidebarOpen ? (
            <LogoutButton variant="sidebar" />
          ) : (
            <LogoutButton variant="icon" label="" />
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full p-2 hover:bg-white/5 rounded-lg text-white/60 text-sm flex items-center justify-center"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="border-b border-white/8 bg-[#0D0D0D] sticky top-0 z-10 p-6">
          <h1 className="font-syne text-white text-2xl">Admin Dashboard</h1>
          <p className="text-white/60 text-sm font-dm-sans">
            Last refreshed:{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
