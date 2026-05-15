
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPartnershipsAPI, adminPartnerAPI } from '../../../services/adminApi';
import AdminTable from '../components/AdminTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const PartnershipManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'requests' | 'pending_accounts' | 'active'>('pending_accounts');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['admin-partnership-requests'],
    queryFn: () => adminPartnershipsAPI.listRequests({ status: 'pending' }),
    enabled: activeTab === 'requests',
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['admin-active-partnerships'],
    queryFn: () => adminPartnershipsAPI.listActive(),
    enabled: activeTab === 'active',
  });

  const { data: pendingPartnersData, isLoading: pendingPartnersLoading } = useQuery({
    queryKey: ['admin-pending-partners'],
    queryFn: () => adminPartnerAPI.listPending() as Promise<{ ok: boolean; data: any[] }>,
    enabled: activeTab === 'pending_accounts',
  });

  const approvePartnerMutation = useMutation({
    mutationFn: (userId: string) => adminPartnerAPI.approve(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-partners'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminPartnershipsAPI.approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partnership-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-active-partnerships'] });
      alert('Partnership approved');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: any) => adminPartnershipsAPI.rejectRequest(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-partnership-requests'] });
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectNotes('');
      alert('Partnership rejected');
    },
  });

  const requestColumns = [
    {
      header: 'Company',
      key: 'company_name',
      render: (val: string, item: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-white">{val}</span>
          <span className="text-[12px] text-[#A0A0A0]">{item.company_type}</span>
        </div>
      ),
    },
    {
      header: 'Contact',
      key: 'contact_person',
      render: (val: string, item: any) => (
        <div className="flex flex-col">
          <span className="text-white">{val}</span>
          <span className="text-[12px] text-[#A0A0A0]">{item.contact_email}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (val: string) => <StatusBadge status={val} type="partnership" />,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (_: any, item: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => approveMutation.mutate(item.id)}
            disabled={approveMutation.isPending}
            className="px-3 py-1 bg-[#1A6B4A]/10 text-[#1A6B4A] text-[12px] rounded-[4px] hover:bg-[#1A6B4A]/20"
          >
            Approve
          </button>
          <button
            onClick={() => { setSelectedRequest(item); setIsRejectModalOpen(true); }}
            className="px-3 py-1 bg-red-500/10 text-red-500 text-[12px] rounded-[4px] hover:bg-red-500/20"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  const activeColumns = [
    {
      header: 'Partner',
      key: 'name',
      render: (val: string, item: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-white">{val}</span>
          <span className="text-[12px] text-[#A0A0A0]">{item.partnership_type}</span>
        </div>
      ),
    },
    {
      header: 'Commission',
      key: 'commission_bps',
      render: (val: number) => <span>{(val / 100).toFixed(2)}%</span>,
    },
    {
      header: 'Status',
      key: 'status',
      render: (val: string) => <StatusBadge status={val} type="partnership" />,
    },
    {
      header: 'Total Volume',
      key: 'total_volume_kobo',
      render: (val: number) => <span>₦{(val / 100).toLocaleString()}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-syne text-[32px] font-bold text-white mb-2">Partnerships</h1>
        <p className="font-dm text-[16px] text-[#A0A0A0]">Manage platform integrations and affiliate requests.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#141414] border border-white/5 rounded-[12px] w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('pending_accounts')}
          className={`px-6 py-2 rounded-[8px] font-dm text-[14px] font-medium transition-all whitespace-nowrap ${
            activeTab === 'pending_accounts' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          Pending Partners ({(pendingPartnersData as any)?.data?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-2 rounded-[8px] font-dm text-[14px] font-medium transition-all whitespace-nowrap ${
            activeTab === 'requests' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          New Requests ({((requestsData as any)?.data?.length) || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-[8px] font-dm text-[14px] font-medium transition-all whitespace-nowrap ${
            activeTab === 'active' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          Active Partners
        </button>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        {activeTab === 'pending_accounts' && (
          <PendingPartnersTable
            data={(pendingPartnersData as any)?.data || []}
            loading={pendingPartnersLoading}
            onApprove={(id: string) => approvePartnerMutation.mutate(id)}
            busy={approvePartnerMutation.isPending}
          />
        )}
        {activeTab === 'requests' && (
          <AdminTable
            columns={requestColumns}
            data={(requestsData as any)?.data || []}
            isLoading={requestsLoading}
          />
        )}
        {activeTab === 'active' && (
          <AdminTable
            columns={activeColumns}
            data={(activeData as any)?.data || []}
            isLoading={activeLoading}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={isRejectModalOpen}
        onClose={() => { setIsRejectModalOpen(false); setSelectedRequest(null); setRejectNotes(''); }}
        onConfirm={() => rejectMutation.mutate({ id: selectedRequest.id, reason: rejectNotes })}
        title="Reject Partnership Request?"
        description={`This will notify ${selectedRequest?.company_name} that their request has been declined. Please provide a reason below.`}
      >
        <div className="mt-4">
          <label className="text-[12px] text-[#A0A0A0] uppercase font-bold mb-2 block">Rejection Reason</label>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="e.g. Incomplete documentation, mismatch with platform values..."
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-[8px] p-4 text-[14px] text-white outline-none focus:border-red-500/50 min-h-[100px]"
          />
        </div>
      </ConfirmModal>
    </div>
  );
};

interface PendingPartner {
  id: string;
  email: string;
  company_name: string | null;
  full_name: string | null;
  email_verified: boolean;
  created_at: string;
}

const PendingPartnersTable: React.FC<{
  data: PendingPartner[];
  loading: boolean;
  busy: boolean;
  onApprove: (id: string) => void;
}> = ({ data, loading, busy, onApprove }) => {
  if (loading) {
    return <p className="font-dm text-[14px] text-white/60">Loading pending partners…</p>;
  }
  if (!data || data.length === 0) {
    return (
      <p className="font-dm text-[14px] text-white/60 py-6 text-center">
        No partners awaiting approval right now.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[12px] uppercase tracking-wider text-white/40 border-b border-white/10">
            <th className="py-3 px-2">Company</th>
            <th className="py-3 px-2">Email</th>
            <th className="py-3 px-2">Email verified</th>
            <th className="py-3 px-2">Signed up</th>
            <th className="py-3 px-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b border-white/5">
              <td className="py-3 px-2 text-white font-dm text-[14px]">
                {p.company_name || p.full_name || p.email}
              </td>
              <td className="py-3 px-2 text-white/70 font-dm text-[13px]">{p.email}</td>
              <td className="py-3 px-2 text-white/70 font-dm text-[13px]">
                {p.email_verified ? '✅' : '⌛'}
              </td>
              <td className="py-3 px-2 text-white/70 font-dm text-[13px]">
                {new Date(p.created_at).toLocaleDateString('en-GB')}
              </td>
              <td className="py-3 px-2 text-right">
                <button
                  type="button"
                  onClick={() => onApprove(p.id)}
                  disabled={busy}
                  className="px-3 py-1 bg-[#1A6B4A]/10 text-[#1A6B4A] text-[12px] rounded-[4px] hover:bg-[#1A6B4A]/20 disabled:opacity-50"
                >
                  Approve
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartnershipManagement;
