import { api } from './api';

export type UserRole = 'trader' | 'job_seeker' | 'partner';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  display_name: string;
  email_verified: boolean;
  profile_complete: boolean;
  squad_account_number: string | null;
  squad_account_bank: string | null;
  squad_provisioned: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface RegisterPayload {
  role: UserRole;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
  business_name?: string;
  full_name?: string;
  company_name?: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
  otp?: string;
}

export interface KycPayload {
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  phone: string;
  bvn?: string;
  nin?: string;
  gender?: '1' | '2';
  address?: string;
}

/** Normalize Nigerian phone numbers to +234xxxxxxxxxx format */
const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+234${cleaned.slice(1)}`;
  return cleaned;
};

export const saveAccessToken = (token: string): void => {
  localStorage.setItem('zovu_access_token', token);
};

export const getAccessToken = (): string | null =>
  localStorage.getItem('zovu_access_token');

export const clearAccessToken = (): void => {
  localStorage.removeItem('zovu_access_token');
};

// Backend uses "lender"; frontend uses "partner". Translate at the API boundary.
const toBackendRole = (r: UserRole): string => (r === 'partner' ? 'lender' : r);
const fromBackendRole = (r: string | null | undefined): UserRole =>
  (r === 'lender' ? 'partner' : (r as UserRole));

const normalizeAuthUser = (u: AuthUser): AuthUser => ({
  ...u,
  role: fromBackendRole(u.role as unknown as string),
});

const normalizeAuthResponse = (res: AuthResponse): AuthResponse => ({
  ...res,
  user: normalizeAuthUser(res.user),
});

export const register = (payload: RegisterPayload) =>
  api.post<RegisterResponse>(
    '/auth/register',
    {
      ...payload,
      role: toBackendRole(payload.role),
      phone: payload.phone ? normalizePhone(payload.phone) : undefined,
    },
    false,
  );

export const verifyOtp = (email: string, otp: string) =>
  api
    .post<AuthResponse>('/auth/verify-otp', { email, otp }, false)
    .then(normalizeAuthResponse);

export const resendOtp = (email: string) =>
  api.post<{ message: string }>('/auth/resend-otp', { email }, false);

export const login = (email: string, password: string) =>
  api
    .post<AuthResponse>('/auth/login', { email, password }, false)
    .then(normalizeAuthResponse);

export const refreshToken = () =>
  api.post<AuthResponse>('/auth/refresh', {}).then(normalizeAuthResponse);

export const logout = () =>
  api.post<{ message: string }>('/auth/logout', {}, true);

export const getMe = () =>
  api.get<AuthUser>('/auth/me', true).then(normalizeAuthUser);

export interface KycResponse {
  status: string;
  message: string;
  kyc_verified: boolean;
  profile_complete: boolean;
  squad_provisioned: boolean;
  account_number: string | null;
  bank: string | null;
}

export const submitKyc = (payload: KycPayload) =>
  api.post<KycResponse>(
    '/auth/kyc',
    { ...payload, phone: normalizePhone(payload.phone) },
    true,
  );

export interface SquadRetryResponse {
  squad_provisioned: boolean;
  account_number: string | null;
  bank: string | null;
  already_provisioned: boolean;
}

export const retrySquadProvisioning = () =>
  api.post<SquadRetryResponse>('/auth/squad/retry', {}, true);
