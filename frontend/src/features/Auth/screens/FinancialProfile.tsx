import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  AuthLayout,
  FormField,
  TextInput,
  SelectInput,
  SubmitButton,
} from '../components';
import {
  financialProfileSchema,
  type FinancialProfileFormData,
  EMPLOYMENT_STATUS_OPTIONS,
  INCOME_RANGE_OPTIONS,
  FINANCIAL_GOAL_OPTIONS,
  LOAN_STATUS_OPTIONS,
  NIGERIAN_BANKS,
} from '../schemas';

export const FinancialProfile: React.FC = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FinancialProfileFormData>({
    resolver: zodResolver(financialProfileSchema),
    defaultValues: {
      employmentStatus: '',
      occupation: '',
      monthlyIncome: '',
      bankName: '',
      accountNumber: '',
      financialGoal: '',
      hasExistingLoans: '',
      agreedToTerms: false as unknown as true,
    },
  });

  const onSubmit = async (data: FinancialProfileFormData): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Combine all step data and submit (in production, send to backend)
    const personalData = sessionStorage.getItem('zovu_personal');
    const roleData = sessionStorage.getItem('zovu_role');
    const identityData = sessionStorage.getItem('zovu_identity');
    const combinedData = {
      personal: personalData ? JSON.parse(personalData) : null,
      role: roleData ? JSON.parse(roleData) : null,
      identity: identityData ? JSON.parse(identityData) : null,
      financial: data,
    };

    // Simulate storing the registration
    sessionStorage.setItem('zovu_registration', JSON.stringify(combinedData));
    sessionStorage.removeItem('zovu_personal');
    sessionStorage.removeItem('zovu_role');
    sessionStorage.removeItem('zovu_identity');

    navigate('/signup/success');
  };

  return (
    <AuthLayout
      title="Financial Profile"
      subtitle="Help us understand your financial background so we can tailor services to your needs."
      step={{ current: 4, total: 5, label: 'Financial Profile' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* Employment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Employment Status" id="employmentStatus" error={errors.employmentStatus}>
            <SelectInput
              id="employmentStatus"
              placeholder="Select status"
              options={[...EMPLOYMENT_STATUS_OPTIONS]}
              hasError={!!errors.employmentStatus}
              {...register('employmentStatus')}
            />
          </FormField>

          <FormField label="Occupation" id="occupation" error={errors.occupation}>
            <TextInput
              id="occupation"
              placeholder="e.g. Market Trader, Software Developer"
              hasError={!!errors.occupation}
              {...register('occupation')}
            />
          </FormField>
        </div>

        {/* Income */}
        <FormField label="Monthly Income Range" id="monthlyIncome" error={errors.monthlyIncome}>
          <SelectInput
            id="monthlyIncome"
            placeholder="Select income range"
            options={[...INCOME_RANGE_OPTIONS]}
            hasError={!!errors.monthlyIncome}
            {...register('monthlyIncome')}
          />
        </FormField>

        {/* Divider */}
        <div className="border-t border-zovu-border my-1" />

        {/* Bank Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Bank Name" id="bankName" error={errors.bankName}>
            <SelectInput
              id="bankName"
              placeholder="Select your bank"
              options={NIGERIAN_BANKS}
              hasError={!!errors.bankName}
              {...register('bankName')}
            />
          </FormField>

          <FormField
            label="Account Number"
            id="accountNumber"
            error={errors.accountNumber}
            hint="10-digit NUBAN account number"
          >
            <TextInput
              id="accountNumber"
              placeholder="0123456789"
              maxLength={10}
              inputMode="numeric"
              hasError={!!errors.accountNumber}
              {...register('accountNumber')}
            />
          </FormField>
        </div>

        {/* Financial Goal */}
        <FormField label="Primary Financial Goal" id="financialGoal" error={errors.financialGoal}>
          <SelectInput
            id="financialGoal"
            placeholder="What do you want to achieve?"
            options={[...FINANCIAL_GOAL_OPTIONS]}
            hasError={!!errors.financialGoal}
            {...register('financialGoal')}
          />
        </FormField>

        {/* Existing Loans */}
        <FormField label="Do you have existing loans?" id="hasExistingLoans" error={errors.hasExistingLoans}>
          <SelectInput
            id="hasExistingLoans"
            placeholder="Select loan status"
            options={[...LOAN_STATUS_OPTIONS]}
            hasError={!!errors.hasExistingLoans}
            {...register('hasExistingLoans')}
          />
        </FormField>

        {/* Divider */}
        <div className="border-t border-zovu-border my-1" />

        {/* Terms */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="agreedToTerms"
            className="mt-1 h-4 w-4 accent-zovu-primary rounded border-zovu-border bg-zovu-bg cursor-pointer"
            {...register('agreedToTerms')}
          />
          <label
            htmlFor="agreedToTerms"
            className="font-dm text-[13px] text-zovu-text leading-[1.5] cursor-pointer select-none"
          >
            I agree to Zovu's{' '}
            <span className="text-zovu-primary hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="text-zovu-primary hover:underline">Privacy Policy</span>.
            I consent to the collection and use of my financial data as described.
          </label>
        </div>
        {errors.agreedToTerms && (
          <span className="font-dm text-[12px] text-red-400 leading-[1.2] -mt-3" role="alert">
            {errors.agreedToTerms.message}
          </span>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/signup/identity-verification')}
            className="
              flex-1 bg-transparent border border-zovu-border text-zovu-text-light rounded-[8px]
              font-dm font-medium text-[16px] px-6 py-3.5
              inline-flex items-center justify-center
              transition-all duration-200
              hover:border-zovu-primary
            "
          >
            Back
          </button>
          <SubmitButton loading={isSubmitting} className="flex-1">
            Complete Registration
          </SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
};
