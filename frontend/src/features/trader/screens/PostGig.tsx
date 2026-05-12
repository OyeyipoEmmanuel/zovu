import React, { useState } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import { postGig } from '../../../lib/api';
import { formatCurrency } from '../../../lib/utils';
import { LAGOS_LGAS } from '../../../lib/mockData';
import { useTraderStore } from '../../../stores';

const PAY_PERIODS = ['Per Hour', 'Per Day', 'Fixed'] as const;
const LANGUAGES = ['Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'English'] as const;
const URGENCY = ['Normal', 'Urgent'] as const;

export const PostGig: React.FC = () => {
  const { addGig } = useTraderStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [pay, setPay] = useState<number | ''>('');
  const [payPeriod, setPayPeriod] = useState<typeof PAY_PERIODS[number]>('Per Day');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState<typeof URGENCY[number]>('Normal');
  const [languages, setLanguages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePay = typeof pay === 'number' ? pay + (urgency === 'Urgent' ? 500 : 0) : 0;

  const handleSkillAdd = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = skillInput.trim();
      if (val && !skills.includes(val)) {
        setSkills([...skills, val]);
      }
      setSkillInput('');
    }
  };

  const toggleLanguage = (lang: string): void => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title || !description || typeof pay !== 'number' || !location) return;
    setSubmitting(true);
    setError(null);
    try {
      const newGig = await postGig({
        title,
        description,
        skills,
        pay: effectivePay,
        payPeriod,
        location,
        urgency,
        languages,
      });
      addGig(newGig);
      setSubmitted(true);
    } catch {
      setError('Failed to post gig. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-zovu-primary/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zovu-primary">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-syne text-[24px] font-bold text-zovu-text-light">Gig Posted!</h2>
        <p className="font-dm text-[14px] text-zovu-text max-w-sm">
          Your gig is now live and visible to job seekers in your area.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setTitle('');
            setDescription('');
            setSkills([]);
            setPay('');
            setPayPeriod('Per Day');
            setLocation('');
            setUrgency('Normal');
            setLanguages([]);
          }}
          className="px-6 py-3 bg-zovu-primary text-zovu-primary-text rounded-[8px] font-dm font-medium hover:brightness-110 transition-all"
        >
          Post Another Gig
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">Post a Gig</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Shop Assistant Needed"
              className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200 placeholder:text-zovu-text/50"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the job involves..."
              rows={4}
              className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200 placeholder:text-zovu-text/50 resize-none"
            />
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Skills Needed</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {skills.map((s) => (
                <span key={s} className="flex items-center gap-1 bg-zovu-primary/10 text-zovu-primary px-2.5 py-1 rounded-full font-dm text-[12px]">
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((sk) => sk !== s))}>
                    <HiOutlineX size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillAdd}
              placeholder="Type a skill and press Enter"
              className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200 placeholder:text-zovu-text/50"
            />
          </div>

          {/* Pay + Period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-dm text-[13px] text-zovu-text-light font-medium">Pay Amount (₦)</label>
              <input
                type="number"
                value={pay}
                onChange={(e) => setPay(e.target.value ? Number(e.target.value) : '')}
                placeholder="5000"
                min={0}
                className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200 placeholder:text-zovu-text/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm text-[13px] text-zovu-text-light font-medium">Pay Period</label>
              <div className="flex gap-1 p-1 bg-zovu-surface-2 border border-zovu-border rounded-[8px]">
                {PAY_PERIODS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPayPeriod(p)}
                    className={`flex-1 py-2 rounded-[6px] font-dm text-[11px] font-medium transition-all duration-200 ${
                      payPeriod === p ? 'bg-zovu-primary text-zovu-primary-text' : 'text-zovu-text hover:text-zovu-text-light'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Location (Lagos LGA)</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-zovu-bg border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors duration-200"
            >
              <option value="">Select LGA</option>
              {LAGOS_LGAS.map((lga) => (
                <option key={lga} value={lga}>{lga}</option>
              ))}
            </select>
          </div>

          {/* Urgency */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Urgency</label>
            <div className="flex gap-2">
              {URGENCY.map((u) => (
                <button
                  type="button"
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={`flex-1 py-2.5 rounded-[8px] border font-dm text-[13px] font-medium transition-all duration-200 ${
                    urgency === u
                      ? u === 'Urgent'
                        ? 'border-zovu-amber bg-zovu-amber/10 text-zovu-amber'
                        : 'border-zovu-primary bg-zovu-primary/10 text-zovu-primary'
                      : 'border-zovu-border text-zovu-text hover:border-zovu-primary/50'
                  }`}
                >
                  {u}
                  {u === 'Urgent' && <span className="text-[10px] ml-1">(+₦500)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="flex flex-col gap-1.5">
            <label className="font-dm text-[13px] text-zovu-text-light font-medium">Language Preference</label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full border font-dm text-[12px] transition-all duration-200 ${
                    languages.includes(lang)
                      ? 'border-zovu-primary bg-zovu-primary/10 text-zovu-primary'
                      : 'border-zovu-border text-zovu-text hover:border-zovu-primary/50'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="font-dm text-[13px] text-red-400 text-center" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !title || !description || typeof pay !== 'number' || !location}
            className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting...' : 'Post Gig'}
          </button>
        </form>

        {/* Live Preview */}
        <div className="lg:sticky lg:top-8 h-fit">
          <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-3">Live Preview</p>
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-5 sm:p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-syne text-[18px] font-semibold text-zovu-text-light leading-tight">
                {title || 'Job Title'}
              </h3>
              {urgency === 'Urgent' && (
                <span className="font-dm text-[10px] font-semibold text-zovu-amber bg-zovu-amber/10 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-2">
                  Urgent
                </span>
              )}
            </div>
            <p className="font-dm text-[13px] text-zovu-text leading-[1.5] mb-4 line-clamp-3">
              {description || 'Job description will appear here...'}
            </p>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {skills.map((s) => (
                  <span key={s} className="bg-zovu-surface-2 text-zovu-text-light px-2.5 py-1 rounded-full font-dm text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            )}

            <div className="border-t border-zovu-border pt-4 flex items-center justify-between">
              <div>
                <p className="font-syne text-[20px] font-bold text-zovu-primary">
                  {typeof pay === 'number' ? formatCurrency(effectivePay) : '₦0'}
                </p>
                <p className="font-dm text-[11px] text-zovu-text">{payPeriod}</p>
              </div>
              <div className="text-right">
                <p className="font-dm text-[12px] text-zovu-text-light">{location || 'Location'}</p>
                {languages.length > 0 && (
                  <p className="font-dm text-[11px] text-zovu-text mt-0.5">{languages.join(', ')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
