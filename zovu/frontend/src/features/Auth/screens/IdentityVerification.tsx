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
  identityVerificationSchema,
  type IdentityVerificationFormData,
  ID_TYPE_OPTIONS,
  NIGERIAN_STATES,
} from '../schemas';

export const IdentityVerification: React.FC = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IdentityVerificationFormData>({
    resolver: zodResolver(identityVerificationSchema),
    defaultValues: {
      idType: '',
      idNumber: '',
      address: '',
      state: '',
      city: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: IdentityVerificationFormData): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    sessionStorage.setItem('zovu_identity', JSON.stringify(data));
    navigate('/signup/financial-profile');
  };

  return (
    <AuthLayout
      title="Verify Your Identity"
      subtitle="Provide your government-issued ID and residential address for verification."
      step={{ current: 3, total: 5, label: 'Identity Verification' }}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        {/* ID Type & Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="ID Type" id="idType" error={errors.idType}>
            <SelectInput
              id="idType"
              placeholder="Select ID type"
              options={[...ID_TYPE_OPTIONS]}
              hasError={!!errors.idType}
              {...register('idType')}
            />
          </FormField>

          <FormField
            label="ID Number"
            id="idNumber"
            error={errors.idNumber}
            hint="e.g. NIN: 12345678901"
          >
            <TextInput
              id="idNumber"
              placeholder="Enter your ID number"
              hasError={!!errors.idNumber}
              {...register('idNumber')}
            />
          </FormField>
        </div>

        {/* Divider */}
        <div className="border-t border-zovu-border my-1" />

        {/* Address */}
        <FormField label="Residential Address" id="address" error={errors.address}>
          <TextInput
            id="address"
            placeholder="12 Marina Road, Victoria Island"
            hasError={!!errors.address}
            {...register('address')}
          />
        </FormField>

        {/* State & City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="State" id="state" error={errors.state}>
            <SelectInput
              id="state"
              placeholder="Select state"
              options={NIGERIAN_STATES}
              hasError={!!errors.state}
              {...register('state')}
            />
          </FormField>

          <FormField label="City" id="city" error={errors.city}>
            <TextInput
              id="city"
              placeholder="Lagos"
              hasError={!!errors.city}
              {...register('city')}
            />
          </FormField>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            type="button"
            onClick={() => navigate('/signup/role-info')}
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
            Continue to Financial Profile
          </SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
};
