/**
 * PartnersManagement — admin view of every lender/partner account.
 *
 * Newly registered partners land in the DB via /auth/register with role=lender,
 * and appear here the moment they're created (no extra sync step). Admin can
 * approve, revoke, or just see who's pending.
 */
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPartnerAPI } from "@/services/adminApi";
import {
  CheckCircle2,
  Clock,
  Ban,
  Mail,
  Building2,
  UserCircle2,
  ShieldCheck,
} from "lucide-react";

interface PartnerRow {
  id: string;
  email: string;
  company_name: string | null;
  full_name: string | null;
  email_verified: boolean;
  partner_approved: boolean;
  partner_approved_at: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string | null;
  status: "pending" | "approved" | "banned";
}

type Filter = "all" | "pending" | "approved" | "banned";

const StatusPill: React.FC<{ status: PartnerRow["status"] }> = ({ status }) => {
  const map: Record<PartnerRow["status"], { icon: React.ReactNode; label: string; cls: string }> = {
    pending: {
      icon: <Clock size={12} />,
      label: "Pending",
      cls: "bg-[#F4A11D]/10 text-[#F4A11D] border-[#F4A11D]/30",
    },
    approved: {
      icon: <CheckCircle2 size={12} />,
      label: "Approved",
      cls: "bg-[#1A6B4A]/10 text-[#1A6B4A] border-[#1A6B4A]/30",
    },
    banned: {
      icon: <Ban size={12} />,
      label: "Banned",
      cls: "bg-red-500/10 text-red-400 border-red-500/30",
    },
  };
  const entry = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-dm font-semibold tracking-wider uppercase ${entry.cls}`}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
};

const PartnersManagement: React.FC = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const partnersQuery = useQuery({
    queryKey: ["admin", "partners", filter],
    queryFn: () =>
      adminPartnerAPI.listAll(filter === "all" ? undefined : filter) as Promise<PartnerRow[]>,
    refetchInterval: 30000,
  });

  const approve = useMutation({
    mutationFn: (userId: string) => adminPartnerAPI.approve(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partners"] }),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => adminPartnerAPI.revoke(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "partners"] }),
  });

  // request() unwraps the envelope, so partnersQuery.data IS the array.
  const rows = partnersQuery.data ?? [];

  const counts = rows.reduce<Record<Filter, number>>(
    (acc, r) => {
      acc.all += 1;
      acc[r.status] += 1;
      return acc;
    },
    { all: 0, pending: 0, approved: 0, banned: 0 },
  );

  return (
    <div className="text-white max-w-5xl">
      <header className="mb-6">
        <h1 className="font-syne text-[28px] font-bold flex items-center gap-2">
          <ShieldCheck size={26} className="text-[#1A6B4A]" />
          Partners
        </h1>
        <p className="font-dm text-[13px] text-white/60 mt-1">
          Every lender/partner account in the system. New sign-ups show up here automatically.
        </p>
      </header>

      <div className="flex gap-1 p-1 bg-[#161616] border border-white/10 rounded-[10px] w-fit mb-6">
        {(["all", "pending", "approved", "banned"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-[8px] font-dm text-[12px] font-medium transition-colors ${
              filter === key
                ? "bg-[#1A6B4A] text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {key[0].toUpperCase() + key.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {partnersQuery.isLoading && (
        <p className="font-dm text-white/60">Loading partner accounts…</p>
      )}
      {partnersQuery.error && (
        <p className="font-dm text-red-400">Could not load partners.</p>
      )}

      {!partnersQuery.isLoading && rows.length === 0 && (
        <div className="bg-[#161616] border border-white/10 rounded-[16px] p-10 text-center font-dm text-white/60">
          No partners match this filter yet.
        </div>
      )}

      <div className="space-y-4">
        {rows.map((p) => (
          <article
            key={p.id}
            className="bg-[#161616] border border-white/10 rounded-[16px] p-5"
          >
            <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3">
              <div>
                <h3 className="font-syne text-[18px] font-bold flex items-center gap-2">
                  <Building2 size={16} className="text-[#F4A11D]" />
                  {p.company_name || "(Untitled partner)"}
                </h3>
                <p className="font-dm text-[12px] text-white/60 mt-1 flex items-center gap-2">
                  <UserCircle2 size={12} />
                  {p.full_name || "—"}
                </p>
                <p className="font-dm text-[12px] text-white/60 flex items-center gap-2">
                  <Mail size={12} />
                  {p.email}
                  {p.email_verified ? (
                    <CheckCircle2 size={12} className="text-[#1A6B4A]" />
                  ) : (
                    <Clock size={12} className="text-[#F4A11D]" />
                  )}
                </p>
              </div>
              <StatusPill status={p.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-dm text-[12px] text-white/70 mb-4">
              <div>
                <p className="text-white/50 mb-0.5">Registered</p>
                <p className="text-white">
                  {p.created_at ? new Date(p.created_at).toLocaleString("en-GB") : "—"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-0.5">Approved</p>
                <p className="text-white">
                  {p.partner_approved_at
                    ? new Date(p.partner_approved_at).toLocaleString("en-GB")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-white/50 mb-0.5">Ban reason</p>
                <p className="text-white">{p.ban_reason || "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {p.status !== "approved" && !p.is_banned && (
                <button
                  type="button"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(p.id)}
                  className="px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  {approve.isPending && approve.variables === p.id
                    ? "Approving…"
                    : "Approve"}
                </button>
              )}
              {p.status === "approved" && (
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(p.id)}
                  className="px-4 py-2 bg-white/5 text-white font-dm text-[13px] font-medium rounded-[8px] hover:bg-white/10 disabled:opacity-50 flex items-center gap-2 border border-white/10"
                >
                  <Ban size={14} />
                  {revoke.isPending && revoke.variables === p.id
                    ? "Revoking…"
                    : "Revoke approval"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default PartnersManagement;
