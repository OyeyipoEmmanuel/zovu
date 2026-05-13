import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import type { WorkHistoryItem } from '../../../stores/jobSeekerStore';
import { jobSeekerOnboardingAPI } from '../../../lib/api';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const EXPERIENCE_YEARS = [
  'No experience yet',
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5+ years'
];

const EDUCATION_LEVELS = [
  'No formal education',
  'Primary School',
  'Junior Secondary (JSS3)',
  'Senior Secondary (WAEC/NECO)',
  'OND / NCE',
  'HND / B.Sc',
  'Postgraduate'
];

const WORK_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'gig', label: 'Gig' },
  { value: 'apprenticeship', label: 'Apprenticeship' }
] as const;

export const JobSeekerStep2Experience = () => {
  const navigate = useNavigate();
  const { 
    yearsExperience, educationLevel, currentlyEmployed, workHistory: storeWorkHistory,
    setCurrentStep
  } = useJobSeekerStore();

  const [years, setYears] = useState<string | null>(yearsExperience);
  const [edu, setEdu] = useState<string>(educationLevel || '');
  const [employed, setEmployed] = useState<boolean>(currentlyEmployed);
  
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  const [currentEmployer, setCurrentEmployer] = useState('');
  
  const [workHistory, setWorkHistory] = useState<WorkHistoryItem[]>(storeWorkHistory);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddJob = () => {
    if (workHistory.length < 3) {
      setWorkHistory([...workHistory, { job_title: '', employer: '', type: 'full_time', duration: '' }]);
    }
  };

  const handleRemoveJob = (index: number) => {
    setWorkHistory(workHistory.filter((_, i) => i !== index));
  };

  const updateJob = (index: number, field: keyof WorkHistoryItem, value: string) => {
    const updated = [...workHistory];
    updated[index] = { ...updated[index], [field]: value };
    setWorkHistory(updated);
  };

  const isWorkHistoryValid = workHistory.every(w => w.job_title.trim() !== '' && w.duration.trim() !== '');
  const hasRequiredEmployment = employed ? currentJobTitle.trim() !== '' : workHistory.length > 0;
  
  const isValid = years !== null && edu !== '' && hasRequiredEmployment && isWorkHistoryValid;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await jobSeekerOnboardingAPI.experience({
        years_of_experience: years!,
        education_level: edu,
        currently_employed: employed,
        current_job_title: employed ? currentJobTitle : undefined,
        current_employer: employed ? currentEmployer : undefined,
        work_history: workHistory
      });
      
      useJobSeekerStore.setState({
        yearsExperience: years,
        educationLevel: edu,
        currentlyEmployed: employed,
        workHistory: workHistory
      });
      setCurrentStep('cv');
      
      navigate('/dashboard/job-seeker/onboarding/cv');
    } catch (err: any) {
      setError(err.detail || 'Failed to save experience. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Your work background</h1>
        <p className="text-gray-400">Tell us about your experience — even informal work counts</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Years of Experience */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">Years of experience</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {EXPERIENCE_YEARS.map(opt => (
            <button
              key={opt}
              onClick={() => setYears(opt)}
              className={`p-3 rounded-xl border text-left text-sm transition-all ${
                years === opt 
                  ? 'bg-[#1A6B4A]/20 border-[#1A6B4A] text-[#1A6B4A] font-medium' 
                  : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Education Level */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <label className="block text-sm font-medium text-gray-300">Highest education level</label>
        <select
          value={edu}
          onChange={(e) => setEdu(e.target.value)}
          className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D] transition-colors appearance-none"
        >
          <option value="" disabled>Select highest education</option>
          {EDUCATION_LEVELS.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>
      </div>

      {/* Currently Employed */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">Are you currently employed?</label>
          <div className="flex bg-[#1A1A1A] rounded-lg p-1 border border-[#333]">
            <button
              onClick={() => setEmployed(true)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${employed ? 'bg-[#1A6B4A] text-white' : 'text-gray-400'}`}
            >
              Yes
            </button>
            <button
              onClick={() => setEmployed(false)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${!employed ? 'bg-[#333] text-white' : 'text-gray-400'}`}
            >
              No
            </button>
          </div>
        </div>

        {employed && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Current job title</label>
              <input
                type="text"
                value={currentJobTitle}
                onChange={(e) => setCurrentJobTitle(e.target.value)}
                placeholder="e.g. Head of Security"
                className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#F4A11D]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Current employer (optional)</label>
              <input
                type="text"
                value={currentEmployer}
                onChange={(e) => setCurrentEmployer(e.target.value)}
                placeholder="e.g. GTBank"
                className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[#F4A11D]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Past Work History */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <div>
          <label className="block text-sm font-medium text-gray-300">Past Work History</label>
          <p className="text-xs text-gray-500 mb-4">Add up to 3 previous roles or gigs</p>
        </div>

        {workHistory.map((job, index) => (
          <div key={index} className="bg-[#1A1A1A] border border-[#333] rounded-xl p-4 space-y-4 relative">
            <div className="flex justify-between items-start">
              <h4 className="text-sm font-medium text-white">Job {index + 1}</h4>
              <button onClick={() => handleRemoveJob(index)} className="text-red-500 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Job title</label>
                <input
                  type="text"
                  value={job.job_title}
                  onChange={(e) => updateJob(index, 'job_title', e.target.value)}
                  placeholder="e.g. Delivery Driver"
                  className="w-full bg-[#0D0D0D] border border-[#333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4A11D]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Employer / Client (optional)</label>
                <input
                  type="text"
                  value={job.employer || ''}
                  onChange={(e) => updateJob(index, 'employer', e.target.value)}
                  placeholder="e.g. Jumia"
                  className="w-full bg-[#0D0D0D] border border-[#333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4A11D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Employment Type</label>
              <div className="flex flex-wrap gap-2">
                {WORK_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    onClick={() => updateJob(index, 'type', wt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      job.type === wt.value 
                        ? 'bg-[#1A6B4A] text-white border border-[#1A6B4A]' 
                        : 'bg-[#0D0D0D] text-gray-400 border border-[#333] hover:border-gray-500'
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Duration</label>
              <input
                type="text"
                value={job.duration}
                onChange={(e) => updateJob(index, 'duration', e.target.value)}
                placeholder='e.g. "6 months" or "2 years"'
                className="w-full bg-[#0D0D0D] border border-[#333] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#F4A11D]"
              />
            </div>
          </div>
        ))}

        {workHistory.length < 3 && (
          <button
            onClick={handleAddJob}
            className="text-[#F4A11D] text-sm font-medium flex items-center hover:text-[#d68b17] transition-colors"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add another past job
          </button>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-6">
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full bg-[#F4A11D] hover:bg-[#d68b17] disabled:bg-[#F4A11D]/50 disabled:cursor-not-allowed text-black font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Continue to CV'
          )}
        </button>
      </div>
    </div>
  );
};
