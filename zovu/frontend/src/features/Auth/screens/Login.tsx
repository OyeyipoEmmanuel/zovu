import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  AuthLayout,
  FormField,
  TextInput,
  PasswordInput,
  SubmitButton,
} from '../components';
import { loginSchema, type LoginFormData } from '../schemas';
import { login, saveTokens } from '../../../services/authService';
import { ApiError } from '../../../services/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    setApiError('');
    try {
      const tokens = await login(data.email, data.password);
      saveTokens(tokens);
      navigate('/dashboard');
    } catch (e: unknown) {
      setApiError(
        e instanceof ApiError
          ? e.message
          : 'Login failed. Please check your credentials.',
      );
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to your Zovu account to continue building your financial identity."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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

        <FormField label="Password" id="password" error={errors.password}>
          <PasswordInput
            id="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            hasError={!!errors.password}
            {...register('password')}
          />
        </FormField>

        {/* Forgot Password */}
        <div className="flex justify-end -mt-1">
          <button
            type="button"
            className="font-dm text-[13px] text-zovu-primary hover:underline transition-colors duration-200"
          >
            Forgot password?
          </button>
        </div>

        {apiError && (
          <p className="font-dm text-[13px] text-red-400 text-center -mb-1" role="alert">
            {apiError}
          </p>
        )}

        <SubmitButton loading={isSubmitting}>Log In</SubmitButton>

        {/* Divider */}
        <div className="flex items-center gap-4 my-1">
          <div className="flex-1 border-t border-zovu-border" />
          <span className="font-dm text-[12px] text-zovu-text uppercase tracking-wider">or</span>
          <div className="flex-1 border-t border-zovu-border" />
        </div>

        {/* Google Sign-In Placeholder */}
        <button
          type="button"
          className="
            w-full bg-transparent border border-zovu-border text-zovu-text-light rounded-[8px]
            font-dm font-medium text-[14px] px-6 py-3
            inline-flex items-center justify-center gap-3
            transition-all duration-200
            hover:border-zovu-primary hover:bg-zovu-surface-2
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center font-dm text-[13px] text-zovu-text mt-1">
          Don't have an account?{' '}
          <a
            href="/signup/identity-verification"
            className="text-zovu-primary hover:underline font-medium transition-colors duration-200"
            onClick={(e) => { e.preventDefault(); navigate('/signup/identity-verification'); }}
          >
            Sign up
          </a>
        </p>
      </form>
    </AuthLayout>
  );
};
