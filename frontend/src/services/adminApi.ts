/**
 * Admin API client service
 * All admin endpoints using TanStack Query compatible request format
 */
import { request } from "./api";

// ── COMPLAINTS ────────────────────────────────────
export const adminComplaintsAPI = {
  list: (params: {
    status?: string;
    urgency?: string;
    category?: string;
    limit?: number;
    cursor?: string;
  }) => request("/admin/complaints", { params }),

  get: (id: string) => request(`/admin/complaints/${id}`),

  verifySquad: (id: string) =>
    request(`/admin/complaints/${id}/verify-squad`, { method: "POST" }),

  update: (id: string, body: any) =>
    request(`/admin/complaints/${id}`, { method: "PATCH", body }),

  getStats: () => request("/admin/complaints/stats"),
};

// ── FRAUD ──────────────────────────────────────────
export const adminFraudAPI = {
  getFlaggedUsers: (params: {
    reason?: string;
    min_score?: number;
    status?: string;
    limit?: number;
    cursor?: string;
  }) => request("/admin/users/flagged", { params }),

  flagUser: (userId: string, body: any) =>
    request(`/admin/users/${userId}/flag`, { method: "POST", body }),

  pauseUser: (userId: string, body: any) =>
    request(`/admin/users/${userId}/pause`, { method: "POST", body }),

  unpauseUser: (userId: string) =>
    request(`/admin/users/${userId}/unpause`, { method: "POST" }),

  deleteUser: (userId: string, body: any) =>
    request(`/admin/users/${userId}`, { method: "DELETE", body }),

  getAnalytics: (days?: number) =>
    request(`/admin/fraud/analytics?days=${days || 30}`),
};

// ── METRICS ────────────────────────────────────────
export const adminMetricsAPI = {
  getOverview: () => request("/admin/metrics/overview"),

  getUsers: (days?: number) =>
    request(`/admin/metrics/users?period_days=${days || 30}`),

  getTransactions: (days?: number) =>
    request(`/admin/metrics/transactions?period_days=${days || 30}`),

  getBusinesses: () => request("/admin/metrics/businesses"),

  getDailyReport: (date: string) =>
    request(`/admin/reports/daily?date=${date}`),
};

// ── PARTNERSHIPS ───────────────────────────────────
export const adminPartnershipsAPI = {
  listRequests: (params?: any) =>
    request("/admin/partnerships/requests", { params }),

  getRequest: (id: string) => request(`/admin/partnerships/requests/${id}`),

  updateRequest: (id: string, body: any) =>
    request(`/admin/partnerships/requests/${id}`, { method: "PATCH", body }),

  approveRequest: (id: string) =>
    request(`/admin/partnerships/requests/${id}/approve`, { method: "POST" }),

  rejectRequest: (id: string, body: any) =>
    request(`/admin/partnerships/requests/${id}/reject`, {
      method: "POST",
      body,
    }),

  listActive: (params?: any) => request("/admin/partnerships", { params }),

  updatePartnership: (id: string, body: any) =>
    request(`/admin/partnerships/${id}`, { method: "PUT", body }),
};

// ── PARTNER APPROVAL (lender accounts) ─────────────
export const adminPartnerAPI = {
  listPending: () => request("/admin/partners/pending"),

  /** Newer endpoint — returns every lender account in the system,
   *  filterable by status (pending | approved | banned). */
  listAll: (status?: "pending" | "approved" | "banned") =>
    request("/admin/partners", {
      params: status ? { status } : undefined,
    }),

  approve: (userId: string) =>
    request(`/admin/partners/${userId}/approve`, { method: "POST" }),

  revoke: (userId: string) =>
    request(`/admin/partners/${userId}/revoke`, { method: "POST" }),
};

// ── ADMIN AJO ──────────────────────────────────────
export const adminAjoAPI = {
  listGroups: () => request("/admin/ajo/groups"),

  createGroup: (body: {
    name: string;
    description?: string;
    minimum_deposit: number;      // kobo
    end_date: string;             // ISO string
    max_members?: number;
  }) => request("/admin/ajo/groups", { method: "POST", body: body as any }),

  listTransactions: (params?: { limit?: number; ajo_id?: string }) =>
    request("/admin/ajo/transactions", { params }),
};

// ── FRAUD FIELD AUDIT ──────────────────────────────
export const adminFraudFieldsAPI = {
  getForUser: (userId: string) =>
    request(`/admin/fraud/users/${userId}/fields`),
};

// ── AUDIT ──────────────────────────────────────────
export const adminAuditAPI = {
  getLog: (params: {
    admin_id?: string;
    action?: string;
    target_type?: string;
    limit?: number;
    cursor?: string;
  }) => request("/admin/audit-log", { params }),
};

// ── PUBLIC (no auth) ───────────────────────────────
export const publicAPI = {
  applyPartnership: (body: any) =>
    request("/partnerships/apply", { method: "POST", body }),

  getPublicPartners: () => request("/partnerships/public"),
};
