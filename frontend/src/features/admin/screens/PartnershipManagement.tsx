
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPartnershipsAPI } from '../../../services/adminApi';
import AdminTable from '../components/AdminTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const PartnershipManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'requests' | 'active'>('requests');
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
      <div className="flex gap-1 p-1 bg-[#141414] border border-white/5 rounded-[12px] w-fit">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-2 rounded-[8px] font-dm text-[14px] font-medium transition-all ${
            activeTab === 'requests' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          New Requests ({requestsData?.data?.total || 0})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-6 py-2 rounded-[8px] font-dm text-[14px] font-medium transition-all ${
            activeTab === 'active' ? 'bg-[#1A6B4A] text-white' : 'text-[#A0A0A0] hover:text-white'
          }`}
        >
          Active Partners
        </button>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        {activeTab === 'requests' ? (
          <AdminTable
            columns={requestColumns}
            data={requestsData?.data?.data || []}
            isLoading={requestsLoading}
          />
        ) : (
          <AdminTable
            columns={activeColumns}
            data={activeData?.data?.data || []}
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

export default PartnershipManagement;
