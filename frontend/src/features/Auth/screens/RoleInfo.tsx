import React, { useState } from 'react';
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
  jobSeekerSchema,
  type JobSeekerFormData,
  SKILL_CATEGORY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  PREFERRED_JOB_TYPE_OPTIONS,
  AVAILABILITY_OPTIONS,
  informalTraderSchema,
  type InformalTraderFormData,
  BUSINESS_TYPE_OPTIONS,
  MARKET_TYPE_OPTIONS,
  TRADING_YEARS_OPTIONS,
  DAILY_REVENUE_OPTIONS,
  REGISTRATION_STATUS_OPTIONS,
} from '../schemas';

type RoleTab = 'job_seeker' | 'informal_trader';

// ─── Job Seeker Form ──────────────────────────────────────────────────────────

const JobSeekerForm: React.FC<{ onSubmit: (data: JobSeekerFormData) => Promise<void> ; onBack: () => void }> = ({ onSubmit, onBack }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JobSeekerFormData>({
    resolver: zodResolver(jobSeekerSchema),
    defaultValues: {
      skillCategory: '',
      specificSkills: '',
      experienceLevel: '',
      preferredJobType: '',
      availability: '',
      preferredLocation: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <FormField label="Primary Skill Category" id="skillCategory" error={errors.skillCategory}>
        <SelectInput
          id="skillCategory"
          placeholder="Select your main skill area"
          options={[...SKILL_CATEGORY_OPTIONS]}
          hasError={!!errors.skillCategory}
          {...register('skillCategory')}
        />
      </FormField>

      <FormField
        label="Specific Skills"
        id="specificSkills"
        error={errors.specificSkills}
        hint="Describe what you can do, e.g. 'Plumbing, tiling, pipe fitting'"
      >
        <TextInput
          id="specificSkills"
          placeholder="e.g. Tailoring, electrical wiring, motorcycle repairs"
          hasError={!!errors.specificSkills}
          {...register('specificSkills')}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Experience Level" id="experienceLevel" error={errors.experienceLevel}>
          <SelectInput
            id="experienceLevel"
            placeholder="Select level"
            options={[...EXPERIENCE_LEVEL_OPTIONS]}
            hasError={!!errors.experienceLevel}
            {...register('experienceLevel')}
          />
        </FormField>

        <FormField label="Preferred Work Type" id="preferredJobType" error={errors.preferredJobType}>
          <SelectInput
            id="preferredJobType"
            placeholder="Select type"
            options={[...PREFERRED_JOB_TYPE_OPTIONS]}
            hasError={!!errors.preferredJobType}
            {...register('preferredJobType')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Availability" id="availability" error={errors.availability}>
          <SelectInput
            id="availability"
            placeholder="Select availability"
            options={[...AVAILABILITY_OPTIONS]}
            hasError={!!errors.availability}
            {...register('availability')}
          />
        </FormField>

        <FormField label="Preferred Work Location" id="preferredLocation" error={errors.preferredLocation}>
          <TextInput
            id="preferredLocation"
            placeholder="e.g. Lagos Island, Ikeja"
            hasError={!!errors.preferredLocation}
            {...register('preferredLocation')}
          />
        </FormField>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
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
          Continue to Identity Verification
        </SubmitButton>
      </div>
    </form>
  );
};

// ─── Informal Trader Form ─────────────────────────────────────────────────────

const InformalTraderForm: React.FC<{ onSubmit: (data: InformalTraderFormData) => Promise<void>; onBack: () => void }> = ({ onSubmit, onBack }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InformalTraderFormData>({
    resolver: zodResolver(informalTraderSchema),
    defaultValues: {
      businessType: '',
      businessDescription: '',
      marketType: '',
      marketLocation: '',
      yearsTrading: '',
      averageDailyRevenue: '',
      hasBusinessRegistration: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <FormField label="Business Type" id="businessType" error={errors.businessType}>
        <SelectInput
          id="businessType"
          placeholder="What do you sell or trade?"
          options={[...BUSINESS_TYPE_OPTIONS]}
          hasError={!!errors.businessType}
          {...register('businessType')}
        />
      </FormField>

      <FormField
        label="Business Description"
        id="businessDescription"
        error={errors.businessDescription}
        hint="Briefly describe what you sell or do"
      >
        <TextInput
          id="businessDescription"
          placeholder="e.g. I sell provisions and drinks at Balogun Market"
          hasError={!!errors.businessDescription}
          {...register('businessDescription')}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Market / Selling Type" id="marketType" error={errors.marketType}>
          <SelectInput
            id="marketType"
            placeholder="Where do you sell?"
            options={[...MARKET_TYPE_OPTIONS]}
            hasError={!!errors.marketType}
            {...register('marketType')}
          />
        </FormField>

        <FormField label="Market Location" id="marketLocation" error={errors.marketLocation}>
          <TextInput
            id="marketLocation"
            placeholder="e.g. Balogun Market, Lagos Island"
            hasError={!!errors.marketLocation}
            {...register('marketLocation')}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Years Trading" id="yearsTrading" error={errors.yearsTrading}>
          <SelectInput
            id="yearsTrading"
            placeholder="How long?"
            options={[...TRADING_YEARS_OPTIONS]}
            hasError={!!errors.yearsTrading}
            {...register('yearsTrading')}
          />
        </FormField>

        <FormField label="Avg. Daily Revenue" id="averageDailyRevenue" error={errors.averageDailyRevenue}>
          <SelectInput
            id="averageDailyRevenue"
            placeholder="Select range"
            options={[...DAILY_REVENUE_OPTIONS]}
            hasError={!!errors.averageDailyRevenue}
            {...register('averageDailyRevenue')}
          />
        </FormField>
      </div>

      <FormField label="Business Registration (CAC)" id="hasBusinessRegistration" error={errors.hasBusinessRegistration}>
        <SelectInput
          id="hasBusinessRegistration"
          placeholder="Is your business registered?"
          options={[...REGISTRATION_STATUS_OPTIONS]}
          hasError={!!errors.hasBusinessRegistration}
          {...register('hasBusinessRegistration')}
        />
      </FormField>

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
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
          Continue to Identity Verification
        </SubmitButton>
      </div>
    </form>
  );
};

// ─── Role Info Screen ─────────────────────────────────────────────────────────

export const RoleInfo: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RoleTab>('job_seeker');

  const handleJobSeekerSubmit = async (data: JobSeekerFormData): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    sessionStorage.setItem('zovu_role', JSON.stringify({ type: 'job_seeker', data }));
    navigate('/signup/identity-verification');
  };

  const handleTraderSubmit = async (data: InformalTraderFormData): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    sessionStorage.setItem('zovu_role', JSON.stringify({ type: 'informal_trader', data }));
    navigate('/signup/identity-verification');
  };

  const handleBack = (): void => {
    navigate('/signup/personal-info');
  };

  return (
    <AuthLayout
      title="What Do You Do?"
      subtitle="Select your primary role so we can tailor the Zovu experience to you."
      step={{ current: 2, total: 5, label: 'Role Information' }}
    >
      {/* Tab Selector */}
      <div className="flex rounded-[8px] border border-zovu-border overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('job_seeker')}
          className={`
            flex-1 py-3 px-4 font-dm font-medium text-[14px]
            inline-flex items-center justify-center gap-2
            transition-all duration-200
            ${activeTab === 'job_seeker'
              ? 'bg-zovu-primary text-zovu-primary-text'
              : 'bg-transparent text-zovu-text hover:text-zovu-text-light hover:bg-zovu-surface-2'
            }
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Job Seeker
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('informal_trader')}
          className={`
            flex-1 py-3 px-4 font-dm font-medium text-[14px]
            inline-flex items-center justify-center gap-2
            transition-all duration-200 border-l border-zovu-border
            ${activeTab === 'informal_trader'
              ? 'bg-zovu-primary text-zovu-primary-text'
              : 'bg-transparent text-zovu-text hover:text-zovu-text-light hover:bg-zovu-surface-2'
            }
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <rect width="20" height="5" x="2" y="7"/>
          </svg>
          Informal Trader
        </button>
      </div>

      {/* Role Description */}
      <div className="bg-zovu-bg border border-zovu-border rounded-[8px] p-3 mb-6">
        <p className="font-dm text-[13px] text-zovu-text leading-[1.5]">
          {activeTab === 'job_seeker' ? (
            <>
              <span className="text-zovu-amber font-medium">Job Seeker:</span>{' '}
              You're looking for work — gigs, contracts, or full-time roles. We'll help match you with opportunities and build your credit with every job completed.
            </>
          ) : (
            <>
              <span className="text-zovu-amber font-medium">Informal Trader:</span>{' '}
              You buy and sell goods or run a small business. We'll help you track transactions, build credit, and access financial services for your trade.
            </>
          )}
        </p>
      </div>

      {/* Conditional Form */}
      {activeTab === 'job_seeker' ? (
        <JobSeekerForm onSubmit={handleJobSeekerSubmit} onBack={handleBack} />
      ) : (
        <InformalTraderForm onSubmit={handleTraderSubmit} onBack={handleBack} />
      )}
    </AuthLayout>
  );
};
