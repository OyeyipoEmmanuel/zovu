
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFraudAPI } from '../../../services/adminApi';
import AdminTable from '../components/AdminTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const FraudManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionType, setActionType] = useState<'pause' | 'unpause' | 'delete' | null>(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-flagged-users'],
    queryFn: () => adminFraudAPI.getFlaggedUsers({ min_score: 50 }),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['admin-fraud-analytics'],
    queryFn: () => adminFraudAPI.getAnalytics(),
  });

  const actionMutation = useMutation({
    mutationFn: ({ userId, type, body }: any) => {
      if (type === 'pause') return adminFraudAPI.pauseUser(userId, body);
      if (type === 'unpause') return adminFraudAPI.unpauseUser(userId);
      if (type === 'delete') return adminFraudAPI.deleteUser(userId, body);
      throw new Error('Invalid action');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-flagged-users'] });
      alert('Action successful');
      setSelectedUser(null);
      setActionType(null);
      setNotes('');
    },
  });

  const columns = [
    {
      header: 'User',
      key: 'email',
      render: (val: string, item: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-white">{item.full_name || 'Anonymous'}</span>
          <span className="text-[12px] text-[#A0A0A0]">{val}</span>
        </div>
      ),
    },
    {
      header: 'Score',
      key: 'fraud_score',
      render: (val: number) => (
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full ${val > 80 ? 'bg-red-500' : val > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${val}%` }}
            />
          </div>
          <span className="font-bold">{val}</span>
        </div>
      ),
    },
    {
      header: 'Reason',
      key: 'flag_reason',
      render: (val: string) => <span className="text-[12px] text-[#A0A0A0] max-w-[200px] block truncate">{val}</span>,
    },
    {
      header: 'Status',
      key: 'status',
      render: (val: string) => <StatusBadge status={val} type="account" />,
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (_: any, item: any) => (
        <div className="flex gap-2">
          {item.status === 'active' ? (
            <button
              onClick={() => { setSelectedUser(item); setActionType('pause'); }}
              className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[12px] rounded-[4px] hover:bg-amber-500/20"
            >
              Pause
            </button>
          ) : (
            <button
              onClick={() => { setSelectedUser(item); setActionType('unpause'); }}
              className="px-3 py-1 bg-green-500/10 text-green-400 text-[12px] rounded-[4px] hover:bg-green-500/20"
            >
              Restore
            </button>
          )}
          <button
            onClick={() => { setSelectedUser(item); setActionType('delete'); }}
            className="px-3 py-1 bg-red-500/10 text-red-500 text-[12px] rounded-[4px] hover:bg-red-500/20"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const handleConfirm = () => {
    if (!selectedUser || !actionType) return;
    actionMutation.mutate({
      userId: selectedUser.id,
      type: actionType,
      body: { reason: notes || `Admin action: ${actionType}` }
    });
  };

  // `request()` already strips the envelope — `analyticsData` IS the analytics payload.
  const analytics = analyticsData as any;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-syne text-[32px] font-bold text-white mb-2">Fraud & Safety</h1>
        <p className="font-dm text-[16px] text-[#A0A0A0]">Monitor high-risk accounts and take enforcement actions.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatItem label="High Risk Users" value={analytics?.high_risk_count || 0} color="text-red-500" />
        <StatItem label="Paused Accounts" value={analytics?.paused_count || 0} color="text-amber-500" />
        <StatItem label="Total Flags (30d)" value={analytics?.total_flags || 0} color="text-white" />
        <StatItem label="Avg Score" value={analytics?.avg_fraud_score?.toFixed(1) || 0} color="text-white" />
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
        <h3 className="font-syne text-[18px] font-bold text-white mb-6">Flagged Accounts</h3>
        <AdminTable
          columns={columns}
          data={(data as any)?.data || []}
          isLoading={isLoading}
        />
      </div>

      <ConfirmModal
        isOpen={!!selectedUser && !!actionType}
        onClose={() => { setSelectedUser(null); setActionType(null); setNotes(''); }}
        onConfirm={handleConfirm}
        title={
          actionType === 'pause' ? 'Pause Account?' :
          actionType === 'unpause' ? 'Restore Account?' :
          'Delete Account Permanentely?'
        }
        description={
          actionType === 'pause' ? 'User will be unable to log in or transact. They will receive an automated email notification.' :
          actionType === 'unpause' ? 'User will regain full access to the platform.' :
          'This action is IRREVERSIBLE. All non-financial user data will be scrubbed. Financial records will be preserved for compliance.'
        }
        dangerous={actionType === 'delete'}
        confirmationText={actionType === 'delete' ? 'DELETE USER' : undefined}
        confirmLabel={
          actionType === 'pause' ? 'Pause Account' :
          actionType === 'unpause' ? 'Restore Account' :
          'Confirm Deletion'
        }
      />
    </div>
  );
};

const StatItem = ({ label, value, color }: any) => (
  <div className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
    <p className="text-[12px] text-[#A0A0A0] uppercase font-bold mb-2">{label}</p>
    <p className={`font-syne text-[28px] font-bold ${color}`}>{value}</p>
  </div>
);

export default FraudManagement;
