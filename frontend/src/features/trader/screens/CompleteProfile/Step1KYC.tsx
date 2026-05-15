import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitKYC } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores';

export const Step1KYC: React.FC = () => {
  const navigate = useNavigate();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'1' | '2'>('1');
  const [address, setAddress] = useState('');

  const [ninFocused, setNinFocused] = useState(false);
  const [bvnFocused, setBvnFocused] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Backend `UserKYCSchema.phone` requires `^\+?234\d{10}$`; allow the local
  // `0xxxxxxxxxx` form too because `normalizePhone` in authService converts it
  // before posting.
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid =
    /^\+?234\d{10}$/.test(phone.replace(/\s+/g, '')) ||
    /^0\d{10}$/.test(phoneDigits) ||
    /^234\d{10}$/.test(phoneDigits);

  const isValid =
    /^\d{11}$/.test(nin) &&
    /^\d{11}$/.test(bvn) &&
    fullName.trim().split(/\s+/).length >= 2 &&
    phoneValid &&
    dob !== '' &&
    address.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      // Format dob to mm/dd/yyyy for BE
      const [y, m, d] = dob.split('-');
      const formattedDob = `${m}/${d}/${y}`;

      // Split the single Full Name input into first/last for the backend.
      const nameParts = fullName.trim().split(/\s+/);
      const first = nameParts[0] || 'User';
      const last = nameParts.slice(1).join(' ') || 'User';

      const res = await submitKYC({
        nin,
        bvn,
        first_name: first,
        last_name: last,
        full_name: fullName,
        phone,
        dob: formattedDob,
        gender,
        address,
      });

      if (res.kyc_complete) {
        updateUser({
          kycComplete: true,
          squad_provisioned: res.squad_provisioned,
          squadVaNumber: res.squad_va_number || null,
          squadVaBank: res.squad_va_bank || null,
        });
        navigate('/dashboard/trader/complete-profile/business');
      }
    } catch {
      setError('We could not verify your identity. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMask = (val: string, isFocused: boolean) => {
    if (isFocused || val.length <= 4) return val;
    return '*'.repeat(val.length - 4) + val.slice(-4);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 border-4 border-zovu-primary/30 border-t-zovu-primary rounded-full animate-spin mb-6" />
        <p className="font-dm text-[15px] text-zovu-text-light font-medium animate-pulse">
          Creating your Zovu account...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-1">
        KYC Verification
      </h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 text-center">
          <p className="font-dm text-[13px] text-red-400 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="px-4 py-1.5 bg-zovu-surface-2 text-zovu-text-light font-dm text-[12px] rounded-[6px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* NIN */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">NIN (11 digits)</label>
        <input
          type="text"
          value={handleMask(nin, ninFocused)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (ninFocused) setNin(val);
          }}
          onFocus={() => setNinFocused(true)}
          onBlur={() => setNinFocused(false)}
          placeholder="Enter your NIN"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
        />
        <div className="flex justify-between items-center mt-0.5">
          <span className="font-dm text-[11px] text-zovu-text/70">Dial *346# to get your NIN</span>
          {nin.length > 0 && nin.length !== 11 && (
            <span className="font-dm text-[11px] text-red-400">Must be 11 digits</span>
          )}
        </div>
      </div>

      {/* BVN */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">BVN (11 digits)</label>
        <input
          type="text"
          value={handleMask(bvn, bvnFocused)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (bvnFocused) setBvn(val);
          }}
          onFocus={() => setBvnFocused(true)}
          onBlur={() => setBvnFocused(false)}
          placeholder="Enter your BVN"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
        />
        <div className="flex justify-between items-center mt-0.5">
          <span className="font-dm text-[11px] text-zovu-text/70">Dial *565*0# to get your BVN</span>
          {bvn.length > 0 && bvn.length !== 11 && (
            <span className="font-dm text-[11px] text-red-400">Must be 11 digits</span>
          )}
        </div>
      </div>

      {/* Full Name */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium" htmlFor="kyc-full-name">Full Name</label>
        <input
          id="kyc-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="As it appears on your ID (first & last)"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
        />
        {fullName.trim().length > 0 && fullName.trim().split(/\s+/).length < 2 && (
          <span className="font-dm text-[11px] text-red-400">Enter both first and last name</span>
        )}
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium" htmlFor="kyc-phone">Phone Number</label>
        <input
          id="kyc-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="080… or +234…"
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
        />
        {phone.length > 0 && !phoneValid && (
          <span className="font-dm text-[11px] text-red-400">Use a Nigerian number — 11 digits starting with 0 or +234…</span>
        )}
      </div>

      {/* DOB & Gender */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-zovu-text-light font-medium">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="font-dm text-[13px] text-zovu-text-light font-medium">Gender</label>
          <div className="flex gap-1 p-1 bg-zovu-surface-2 border border-zovu-border rounded-[8px]">
            <button
              type="button"
              onClick={() => setGender('1')}
              className={`flex-1 py-2 rounded-[6px] font-dm text-[12px] font-medium transition-all ${
                gender === '1' ? 'bg-zovu-primary text-zovu-primary-text' : 'text-zovu-text'
              }`}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => setGender('2')}
              className={`flex-1 py-2 rounded-[6px] font-dm text-[12px] font-medium transition-all ${
                gender === '2' ? 'bg-zovu-primary text-zovu-primary-text' : 'text-zovu-text'
              }`}
            >
              Female
            </button>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="flex flex-col gap-1.5">
        <label className="font-dm text-[13px] text-zovu-text-light font-medium">Full Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your residential address"
          rows={2}
          className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full mt-2 bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Continue
      </button>
    </form>
  );
};
