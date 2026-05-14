
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminComplaintsAPI } from '../../../services/adminApi';
import AdminTable from '../components/AdminTable';
import StatusBadge from '../components/StatusBadge';

const ComplaintManagement: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    category: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-complaints', filters],
    queryFn: () => adminComplaintsAPI.list(filters),
  });

  const columns = [
    {
      header: 'Complainant',
      key: 'complainant_id',
      render: (val: string, item: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-white">{item.id.slice(0, 8)}...</span>
          <span className="text-[12px] text-[#A0A0A0]">{val.slice(0, 8)}</span>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (val: string) => <span className="capitalize">{val.replace('_', ' ')}</span>,
    },
    {
      header: 'Urgency',
      key: 'urgency',
      render: (val: string) => <StatusBadge status={val} type="urgency" />,
    },
    {
      header: 'Status',
      key: 'status',
      render: (val: string) => <StatusBadge status={val} />,
    },
    {
      header: 'Date Filed',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (_: any, item: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/complaints/${item.id}`);
          }}
          className="text-[#F4A11D] font-medium hover:underline"
        >
          View Details
        </button>
      ),
    },
  ];

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-syne text-[32px] font-bold text-white mb-2">Complaint Management</h1>
          <p className="font-dm text-[16px] text-[#A0A0A0]">Review and resolve user complaints.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-6 bg-[#141414] border border-white/5 rounded-[16px]">
        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold">Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none focus:border-[#1A6B4A]"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold">Urgency</label>
          <select
            name="urgency"
            value={filters.urgency}
            onChange={handleFilterChange}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none focus:border-[#1A6B4A]"
          >
            <option value="">All Urgency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold">Category</label>
          <select
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            className="bg-[#2A2A2A] text-white border border-white/10 rounded-[8px] px-4 py-2 outline-none focus:border-[#1A6B4A]"
          >
            <option value="">All Categories</option>
            <option value="transaction_failed">Transaction Failed</option>
            <option value="payment_delayed">Payment Delayed</option>
            <option value="wrong_amount">Wrong Amount</option>
            <option value="duplicate_charge">Duplicate Charge</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        <AdminTable
          columns={columns}
          data={data?.data?.data || []}
          isLoading={isLoading}
          onRowClick={(item) => navigate(`/admin/complaints/${item.id}`)}
          nextCursor={data?.data?.next_cursor}
        />
      </div>
    </div>
  );
};

export default ComplaintManagement;
