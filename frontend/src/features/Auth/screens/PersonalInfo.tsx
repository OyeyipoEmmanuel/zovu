import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { requestOtp, verifyOtp, saveTokens } from '../../../services/authService';
import { ApiError } from '../../../services/api';
import {
  AuthLayout,
  FormField,
  TextInput,
  PasswordInput,
  SelectInput,
  SubmitButton,
} from '../components';
import {
  personalInfoSchema,
  type PersonalInfoFormData,
  GENDER_OPTIONS,
} from '../schemas';

const today = new Date();
const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  .toISOString().split('T')[0];
const minDob = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate())
  .toISOString().split('T')[0];

export const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [apiError, setApiError] = useState('');
  const [savedFormData, setSavedFormData] = useState<PersonalInfoFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      middleName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      dateOfBirth: '',
      gender: '',
    },
  });

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
      navigate('/signup/role-info');
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
        step={{ current: 1, total: 5, label: 'Personal Information' }}
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
      subtitle="Start building your financial identity with Zovu. Let's begin with your personal details."
      step={{ current: 1, total: 5, label: 'Personal Information' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="First Name" id="firstName" error={errors.firstName}>
            <TextInput
              id="firstName"
              placeholder="Adaeze"
              autoComplete="given-name"
              hasError={!!errors.firstName}
              {...register('firstName')}
            />
          </FormField>

          <FormField label="Last Name" id="lastName" error={errors.lastName}>
            <TextInput
              id="lastName"
              placeholder="Okafor"
              autoComplete="family-name"
              hasError={!!errors.lastName}
              {...register('lastName')}
            />
          </FormField>
          <FormField label="Middle Name" id="middleName" error={errors.middleName}>
            <TextInput
              id="middleName"
              placeholder="Ngozi"
              autoComplete="family-name"
              hasError={!!errors.middleName}
              {...register('middleName')}
            />
          </FormField>
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

        {/* Phone */}
        <FormField
          label="Phone Number"
          id="phoneNumber"
          error={errors.phoneNumber}
          hint="Nigerian number: 08012345678 or +2348012345678"
        >
          <TextInput
            id="phoneNumber"
            type="tel"
            placeholder="+234 801 234 5678"
            autoComplete="tel"
            hasError={!!errors.phoneNumber}
            {...register('phoneNumber')}
          />
        </FormField>

        {/* DOB & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Date of Birth" id="dateOfBirth" error={errors.dateOfBirth}>
            <TextInput
              id="dateOfBirth"
              type="date"
              max={maxDob}
              min={minDob}
              hasError={!!errors.dateOfBirth}
              {...register('dateOfBirth')}
            />
          </FormField>

          <FormField label="Gender" id="gender" error={errors.gender}>
            <SelectInput
              id="gender"
              placeholder="Select gender"
              options={[...GENDER_OPTIONS]}
              hasError={!!errors.gender}
              {...register('gender')}
            />
          </FormField>
        </div>

        {/* Divider */}
        <div className="border-t border-zovu-border my-1" />

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
          Continue to Role Selection
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
