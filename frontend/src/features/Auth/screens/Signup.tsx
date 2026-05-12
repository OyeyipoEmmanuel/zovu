import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { register as registerUser, verifyOtp, resendOtp, saveAccessToken, type UserRole } from '../../../services/authService';
import { useAuthStore } from '../../../stores/authStore';
import { ApiError } from '../../../services/api';
import {
  AuthLayout,
  FormField,
  TextInput,
  PasswordInput,
  SubmitButton,
} from '../components';
import {
  personalInfoSchema,
  type PersonalInfoFormData,
} from '../schemas';

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'trader', label: 'Trader', desc: 'I sell goods or run a business' },
  { value: 'job_seeker', label: 'Job Seeker', desc: 'I am looking for work or gigs' },
  { value: 'lender', label: 'Lender', desc: 'I want to fund micro-loans' },
];

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRole = searchParams.get('role')?.toLowerCase().replace(' ', '_');
  const initialRole = (['trader', 'job_seeker', 'lender'] as UserRole[]).includes(rawRole as UserRole)
    ? (rawRole as UserRole)
    : undefined;

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [apiError, setApiError] = useState('');
  const [savedFormData, setSavedFormData] = useState<PersonalInfoFormData | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: initialRole,
      business_name: '',
      full_name: '',
      company_name: '',
    },
  });

  const role = watch('role');

  const onSubmit = async (data: PersonalInfoFormData): Promise<void> => {
    setApiError('');
    try {
      const payload = {
        role: data.role,
        email: data.email,
        password: data.password,
        confirm_password: data.confirmPassword,
        ...(data.role === 'trader' && { business_name: data.business_name }),
        ...(data.role === 'job_seeker' && { full_name: data.full_name }),
        ...(data.role === 'lender' && { company_name: data.company_name }),
      };
      const res = await registerUser(payload);
      setSavedFormData(data);
      if (res.otp) {
        setDevOtp(res.otp);
        setOtpCode(res.otp);
      }
      setOtpSent(true);
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setApiError(e.code === 'EMAIL_ALREADY_EXISTS'
          ? 'An account with this email already exists.'
          : e.message);
      } else {
        setApiError('Failed to create account. Please try again.');
      }
    }
  };

  const handleOtpVerify = async (): Promise<void> => {
    if (!savedFormData || otpCode.length < 6) return;
    setIsVerifying(true);
    setApiError('');
    try {
      const res = await verifyOtp(savedFormData.email, otpCode);
      saveAccessToken(res.access_token);
      useAuthStore.getState().setToken(res.access_token);
      useAuthStore.getState().setUser({
        id: res.user.id,
        email: res.user.email,
        role: res.user.role,
        display_name: res.user.display_name,
        email_verified: res.user.email_verified,
        profile_complete: res.user.profile_complete,
        squad_account_number: res.user.squad_account_number,
        squad_account_bank: res.user.squad_account_bank,
        squad_provisioned: res.user.squad_provisioned,
      });
      navigate('/dashboard');
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        if (e.code === 'TOO_MANY_ATTEMPTS') {
          setApiError('Too many attempts. Please request a new code.');
        } else if (e.code === 'OTP_EXPIRED') {
          setApiError('Code has expired. Please request a new one.');
        } else if (e.code === 'INVALID_OTP') {
          setApiError('Incorrect code. Please try again.');
        } else {
          setApiError(e.message);
        }
      } else {
        setApiError('Verification failed. Check your code and try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!savedFormData) return;
    setIsResending(true);
    setApiError('');
    try {
      await resendOtp(savedFormData.email);
      setOtpCode('');
      setDevOtp(null);
    } catch (e: unknown) {
      setApiError(e instanceof ApiError ? e.message : 'Could not resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (otpSent) {
    return (
      <AuthLayout
        title="Verify Your Email"
        subtitle={`A 6-digit code was sent to ${savedFormData?.email ?? 'your email'}. Enter it below to continue.`}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); void handleOtpVerify(); }}
          className="flex flex-col gap-5"
          noValidate
        >
          {devOtp && (
            <div className="flex items-center gap-3 bg-zovu-amber/10 border border-zovu-amber/40 rounded-[8px] px-4 py-3">
              <span className="text-zovu-amber text-[11px] font-dm font-semibold uppercase tracking-wider shrink-0">Dev</span>
              <p className="font-dm text-[13px] text-zovu-text-light">
                No email service configured — your code is{' '}
                <span className="font-mono font-bold text-zovu-amber tracking-[0.2em]">{devOtp}</span>
                {' '}(pre-filled below)
              </p>
            </div>
          )}

          <FormField label="One-Time Code" id="otpCode">
            <input
              id="otpCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200 placeholder:text-zovu-text/50 tracking-[0.3em] text-center"
            />
          </FormField>

          {apiError && (
            <p className="font-dm text-[13px] text-red-400 text-center" role="alert">
              {apiError}
            </p>
          )}

          <SubmitButton loading={isVerifying} className="mt-2">
            Verify &amp; Continue
          </SubmitButton>

          <div className="flex items-center justify-center gap-4 text-[13px] font-dm">
            <button
              type="button"
              disabled={isResending}
              onClick={() => { void handleResend(); }}
              className="text-zovu-primary hover:underline transition-colors duration-200 disabled:opacity-50"
            >
              {isResending ? 'Sending…' : 'Resend code'}
            </button>
            <span className="text-zovu-text">·</span>
            <button
              type="button"
              onClick={() => { setOtpSent(false); setApiError(''); setOtpCode(''); setDevOtp(null); }}
              className="text-zovu-text-light hover:underline transition-colors duration-200"
            >
              Change email
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Start building your financial identity with Zovu. Let's begin with your account details."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* Role Selection */}
        <div className="flex flex-col gap-2">
          <span className="font-dm text-[14px] text-zovu-text-light font-medium">I am a…</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map(({ value, label, desc }) => (
              <label
                key={value}
                className={`
                  relative flex flex-col p-4 border rounded-[8px] cursor-pointer transition-all duration-200
                  ${role === value
                    ? 'border-zovu-primary bg-zovu-primary/5 text-zovu-primary'
                    : 'border-zovu-border bg-transparent text-zovu-text-light hover:border-zovu-primary/50'
                  }
                `}
              >
                <input
                  type="radio"
                  value={value}
                  className="sr-only"
                  {...register('role')}
                />
                <span className="font-dm font-semibold text-[14px]">{label}</span>
                <span className={`font-dm text-[12px] mt-0.5 ${role === value ? 'text-zovu-primary/80' : 'text-zovu-text'}`}>
                  {desc}
                </span>
              </label>
            ))}
          </div>
          {errors.role && (
            <p className="font-dm text-[12px] text-red-500 mt-1">{errors.role.message}</p>
          )}
        </div>

        {/* Email */}
        <FormField label="Email Address" id="email" error={errors.email}>
          <TextInput
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            hasError={!!errors.email}
            {...register('email')}
          />
        </FormField>

        {/* Role-specific name field */}
        {role === 'trader' && (
          <FormField label="Business Name" id="business_name" error={errors.business_name}>
            <TextInput
              id="business_name"
              placeholder="e.g. Mama Tunde Provisions"
              hasError={!!errors.business_name}
              {...register('business_name')}
            />
          </FormField>
        )}
        {role === 'job_seeker' && (
          <FormField label="Full Name" id="full_name" error={errors.full_name}>
            <TextInput
              id="full_name"
              placeholder="e.g. Amara Okafor"
              hasError={!!errors.full_name}
              {...register('full_name')}
            />
          </FormField>
        )}
        {role === 'lender' && (
          <FormField label="Company / Organization Name" id="company_name" error={errors.company_name}>
            <TextInput
              id="company_name"
              placeholder="e.g. Eko Microfinance Ltd"
              hasError={!!errors.company_name}
              {...register('company_name')}
            />
          </FormField>
        )}

        {/* Password */}
        <FormField
          label="Password"
          id="password"
          error={errors.password}
          hint="Min. 8 characters — uppercase, lowercase, number, and special character"
        >
          <PasswordInput
            id="password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>

        {/* Confirm Password */}
        <FormField label="Confirm Password" id="confirmPassword" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            hasError={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </FormField>

        {apiError && (
          <p className="font-dm text-[13px] text-red-400 text-center -mb-1" role="alert">
            {apiError}
          </p>
        )}

        <SubmitButton loading={isSubmitting} className="mt-2">
          Continue
        </SubmitButton>

        <p className="text-center font-dm text-[13px] text-zovu-text">
          Already have an account?{' '}
          <a
            href="/login"
            className="text-zovu-primary hover:underline font-medium transition-colors duration-200"
            onClick={(e) => { e.preventDefault(); navigate('/login'); }}
          >
            Log in
          </a>
        </p>
      </form>
    </AuthLayout>
  );
};

