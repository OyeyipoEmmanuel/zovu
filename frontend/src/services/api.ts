const BASE_URL = '/api/v1';

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

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('zovu_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean; params?: Record<string, any>; body?: any } = {}
): Promise<T> => {
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
  } else if (body) {
    // If body is already a string or FormData, don't re-stringify
  } else {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) Object.assign(headers, getAuthHeader());

  const res = await fetch(url, {
    ...init,
    headers,
    body: finalBody,
    credentials: 'include',
  });

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
