export const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined) || '/api/v1';
const BASE_URL = API_BASE_URL;

export class ApiError extends Error {
  status: number;
  code: string;
  field: string | null;
  constructor(status: number, message: string, code = 'UNKNOWN_ERROR', field: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const TOKEN_KEY = 'zovu_access_token';

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ---------------------------------------------------------------------------
//  Access token refresh
// ---------------------------------------------------------------------------
// Backend issues access tokens with a 15-minute TTL and stores the refresh
// token in an httpOnly cookie. When a request fails with 401, we POST
// /auth/refresh (the cookie rides along automatically with credentials:
// 'include'), persist the new access token, and replay the original request
// once.
//
// We coalesce concurrent refreshes so a burst of 401s on app boot or after a
// long idle only triggers one /auth/refresh round-trip.
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<string | null> | null = null;

const performRefresh = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      // 401 from /auth/refresh means the refresh cookie itself is dead — no
      // recovery possible without a fresh login.
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    const envelope = await res.json().catch(() => null);
    const token: string | undefined =
      envelope?.data?.access_token ?? envelope?.access_token;
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
};

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

const isAuthRoute = (path: string): boolean =>
  path === '/auth/refresh' ||
  path === '/auth/login' ||
  path === '/auth/register' ||
  path === '/auth/verify-otp' ||
  path === '/auth/resend-otp';

// ---------------------------------------------------------------------------
//  Core request
// ---------------------------------------------------------------------------

const doFetch = async (
  path: string,
  options: RequestInit & { auth?: boolean; params?: Record<string, any>; body?: any },
): Promise<Response> => {
  const { auth = true, params, body, ...init } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  let finalBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  } else if (!body) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) Object.assign(headers, getAuthHeader());

  return fetch(url, {
    ...init,
    headers,
    body: finalBody,
    credentials: 'include',
  });
};

export const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean; params?: Record<string, any>; body?: any } = {},
): Promise<T> => {
  let res = await doFetch(path, options);

  // Auto-refresh on 401 once, then retry. Skip for auth endpoints themselves
  // to avoid infinite recursion (a /auth/refresh that 401s means we're done).
  if (res.status === 401 && options.auth !== false && !isAuthRoute(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(path, options);
    }
  }

  const envelope = await res.json().catch(() => ({
    ok: false,
    error: { code: 'PARSE_ERROR', message: res.statusText, field: null },
  }));

  if (envelope.ok === false) {
    const err = envelope.error ?? {};
    throw new ApiError(
      res.status,
      err.message ?? 'Request failed',
      err.code ?? 'UNKNOWN_ERROR',
      err.field ?? null,
    );
  }

  return envelope.data as T;
};

export const api = {
  get: <T>(path: string, auth = true) =>
    request<T>(path, { method: 'GET', auth }),

  post: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),

  patch: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body, auth }),

  delete: <T>(path: string, auth = true) =>
    request<T>(path, { method: 'DELETE', auth }),
};

// Exposed so the lib/api.ts rawV1 path can share the same refresh singleton
// instead of double-firing /auth/refresh.
export { refreshAccessToken };
