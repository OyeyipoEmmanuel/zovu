import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { requestOtp, verifyOtp, saveTokens } from '../../../services/authService';
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

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [apiError, setApiError] = useState('');
  const [savedFormData, setSavedFormData] = useState<PersonalInfoFormData | null>(null);

  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');

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
      businessName: '',
      role: (initialRole === 'Lender' || initialRole === 'Trader' || initialRole === 'Job Seeker' || initialRole === 'Both') 
        ? initialRole as 'Lender' | 'Trader' | 'Job Seeker' | 'Both' 
        : undefined,
    },
  });

  const role = watch('role');

  const onSubmit = async (data: PersonalInfoFormData): Promise<void> => {
    setApiError('');
    try {
      sessionStorage.setItem('zovu_personal', JSON.stringify(data));
      const res = await requestOtp(data.email);
      setSavedFormData(data);
      if (res.otp) {
        setDevOtp(res.otp);
        setOtpCode(res.otp);
      }
      setOtpSent(true);
    } catch (e: unknown) {
      setApiError(
        e instanceof ApiError ? e.message : 'Failed to send OTP. Please try again.',
      );
    }
  };

  const handleOtpVerify = async (): Promise<void> => {
    if (!savedFormData || otpCode.length < 6) return;
    setIsVerifying(true);
    setApiError('');
    try {
      const tokens = await verifyOtp(savedFormData.email, otpCode, savedFormData.password);
      saveTokens(tokens);
      
      // Mock user initialization based on signup data
      useAuthStore.getState().setUser({
        firstName: 'New',
        lastName: 'User',
        email: savedFormData.email,
        role: savedFormData.role,
        businessName: savedFormData.businessName || '',
        profileCompletion: 20,
        kycComplete: false,
        squadVaNumber: null,
        squadVaBank: null,
      });

      navigate('/dashboard');
    } catch (e: unknown) {
      setApiError(
        e instanceof ApiError ? e.message : 'Verification failed. Check your code and try again.',
      );
    } finally {
      setIsVerifying(false);
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

          <button
            type="button"
            onClick={() => { setOtpSent(false); setApiError(''); setOtpCode(''); }}
            className="font-dm text-[13px] text-zovu-primary hover:underline text-center transition-colors duration-200"
          >
            Resend code or change email
          </button>
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
          <span className="font-dm text-[14px] text-zovu-text-light font-medium">Select your role</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['Trader', 'Job Seeker', 'Both', 'Lender'] as const).map((roleOption) => (
              <label
                key={roleOption}
                className={`
                  relative flex flex-col items-center justify-center p-4 border rounded-[8px] cursor-pointer transition-all duration-200
                  ${role === roleOption 
                    ? 'border-zovu-primary bg-zovu-primary/5 text-zovu-primary' 
                    : 'border-zovu-border bg-transparent text-zovu-text-light hover:border-zovu-primary/50'
                  }
                `}
              >
                <input
                  type="radio"
                  value={roleOption}
                  className="sr-only"
                  {...register('role')}
                />
                <span className="font-dm font-medium">{roleOption}</span>
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

        {/* Password */}
        <FormField
          label="Password"
          id="password"
          error={errors.password}
          hint="Minimum 8 characters, with uppercase, lowercase, number, and special character"
        >
          <PasswordInput
            id="password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>

        {/* Business Name (Conditional) */}
        {(role === 'Trader' || role === 'Both' || role === 'Lender') && (
          <FormField label={role === 'Lender' ? 'Organization / Lender Name' : 'Business Name'} id="businessName" error={errors.businessName}>
            <TextInput
              id="businessName"
              placeholder={role === 'Lender' ? 'Enter your organization name' : 'Enter your business name'}
              hasError={!!errors.businessName}
              {...register('businessName')}
            />
          </FormField>
        )}

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

