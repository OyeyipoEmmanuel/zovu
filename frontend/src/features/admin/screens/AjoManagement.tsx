import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAjoAPI } from "@/services/adminApi";

interface AjoRow {
  id: string;
  name: string;
  description: string | null;
  minimum_deposit: number; // kobo
  end_date: string | null;
  total_balance: number;
  member_count: number;
  max_members: number;
  status: string;
  merchant_squad_account: string | null;
  created_at: string;
}

const formatNaira = (kobo: number) =>
  `₦${Math.round((kobo || 0) / 100).toLocaleString("en-NG")}`;

const AjoManagement: React.FC = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["admin", "ajo", "groups"],
    queryFn: () =>
      adminAjoAPI.listGroups() as Promise<{ ok: boolean; data: AjoRow[] }>,
  });

  const create = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      minimum_deposit: number; // kobo
      end_date: string;
      max_members?: number;
    }) => adminAjoAPI.createGroup(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "ajo", "groups"] });
      setCreateOpen(false);
    },
  });

  const rows = groupsQuery.data?.data || [];

  return (
    <div className="text-white max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-syne text-[28px] font-bold">Ajo Management</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110"
        >
          + Create Ajo group
        </button>
      </div>

      {groupsQuery.isLoading && (
        <p className="font-dm text-white/60">Loading Ajo groups…</p>
      )}
      {groupsQuery.error && (
        <p className="font-dm text-red-400">Could not load Ajo groups.</p>
      )}

      {!groupsQuery.isLoading && rows.length === 0 && (
        <div className="bg-[#161616] border border-white/10 rounded-[16px] p-10 text-center font-dm text-white/60">
          No Ajo groups yet. Click &quot;Create Ajo group&quot; to publish the first one.
        </div>
      )}

      <div className="space-y-4">
        {rows.map((g) => (
          <article
            key={g.id}
            className="bg-[#161616] border border-white/10 rounded-[16px] p-5"
          >
            <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
              <div>
                <h3 className="font-syne text-[18px] font-bold">{g.name}</h3>
                {g.description && (
                  <p className="font-dm text-[13px] text-white/60 mt-1">
                    {g.description}
                  </p>
                )}
              </div>
              <span className="px-2.5 py-0.5 rounded-full border text-[10px] font-dm font-semibold tracking-wider uppercase border-[#1A6B4A]/40 text-[#1A6B4A] bg-[#1A6B4A]/10 self-start">
                {g.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-dm text-[13px] mb-3">
              <Stat label="Min deposit" value={formatNaira(g.minimum_deposit)} />
              <Stat label="Pool" value={formatNaira(g.total_balance)} />
              <Stat
                label="Members"
                value={`${g.member_count}/${g.max_members}`}
              />
              <Stat
                label="Ends"
                value={
                  g.end_date
                    ? new Date(g.end_date).toLocaleDateString("en-GB")
                    : "—"
                }
              />
            </div>
            <p className="font-dm text-[12px] text-white/70">
              Static VA:{" "}
              <span className="font-mono text-white">
                {g.merchant_squad_account || "—"}
              </span>
            </p>
          </article>
        ))}
      </div>

      {createOpen && (
        <CreateAjoModal
          submitting={create.isPending}
          error={(create.error as Error | null)?.message || null}
          onClose={() => setCreateOpen(false)}
          onSubmit={(payload) => create.mutate(payload)}
        />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-white/50 mb-0.5">{label}</p>
    <p className="text-white font-medium">{value}</p>
  </div>
);

const CreateAjoModal: React.FC<{
  onClose: () => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: {
    name: string;
    description?: string;
    minimum_deposit: number; // kobo
    end_date: string;
    max_members?: number;
  }) => void;
}> = ({ onClose, submitting, error, onSubmit }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minDeposit, setMinDeposit] = useState("5000");
  const [endDate, setEndDate] = useState("");
  const [maxMembers, setMaxMembers] = useState("50");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endDate || !minDeposit) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      minimum_deposit: Math.round(Number(minDeposit) * 100),
      end_date: new Date(endDate).toISOString(),
      max_members: Number(maxMembers) || 50,
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-[#161616] border border-white/10 rounded-[16px] p-6 max-w-md w-full"
      >
        <h2 className="font-syne text-[20px] font-bold text-white mb-4">
          Create Ajo group
        </h2>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Market Women Co-Op"
            className="w-full bg-transparent border border-white/10 rounded-[8px] font-dm text-[14px] text-white px-4 py-2 outline-none focus:border-[#1A6B4A]"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description shown to members"
            className="w-full bg-transparent border border-white/10 rounded-[8px] font-dm text-[14px] text-white px-4 py-2 outline-none focus:border-[#1A6B4A] resize-none"
          />
        </Field>
        <Field label="Minimum deposit (₦)">
          <input
            type="number"
            min={1}
            value={minDeposit}
            onChange={(e) => setMinDeposit(e.target.value)}
            placeholder="5000"
            aria-label="Minimum deposit in naira"
            className="w-full bg-transparent border border-white/10 rounded-[8px] font-dm text-[14px] text-white px-4 py-2 outline-none focus:border-[#1A6B4A]"
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            placeholder="YYYY-MM-DD"
            className="w-full bg-transparent border border-white/10 rounded-[8px] font-dm text-[14px] text-white px-4 py-2 outline-none focus:border-[#1A6B4A]"
          />
        </Field>
        <Field label="Max members">
          <input
            type="number"
            min={2}
            max={500}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            aria-label="Max members"
            placeholder="50"
            className="w-full bg-transparent border border-white/10 rounded-[8px] font-dm text-[14px] text-white px-4 py-2 outline-none focus:border-[#1A6B4A]"
          />
        </Field>

        {error && (
          <p className="font-dm text-[12px] text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 text-white font-dm text-[13px] rounded-[8px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Publish Ajo"}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label className="flex flex-col gap-1 mb-3">
    <span className="font-dm text-[12px] text-white/70 font-medium">{label}</span>
    {children}
  </label>
);

export default AjoManagement;
