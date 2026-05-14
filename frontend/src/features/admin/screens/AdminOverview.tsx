
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminMetricsAPI, adminAuditAPI } from '../../../services/adminApi';
import { StatCard } from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { Link } from 'react-router-dom';

const AdminOverview: React.FC = () => {
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-overview-metrics'],
    queryFn: () => adminMetricsAPI.getOverview(),
    refetchInterval: 120000, // 2 minutes
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-recent-audit'],
    queryFn: () => adminAuditAPI.getLog({ limit: 10 }),
  });

  const metrics = metricsData?.data;
  const auditLogs = auditData?.data?.data || [];

  const formatNaira = (kobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(kobo / 100);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-syne text-[32px] font-bold text-white mb-2">Operations Overview</h1>
        <p className="font-dm text-[16px] text-[#A0A0A0]">Real-time platform performance and alerts.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Users"
          value={metrics?.users?.total?.toLocaleString() || '0'}
          trend={`+${metrics?.users?.new_today || 0} today`}
          trendDirection="up"
          subtitle={`${metrics?.users?.kyc_verified || 0} KYC verified`}
        />
        <StatCard
          title="Businesses"
          value={metrics?.users?.traders?.toLocaleString() || '0'}
          trend={`+${metrics?.users?.new_this_month || 0} this month`}
          trendDirection="up"
          subtitle="Active registered traders"
        />
        <StatCard
          title="TX Volume (Today)"
          value={formatNaira(metrics?.transactions?.volume_today_kobo || 0)}
          trend={`${metrics?.transactions?.success_rate_pct?.toFixed(1) || 0}% success rate`}
          trendDirection="neutral"
          subtitle={`${metrics?.transactions?.count_today || 0} transactions today`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Breakdown */}
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 rounded-[16px] p-6">
          <h3 className="font-syne text-[18px] font-bold text-white mb-6">User Breakdown</h3>
          <div className="space-y-6">
            <BreakdownRow
              label="Traders"
              count={metrics?.users?.traders || 0}
              total={metrics?.users?.total || 1}
              color="bg-[#1A6B4A]"
            />
            <BreakdownRow
              label="Seekers"
              count={metrics?.users?.seekers || 0}
              total={metrics?.users?.total || 1}
              color="bg-blue-500"
            />
            <BreakdownRow
              label="Lenders"
              count={metrics?.users?.lenders || 0}
              total={metrics?.users?.total || 1}
              color="bg-amber-500"
            />
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
          <h3 className="font-syne text-[18px] font-bold text-white mb-6">Critical Alerts</h3>
          <div className="space-y-4">
            <AlertItem
              color="red"
              count={metrics?.alerts?.new_fraud_flags || 0}
              label="New Fraud Flags"
              link="/admin/fraud"
            />
            <AlertItem
              color="amber"
              count={metrics?.alerts?.unresolved_complaints || 0}
              label="Pending Complaints"
              link="/admin/complaints"
            />
            <AlertItem
              color="blue"
              count={metrics?.alerts?.pending_partnerships || 0}
              label="Partnership Requests"
              link="/admin/partnerships"
            />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-syne text-[18px] font-bold text-white">Recent Activity</h3>
          <Link to="/admin/audit" className="text-[#F4A11D] text-[14px] font-medium hover:underline">
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[#A0A0A0] text-[12px] uppercase">
                <th className="pb-3 font-medium">Admin</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Target</th>
                <th className="pb-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {auditLogs.map((log: any) => (
                <tr key={log.id} className="text-[14px]">
                  <td className="py-4 text-white font-medium">{log.admin_email}</td>
                  <td className="py-4">
                    <StatusBadge status={log.action} />
                  </td>
                  <td className="py-4 text-[#A0A0A0]">
                    {log.target_type} {log.target_id?.slice(0, 8)}
                  </td>
                  <td className="py-4 text-[#A0A0A0]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && !auditLoading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#A0A0A0]">No recent activity</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BreakdownRow = ({ label, count, total, color }: any) => {
  const percentage = (count / total) * 100;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[14px]">
        <span className="text-[#F5F5F5] font-medium">{label}</span>
        <span className="text-[#A0A0A0]">{count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const AlertItem = ({ color, count, label, link }: any) => {
  const colorClasses = {
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  }[color as 'red' | 'amber' | 'blue'];

  return (
    <Link 
      to={link}
      className="flex items-center justify-between p-4 border border-white/5 rounded-[12px] hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 flex items-center justify-center rounded-[8px] font-bold ${colorClasses}`}>
          {count}
        </div>
        <span className="font-dm text-[14px] text-[#F5F5F5]">{label}</span>
      </div>
      <span className="text-[#A0A0A0]">→</span>
    </Link>
  );
};

export default AdminOverview;
