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

const request = async <T>(
  path: string,
  options: RequestInit & { auth?: boolean }
): Promise<T> => {
  const { auth = false, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth) Object.assign(headers, getAuthHeader());

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
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

  post: <T>(path: string, body: unknown, auth = false) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), auth }),

  patch: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), auth }),

  delete: <T>(path: string, auth = true) =>
    request<T>(path, { method: 'DELETE', auth }),
};
