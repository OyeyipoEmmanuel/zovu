const BASE_URL = '/api/v1';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new ApiError(res.status, data.detail ?? 'Request failed');
  return data as T;
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
