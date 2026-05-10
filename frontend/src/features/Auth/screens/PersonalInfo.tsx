import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
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

export const PersonalInfo: React.FC = () => {
  const navigate = useNavigate();

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
    await new Promise((resolve) => setTimeout(resolve, 1500));
    sessionStorage.setItem('zovu_personal', JSON.stringify(data));
    navigate('/signup/role-info');
  };

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
