import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { jobSeekerOnboardingAPI } from '../../../lib/api';
import { X, Loader2 } from 'lucide-react';

const SUGGESTED_SKILLS = [
  'Logistics', 'Heavy Lifting', 'Delivery', 'Tailoring', 'Carpentry',
  'Plumbing', 'Electricals', 'Cooking', 'Cleaning', 'Security',
  'Driving', 'Sales', 'Customer Service', 'Data Entry', 'Photography', 'Welding'
];

const AVAILABLE_LANGUAGES = ['Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'English'];

export const JobSeekerStep1Skills = () => {
  const navigate = useNavigate();
  const { 
    skills: storeSkills, 
    languages: storeLanguages, 
    primaryLanguage: storePrimaryLanguage,
    setSkills,
    setLanguages,
    setPrimaryLanguage,
    setCurrentStep
  } = useJobSeekerStore();

  const [skills, setLocalSkills] = useState<string[]>(storeSkills);
  const [skillInput, setSkillInput] = useState('');
  const [languages, setLocalLanguages] = useState<string[]>(storeLanguages);
  const [primaryLang, setLocalPrimaryLang] = useState<string | null>(storePrimaryLanguage);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setLocalSkills([...skills, trimmed]);
    }
    setSkillInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setLocalSkills(skills.filter(s => s !== skillToRemove));
  };

  const toggleLanguage = (lang: string) => {
    setLocalLanguages(prev => {
      const isSelected = prev.includes(lang);
      const updated = isSelected ? prev.filter(l => l !== lang) : [...prev, lang];
      
      // If primary language was unselected, clear it
      if (isSelected && primaryLang === lang) {
        setLocalPrimaryLang(null);
      }
      return updated;
    });
  };

  const isValid = skills.length > 0 && languages.length > 0 && primaryLang !== null;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await jobSeekerOnboardingAPI.skills({
        skills,
        languages,
        primary_language: primaryLang!
      });
      
      setSkills(skills);
      setLanguages(languages);
      setPrimaryLanguage(primaryLang!);
      setCurrentStep('experience');
      
      navigate('/dashboard/job-seeker/onboarding/experience');
    } catch (err: any) {
      setError(err.detail || 'Failed to save skills. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">What can you do?</h1>
        <p className="text-gray-400">Add your skills so we can match you to the right opportunities</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Skills Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-300">Your Skills</label>
        
        <div className="flex flex-wrap gap-2 mb-2">
          {skills.map(skill => (
            <div key={skill} className="flex items-center gap-1 bg-[#1A6B4A] text-white px-3 py-1.5 rounded-full text-sm">
              <span>{skill}</span>
              <button onClick={() => removeSkill(skill)} className="hover:text-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <input
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a skill and press Enter or comma..."
          className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D] transition-colors"
        />

        <div>
          <p className="text-xs text-gray-500 mb-2">Suggested skills:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SKILLS.filter(s => !skills.includes(s)).map(skill => (
              <button
                key={skill}
                onClick={() => handleAddSkill(skill)}
                className="bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#333] text-gray-300 px-3 py-1.5 rounded-full text-xs transition-colors"
              >
                + {skill}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Languages Section */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <label className="block text-sm font-medium text-gray-300">Languages Spoken</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AVAILABLE_LANGUAGES.map(lang => {
            const isSelected = languages.includes(lang);
            return (
              <button
                key={lang}
                onClick={() => toggleLanguage(lang)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected 
                    ? 'bg-[#1A6B4A]/20 border-[#1A6B4A] text-[#1A6B4A] font-medium' 
                    : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500'
                }`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Language */}
      {languages.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#2A2A2A] animate-in fade-in slide-in-from-top-4">
          <label className="block text-sm font-medium text-gray-300">Primary Language</label>
          <p className="text-xs text-gray-500 mb-3">Which language should we use to communicate with you?</p>
          <div className="flex flex-wrap gap-3">
            {languages.map(lang => (
              <button
                key={lang}
                onClick={() => setLocalPrimaryLang(lang)}
                className={`px-4 py-2 rounded-lg border transition-all ${
                  primaryLang === lang
                    ? 'bg-[#1A6B4A] border-[#1A6B4A] text-white'
                    : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      )}

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
            'Continue to Experience'
          )}
        </button>
      </div>
    </div>
  );
};
