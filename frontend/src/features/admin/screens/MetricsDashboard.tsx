
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminMetricsAPI } from '../../../services/adminApi';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#1A6B4A', '#F4A11D', '#3B82F6', '#EF4444', '#8B5CF6'];

const MetricsDashboard: React.FC = () => {
  const [days, setDays] = useState(30);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-metrics-users', days],
    queryFn: () => adminMetricsAPI.getUsers(days),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['admin-metrics-tx', days],
    queryFn: () => adminMetricsAPI.getTransactions(days),
  });

  const { data: bizData } = useQuery({
    queryKey: ['admin-metrics-biz'],
    queryFn: () => adminMetricsAPI.getBusinesses(),
  });

  const handleExport = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = (await adminMetricsAPI.getDailyReport(today)) as any;
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zovu_report_${today}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed');
    }
  };

  // `request()` already unwraps the envelope — the query results ARE the metric payloads.
  const users = usersData as any;
  const tx = txData as any;
  const biz = bizData as any;
  const userChartData = users?.daily_new_users
    ? Object.entries(users.daily_new_users).map(([date, count]) => ({ date, count }))
    : [];
  const txStatusData = tx?.status_breakdown || [];
  const sectorData = biz?.sector_distribution || [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-syne text-[32px] font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="font-dm text-[16px] text-[#A0A0A0]">Deep dive into platform growth and health.</p>
        </div>
        <div className="flex gap-4">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <button
            onClick={handleExport}
            className="px-6 py-2 bg-[#1A6B4A] text-white font-bold rounded-[8px] hover:brightness-110"
          >
            Export Daily Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Growth */}
        <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6 h-[400px]">
          <h3 className="font-syne text-[18px] font-bold text-white mb-6">User Growth</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={userChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#A0A0A0" 
                fontSize={12} 
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              />
              <YAxis stroke="#A0A0A0" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#161616', border: '1px solid #2A2A2A' }}
                itemStyle={{ color: '#F5F5F5' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#1A6B4A" 
                strokeWidth={3} 
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Status */}
        <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6 h-[400px]">
          <h3 className="font-syne text-[18px] font-bold text-white mb-6">TX Status Breakdown</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={txStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                nameKey="status"
              >
                {txStatusData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#161616', border: '1px solid #2A2A2A' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Distribution */}
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 rounded-[16px] p-6 h-[400px]">
          <h3 className="font-syne text-[18px] font-bold text-white mb-6">Business Sector Distribution</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={sectorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="sector" stroke="#A0A0A0" fontSize={12} />
              <YAxis stroke="#A0A0A0" fontSize={12} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: '#161616', border: '1px solid #2A2A2A' }}
              />
              <Bar dataKey="count" fill="#F4A11D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
