import { z } from 'zod';

export const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
] as const;

const passwordSchema = z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

export const personalInfoSchema = z
  .object({
    role: z.enum(['trader', 'job_seeker', 'lender'], {
      message: 'Please select a role',
    }),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    business_name: z.string().optional(),
    full_name: z.string().optional(),
    company_name: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => data.role !== 'trader' || (data.business_name ?? '').trim() !== '',
    { message: 'Business name is required', path: ['business_name'] },
  )
  .refine(
    (data) => data.role !== 'job_seeker' || (data.full_name ?? '').trim() !== '',
    { message: 'Full name is required', path: ['full_name'] },
  )
  .refine(
    (data) => data.role !== 'lender' || (data.company_name ?? '').trim() !== '',
    { message: 'Company name is required', path: ['company_name'] },
  );

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;
