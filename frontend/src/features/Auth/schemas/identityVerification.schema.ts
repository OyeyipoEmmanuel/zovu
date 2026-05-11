import { z } from 'zod';

export const ID_TYPE_OPTIONS = [
  { value: 'nin', label: 'National Identity Number (NIN)' },
  { value: 'bvn', label: 'Bank Verification Number (BVN)' },
  { value: 'voters_card', label: "Voter's Card" },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'international_passport', label: 'International Passport' },
] as const;

export const identityVerificationSchema = z.object({
  idType: z
    .string()
    .min(1, 'Please select an ID type'),

  idNumber: z
    .string()
    .min(5, 'ID number must be at least 5 characters')
    .max(20, 'ID number must be at most 20 characters')
    .regex(/^[a-zA-Z0-9-]+$/, 'ID number can only contain letters, numbers, and hyphens'),

  address: z
    .string()
    .min(10, 'Address must be at least 10 characters')
    .max(200, 'Address must be at most 200 characters'),

  state: z
    .string()
    .min(1, 'State is required'),

  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City must be at most 50 characters'),
});

export type IdentityVerificationFormData = z.infer<typeof identityVerificationSchema>;

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT - Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
].map((s) => ({ value: s.toLowerCase().replace(/\s+/g, '_'), label: s }));
