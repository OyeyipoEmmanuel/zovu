import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { jobSeekerOnboardingAPI } from '../../../lib/api';
import { LAGOS_LGAS } from '../../../lib/mockData';
import { Loader2, X } from 'lucide-react';

const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'gig', label: 'Gig / Casual only' },
  { value: 'open', label: 'Open to anything' }
] as const;

const PAY_PERIODS = [
  { value: 'hour', label: 'Per Hour' },
  { value: 'day', label: 'Per Day' },
  { value: 'week', label: 'Per Week' },
  { value: 'month', label: 'Per Month' },
  { value: 'gig', label: 'Fixed per gig' }
] as const;

export const JobSeekerStep4Preferences = () => {
  const navigate = useNavigate();
  const { setCurrentStep } = useJobSeekerStore();

  const [availability, setAvailability] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]);
  const [relocate, setRelocate] = useState(false);
  
  const [minPay, setMinPay] = useState('');
  const [payPeriod, setPayPeriod] = useState<string>('day');
  
  const [autoSavePct, setAutoSavePct] = useState<number>(10);
  
  const [emgName, setEmgName] = useState('');
  const [emgPhone, setEmgPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLocationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val && !locations.includes(val) && locations.length < 5) {
      setLocations([...locations, val]);
    }
    e.target.value = ''; // reset select
  };

  const removeLocation = (loc: string) => {
    setLocations(locations.filter(l => l !== loc));
  };

  const isValidPhone = emgPhone.replace(/\D/g, '').length === 11;
  const isPayValid = minPay.trim() !== '' && !isNaN(Number(minPay));
  const isValid = availability !== null && locations.length > 0 && isPayValid && emgName.trim() !== '' && isValidPhone;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await jobSeekerOnboardingAPI.preferences({
        availability: availability as any,
        preferred_lgas: locations,
        willing_to_relocate: relocate,
        min_pay: Number(minPay),
        pay_period: payPeriod as any,
        auto_save_pct: autoSavePct,
        emergency_contact_name: emgName,
        emergency_contact_phone: emgPhone.replace(/\D/g, '')
      });
      
      setCurrentStep('complete');
      navigate('/dashboard/job-seeker/onboarding/success');
    } catch (err: any) {
      setError(err.detail || 'Failed to save preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Your work preferences</h1>
        <p className="text-gray-400">Help us match you to opportunities that actually suit you</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Availability */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">Availability</label>
        <div className="grid grid-cols-2 gap-3">
          {AVAILABILITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setAvailability(opt.value)}
              className={`p-3 rounded-xl border text-center text-sm font-medium transition-all ${
                availability === opt.value 
                  ? 'bg-[#1A6B4A]/20 border-[#1A6B4A] text-[#1A6B4A]' 
                  : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Locations */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Preferred Work Locations</label>
          <p className="text-xs text-gray-500">We'll prioritise jobs in these areas (Max 5)</p>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-2">
          {locations.map(loc => (
            <div key={loc} className="flex items-center gap-1 bg-[#2A2A2A] text-gray-200 px-3 py-1.5 rounded-full text-sm">
              <span>{loc}</span>
              <button onClick={() => removeLocation(loc)} className="hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {locations.length < 5 && (
          <select
            onChange={handleLocationSelect}
            className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D] appearance-none"
            defaultValue=""
          >
            <option value="" disabled>Select LGA in Lagos...</option>
            {LAGOS_LGAS.filter(lga => !locations.includes(lga)).map(lga => (
              <option key={lga} value={lga}>{lga}</option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-between mt-4">
          <label className="text-sm text-gray-300">Willing to relocate?</label>
          <div className="flex bg-[#1A1A1A] rounded-lg p-1 border border-[#333]">
            <button
              onClick={() => setRelocate(true)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${relocate ? 'bg-[#1A6B4A] text-white' : 'text-gray-400'}`}
            >
              Yes
            </button>
            <button
              onClick={() => setRelocate(false)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${!relocate ? 'bg-[#333] text-white' : 'text-gray-400'}`}
            >
              No
            </button>
          </div>
        </div>
      </div>

      {/* Pay */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <label className="block text-sm font-medium text-gray-300">Preferred Pay Range</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₦</span>
            <input
              type="number"
              value={minPay}
              onChange={(e) => setMinPay(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-[#F4A11D]"
            />
          </div>
          <select
            value={payPeriod}
            onChange={(e) => setPayPeriod(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D] appearance-none"
          >
            {PAY_PERIODS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ajo Auto-save */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-300">Auto-save for Ajo</label>
            <span className="text-[#1A6B4A] font-bold">{autoSavePct}%</span>
          </div>
          <p className="text-xs text-gray-500">This % of every gig payment will automatically go into your Ajo savings vault</p>
        </div>
        
        <input
          type="range"
          min="0"
          max="30"
          step="5"
          value={autoSavePct}
          onChange={(e) => setAutoSavePct(Number(e.target.value))}
          className="w-full accent-[#1A6B4A] h-2 bg-[#333] rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #1A6B4A 0%, #1A6B4A ${(autoSavePct / 30) * 100}%, #333 ${(autoSavePct / 30) * 100}%, #333 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>15%</span>
          <span>30%</span>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <label className="block text-sm font-medium text-gray-300">Emergency Contact</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              value={emgName}
              onChange={(e) => setEmgName(e.target.value)}
              placeholder="Full Name"
              className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D]"
            />
          </div>
          <div>
            <input
              type="tel"
              value={emgPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                if (val.length <= 11) setEmgPhone(val);
              }}
              placeholder="Phone (11 digits)"
              className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D]"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-8">
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full bg-[#F4A11D] hover:bg-[#d68b17] disabled:bg-[#F4A11D]/50 disabled:cursor-not-allowed text-black font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Complete Profile'
          )}
        </button>
      </div>
    </div>
  );
};
