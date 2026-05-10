import { z } from 'zod';

// ─── Job Seeker Schema ────────────────────────────────────────────────────────

export const SKILL_CATEGORY_OPTIONS = [
  { value: 'artisan', label: 'Artisan / Skilled Trade' },
  { value: 'domestic', label: 'Domestic Services' },
  { value: 'driving', label: 'Driving / Logistics' },
  { value: 'construction', label: 'Construction / Labour' },
  { value: 'tech', label: 'Technology / Digital' },
  { value: 'agriculture', label: 'Agriculture / Farming' },
  { value: 'retail', label: 'Retail / Sales' },
  { value: 'hospitality', label: 'Hospitality / Catering' },
  { value: 'health', label: 'Health / Wellness' },
  { value: 'education', label: 'Education / Tutoring' },
  { value: 'other', label: 'Other' },
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner (< 1 year)' },
  { value: 'intermediate', label: 'Intermediate (1–3 years)' },
  { value: 'experienced', label: 'Experienced (3–5 years)' },
  { value: 'expert', label: 'Expert (5+ years)' },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'weekends', label: 'Weekends Only' },
  { value: 'flexible', label: 'Flexible / On-demand' },
] as const;

export const PREFERRED_JOB_TYPE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'on_site', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'gig', label: 'Gig / Short-term' },
  { value: 'contract', label: 'Contract' },
] as const;

export const jobSeekerSchema = z.object({
  skillCategory: z
    .string()
    .min(1, 'Please select your primary skill category'),

  specificSkills: z
    .string()
    .min(3, 'Please describe your specific skills')
    .max(200, 'Skills description must be at most 200 characters'),

  experienceLevel: z
    .string()
    .min(1, 'Please select your experience level'),

  preferredJobType: z
    .string()
    .min(1, 'Please select your preferred work type'),

  availability: z
    .string()
    .min(1, 'Please select your availability'),

  preferredLocation: z
    .string()
    .min(2, 'Preferred work location must be at least 2 characters')
    .max(100, 'Preferred work location must be at most 100 characters'),
});

export type JobSeekerFormData = z.infer<typeof jobSeekerSchema>;

// ─── Informal Trader Schema ───────────────────────────────────────────────────

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'food_beverages', label: 'Food & Beverages' },
  { value: 'clothing_textiles', label: 'Clothing & Textiles' },
  { value: 'electronics', label: 'Electronics & Accessories' },
  { value: 'beauty_cosmetics', label: 'Beauty & Cosmetics' },
  { value: 'agriculture_produce', label: 'Agriculture & Farm Produce' },
  { value: 'building_materials', label: 'Building Materials' },
  { value: 'household_goods', label: 'Household Goods' },
  { value: 'phone_accessories', label: 'Phone Accessories & Repairs' },
  { value: 'general_merchandise', label: 'General Merchandise' },
  { value: 'other', label: 'Other' },
] as const;

export const TRADING_YEARS_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 year' },
  { value: '1_to_3', label: '1–3 years' },
  { value: '3_to_5', label: '3–5 years' },
  { value: '5_to_10', label: '5–10 years' },
  { value: 'above_10', label: '10+ years' },
] as const;

export const DAILY_REVENUE_OPTIONS = [
  { value: 'below_5k', label: 'Below ₦5,000' },
  { value: '5k_15k', label: '₦5,000 – ₦15,000' },
  { value: '15k_50k', label: '₦15,000 – ₦50,000' },
  { value: '50k_100k', label: '₦50,000 – ₦100,000' },
  { value: 'above_100k', label: 'Above ₦100,000' },
] as const;

export const MARKET_TYPE_OPTIONS = [
  { value: 'open_market', label: 'Open Market (e.g. Balogun, Onitsha Main)' },
  { value: 'roadside', label: 'Roadside / Kiosk' },
  { value: 'shop', label: 'Fixed Shop / Store' },
  { value: 'online', label: 'Online / Social Media' },
  { value: 'mobile', label: 'Mobile / Door-to-door' },
  { value: 'mixed', label: 'Mixed (Physical + Online)' },
] as const;

export const informalTraderSchema = z.object({
  businessType: z
    .string()
    .min(1, 'Please select your business type'),

  businessDescription: z
    .string()
    .min(5, 'Business description must be at least 5 characters')
    .max(200, 'Business description must be at most 200 characters'),

  marketType: z
    .string()
    .min(1, 'Please select your market/selling type'),

  marketLocation: z
    .string()
    .min(3, 'Market location must be at least 3 characters')
    .max(100, 'Market location must be at most 100 characters'),

  yearsTrading: z
    .string()
    .min(1, 'Please select how long you have been trading'),

  averageDailyRevenue: z
    .string()
    .min(1, 'Please select your average daily revenue'),

  hasBusinessRegistration: z
    .string()
    .min(1, 'Please indicate your business registration status'),
});

export type InformalTraderFormData = z.infer<typeof informalTraderSchema>;

export const REGISTRATION_STATUS_OPTIONS = [
  { value: 'registered', label: 'Yes, registered with CAC' },
  { value: 'in_progress', label: 'Registration in progress' },
  { value: 'not_registered', label: 'No, not registered' },
] as const;
