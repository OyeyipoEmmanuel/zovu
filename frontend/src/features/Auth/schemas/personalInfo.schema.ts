import { z } from 'zod';

export const personalInfoSchema = z.object({
  role: z.enum(['Trader', 'Job Seeker', 'Both'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character'),
  businessName: z.string().optional(),
}).refine(
  (data) => {
    if ((data.role === 'Trader' || data.role === 'Both') && (!data.businessName || data.businessName.trim() === '')) {
      return false;
    }
    return true;
  },
  {
    message: 'Business name is required for your selected role',
    path: ['businessName'],
  }
);

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;
