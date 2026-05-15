// Mock data has been completely deleted. This file is now a thin type-only
// re-export shim so existing `import type { ... } from '../lib/mockData'`
// statements continue to compile without changes. New code should import
// directly from `./api` instead.
export type {
  Transaction,
  PulseSignal,
  PulseHistoryPoint,
  Gig,
  VirtualAccount,
  UserProfile,
  JobMatch,
  GigRecord,
  JSTransaction,
  JSNotification,
} from './api';

// LGAs are static reference data, not mock business data, so they live on.
export const LAGOS_LGAS = [
  'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa',
  'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye',
  'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland',
  'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere',
];
