
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminComplaintsAPI } from '../../../services/adminApi';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';

const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-complaint', id],
    queryFn: () => adminComplaintsAPI.get(id!),
    enabled: !!id,
  });

  const verifyMutation = useMutation({
    mutationFn: () => adminComplaintsAPI.verifySquad(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaint', id] });
      alert('Squad verification complete.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: any) => adminComplaintsAPI.update(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-complaint', id] });
      setAdminNotes('');
      alert('Complaint updated.');
    },
  });

  // `request()` already strips the envelope — `data` IS the complaint payload.
  const complaint = data as any;

  const handleStatusUpdate = (status: string) => {
    updateMutation.mutate({ status, admin_notes: adminNotes || undefined });
  };

  const handleResolve = () => {
    updateMutation.mutate({ 
      status: 'resolved', 
      admin_notes: adminNotes || 'Issue resolved by admin.' 
    });
  };

  if (isLoading) return <div className="p-8 text-center text-white">Loading complaint...</div>;
  if (!complaint) return <div className="p-8 text-center text-white">Complaint not found.</div>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/complaints')}
          className="w-10 h-10 flex items-center justify-center bg-[#2A2A2A] rounded-full text-white hover:bg-[#333]"
        >
          ←
        </button>
        <div>
          <h1 className="font-syne text-[24px] font-bold text-white">Complaint #{id?.slice(0, 8)}</h1>
          <div className="flex gap-2 mt-1">
            <StatusBadge status={complaint.status} />
            <StatusBadge status={complaint.urgency} type="urgency" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Main Info */}
        <div className="space-y-6">
          <section className="bg-[#141414] border border-white/5 rounded-[16px] p-6 space-y-4">
            <h3 className="font-syne text-[18px] font-bold text-white">Complainant Information</h3>
            <div className="grid grid-cols-2 gap-4 text-[14px]">
              <div>
                <p className="text-[#A0A0A0] mb-1">User ID</p>
                <p className="text-white font-mono">{complaint.complainant_id}</p>
              </div>
              <div>
                <p className="text-[#A0A0A0] mb-1">Category</p>
                <p className="text-white capitalize">{complaint.category.replace('_', ' ')}</p>
              </div>
            </div>
            <div>
              <p className="text-[#A0A0A0] mb-1">Subject</p>
              <p className="text-white font-medium">{complaint.subject}</p>
            </div>
            <div>
              <p className="text-[#A0A0A0] mb-1">Description</p>
              <p className="text-[#F5F5F5] leading-relaxed">{complaint.description}</p>
            </div>
          </section>

          {complaint.transaction_id && (
            <section className="bg-[#141414] border border-white/5 rounded-[16px] p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-syne text-[18px] font-bold text-white">Linked Transaction</h3>
                <button
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  className="text-[12px] bg-[#1A6B4A] text-white px-3 py-1.5 rounded-[6px] hover:brightness-110 disabled:opacity-50"
                >
                  {verifyMutation.isPending ? 'Verifying...' : 'Verify Squad API'}
                </button>
              </div>
              <div className="p-4 bg-white/5 rounded-[12px]">
                <p className="text-[12px] text-[#A0A0A0] mb-1">Transaction ID</p>
                <p className="text-white font-mono mb-4">{complaint.transaction_id}</p>
                
                {complaint.squad_verification && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-[8px]">
                    <div className="flex justify-between mb-2">
                      <span className="text-[12px] text-green-400 font-bold">SQUAD STATUS</span>
                      <span className="text-[12px] text-white uppercase">{complaint.squad_verification.status}</span>
                    </div>
                    <div className="text-[12px] text-[#A0A0A0]">
                      Reference: {complaint.squad_verification.gateway_ref}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <section className="bg-[#141414] border border-white/5 rounded-[16px] p-6 space-y-6">
            <h3 className="font-syne text-[18px] font-bold text-white">Internal Actions</h3>
            
            <div className="space-y-2">
              <label className="text-[13px] text-[#A0A0A0]">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes or response to user..."
                className="w-full bg-[#2A2A2A] border border-white/10 rounded-[12px] p-4 text-[14px] text-white outline-none focus:border-[#F4A11D] min-h-[120px] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStatusUpdate('investigating')}
                disabled={complaint.status === 'investigating' || updateMutation.isPending}
                className="py-2 bg-[#2A2A2A] text-white text-[13px] rounded-[8px] hover:bg-[#333] disabled:opacity-40"
              >
                Investigate
              </button>
              <button
                onClick={() => handleStatusUpdate('escalated')}
                disabled={complaint.status === 'escalated' || updateMutation.isPending}
                className="py-2 bg-red-500/10 text-red-500 border border-red-500/20 text-[13px] rounded-[8px] hover:bg-red-500/20 disabled:opacity-40"
              >
                Escalate
              </button>
            </div>

            <button
              onClick={() => setIsResolveModalOpen(true)}
              disabled={complaint.status === 'resolved' || updateMutation.isPending}
              className="w-full py-4 bg-[#1A6B4A] text-white font-bold rounded-[12px] hover:brightness-110 disabled:opacity-40 transition-all"
            >
              Resolve Complaint
            </button>
          </section>

          {complaint.admin_notes && (
            <section className="bg-[#141414] border border-white/5 rounded-[16px] p-6">
              <h3 className="font-dm text-[12px] text-[#A0A0A0] uppercase font-bold mb-4">Latest Admin Note</h3>
              <p className="text-[14px] text-[#F5F5F5] italic">"{complaint.admin_notes}"</p>
              <p className="text-[11px] text-[#A0A0A0] mt-4">Updated: {new Date(complaint.updated_at).toLocaleString()}</p>
            </section>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        onConfirm={handleResolve}
        title="Resolve Complaint?"
        description="This will notify the user that their complaint has been resolved. Make sure your admin notes explain the resolution clearly."
        confirmLabel="Confirm Resolution"
      />
    </div>
  );
};

export default ComplaintDetail;
