
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAuditAPI } from '../../../services/adminApi';
import AdminTable from '../components/AdminTable';
import StatusBadge from '../components/StatusBadge';

const AuditLog: React.FC = () => {
  const [filters, setFilters] = useState({
    action: '',
    target_type: '',
    cursor: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-log', filters],
    queryFn: () => adminAuditAPI.getLog(filters),
  });

  const columns = [
    {
      header: 'Admin',
      key: 'admin_email',
      render: (val: string) => <span className="text-white font-medium">{val}</span>,
    },
    {
      header: 'Action',
      key: 'action',
      render: (val: string) => <StatusBadge status={val} />,
    },
    {
      header: 'Target',
      key: 'target_type',
      render: (val: string, item: any) => (
        <span className="text-[#A0A0A0]">
          {val} <span className="font-mono text-[12px]">({item.target_id?.slice(0, 8)})</span>
        </span>
      ),
    },
    {
      header: 'Metadata',
      key: 'action_metadata',
      render: (val: any) => (
        <pre className="text-[11px] text-[#A0A0A0] max-w-[200px] truncate">
          {JSON.stringify(val)}
        </pre>
      ),
    },
    {
      header: 'Timestamp',
      key: 'created_at',
      render: (val: string) => (
        <div className="flex flex-col">
          <span className="text-white">{new Date(val).toLocaleDateString()}</span>
          <span className="text-[11px] text-[#A0A0A0]">{new Date(val).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      header: 'IP Address',
      key: 'ip_address',
      render: (val: string) => <span className="font-mono text-[12px] text-[#A0A0A0]">{val || '—'}</span>,
    },
  ];

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value, cursor: '' }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-syne text-[32px] font-bold text-white mb-2">Audit Logs</h1>
        <p className="font-dm text-[16px] text-[#A0A0A0]">Immutable record of all administrative actions.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-6 bg-[#141414] border border-white/5 rounded-[16px]">
        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold">Action Type</label>
          <select
            name="action"
            value={filters.action}
            onChange={handleFilterChange}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none focus:border-[#1A6B4A]"
          >
            <option value="">All Actions</option>
            <option value="complaint_resolved">Complaint Resolved</option>
            <option value="user_flagged">User Flagged</option>
            <option value="user_paused">User Paused</option>
            <option value="user_restored">User Restored</option>
            <option value="user_deleted">User Deleted</option>
            <option value="partnership_approved">Partnership Approved</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold">Target Type</label>
          <select
            name="target_type"
            value={filters.target_type}
            onChange={handleFilterChange}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none focus:border-[#1A6B4A]"
          >
            <option value="">All Targets</option>
            <option value="user">User</option>
            <option value="complaint">Complaint</option>
            <option value="partnership">Partnership</option>
          </select>
        </div>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        <AdminTable
          columns={columns}
          data={(data as any)?.data || []}
          isLoading={isLoading}
          nextCursor={(data as any)?.next_cursor}
          onLoadMore={() => setFilters(prev => ({ ...prev, cursor: (data as any)?.next_cursor }))}
        />
      </div>
    </div>
  );
};

export default AuditLog;
