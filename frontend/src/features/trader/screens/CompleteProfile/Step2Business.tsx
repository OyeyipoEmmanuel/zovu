import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitBusinessInfo } from '../../../../lib/api';

const CATEGORIES = [
  'Fashion',
  'Food & Provisions',
  'Electronics',
  'Agriculture',
  'Beauty & Hair',
  'Transport & Logistics',
  'Other',
];

const LGAS = [
  'Agege',
  'Ajeromi-Ifelodun',
  'Alimosho',
  'Amuwo-Odofin',
  'Apapa',
  'Badagry',
  'Epe',
  'Eti-Osa',
  'Ibeju-Lekki',
  'Ifako-Ijaiye',
  'Ikeja',
  'Ikorodu',
  'Kosofe',
  'Lagos Island',
  'Lagos Mainland',
  'Mushin',
  'Ojo',
  'Oshodi-Isolo',
  'Shomolu',
  'Surulere',
];

export const Step2Business: React.FC = () => {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [primaryMarket, setPrimaryMarket] = useState('');
  const [lga, setLga] = useState('');
  const [revenueRange, setRevenueRange] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = businessName.trim().length > 0 && category !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      await submitBusinessInfo({
        businessName,
        category,
        yearsInBusiness,
        primaryMarket,
        lga,
        revenueRange,
        primaryLanguage,
      });
      navigate('/dashboard/trader/complete-profile/success');
    } catch {
      setError('Failed to save business info. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-1">
        Business Info
      </h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 text-center">
          <p className="font-dm text-[13px] text-red-400">{error}</p>
        </div>
      )}

      {/* Business Name */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Business Name <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Mama Tunde Provisions"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
        />
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Business Category <span className="text-red-400">*</span></label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
        >
          <option value="" disabled>Select category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Years in Business */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Years in Business</label>
        <select
          value={yearsInBusiness}
          onChange={(e) => setYearsInBusiness(e.target.value)}
          className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
        >
          <option value="" disabled>Select years</option>
          <option value="Less than 1 year">Less than 1 year</option>
          <option value="1-3 years">1–3 years</option>
          <option value="3-5 years">3–5 years</option>
          <option value="5+ years">5+ years</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Primary Market */}
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-zovu-text-light font-medium">Primary Market</label>
          <input
            type="text"
            value={primaryMarket}
            onChange={(e) => setPrimaryMarket(e.target.value)}
            placeholder="e.g. Mile 12"
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
          />
        </div>

        {/* LGA */}
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-zovu-text-light font-medium">LGA</label>
          <select
            value={lga}
            onChange={(e) => setLga(e.target.value)}
            className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
          >
            <option value="" disabled>Select LGA</option>
            {LGAS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Revenue Range */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Average Monthly Revenue</label>
        <select
          value={revenueRange}
          onChange={(e) => setRevenueRange(e.target.value)}
          className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
        >
          <option value="" disabled>Select revenue</option>
          <option value="Below ₦50k">Below ₦50k</option>
          <option value="₦50k–₦150k">₦50k–₦150k</option>
          <option value="₦150k–₦500k">₦150k–₦500k</option>
          <option value="Above ₦500k">Above ₦500k</option>
        </select>
      </div>

      {/* Primary Language */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Primary Language</label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="w-full bg-zovu-surface-1 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors appearance-none"
        >
          <option value="" disabled>Select language</option>
          {['Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'English'].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full mt-2 bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
        {loading ? 'Saving...' : 'Continue'}
      </button>
    </form>
  );
};
