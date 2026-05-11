import { api } from './api';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface KycPayload {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  bvn?: string;
  nin?: string;
}

/** Normalize Nigerian phone numbers to +234xxxxxxxxxx format */
const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+234${cleaned.slice(1)}`;
  return cleaned;
};

export const saveTokens = (tokens: TokenResponse): void => {
  localStorage.setItem('zovu_access_token', tokens.access_token);
  localStorage.setItem('zovu_refresh_token', tokens.refresh_token);
};

export const clearTokens = (): void => {
  localStorage.removeItem('zovu_access_token');
  localStorage.removeItem('zovu_refresh_token');
};

export const getAccessToken = (): string | null =>
  localStorage.getItem('zovu_access_token');

export const requestOtp = (email: string) =>
  api.post<{ message: string; email: string; otp?: string | null }>('/auth/request-otp', { email });

export const verifyOtp = (email: string, code: string, password: string) =>
  api.post<TokenResponse>('/auth/verify-otp', { email, code, password });

export const login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password });

export const submitKyc = (payload: KycPayload) =>
  api.post<{ status: string; message: string }>(
    '/auth/kyc',
    { ...payload, phone: normalizePhone(payload.phone) },
    true,
  );

export const getProfile = () =>
  api.get<{ id: string; email: string; first_name: string; last_name: string; kyc_verified: boolean; pulse_score: number }>('/auth/me', true);

export const logout = (refresh_token: string) =>
  api.post<{ message: string }>('/auth/logout', { refresh_token }, true);
