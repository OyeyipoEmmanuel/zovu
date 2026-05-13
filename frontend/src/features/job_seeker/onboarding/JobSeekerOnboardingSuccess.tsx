import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export const JobSeekerOnboardingSuccess = () => {
  const navigate = useNavigate();
  const { setOnboardingComplete, skills, availability, preferredLgas, languages } = useJobSeekerStore();

  useEffect(() => {
    setOnboardingComplete(true);
  }, [setOnboardingComplete]);

  // Fallback data if page is loaded directly
  const displaySkills = skills.length > 0 ? skills.slice(0, 3).join(', ') : 'Logistics, Heavy Lifting, Driving';
  
  const availMap: Record<string, string> = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    gig: 'Gig work',
    open: 'Open to anything'
  };
  const displayAvail = availability ? availMap[availability] : 'Full Time & Gig work';
  
  const displayLocs = preferredLgas.length > 0 ? preferredLgas.slice(0, 3).join(', ') : 'Mile 12, Oshodi, Surulere';
  const displayLangs = languages.length > 0 ? languages.slice(0, 3).join(', ') : 'Yoruba, Pidgin, English';

  return (
    <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-500 pt-8 pb-12">
      <div className="w-20 h-20 bg-[#1A6B4A]/20 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-[#1A6B4A]" />
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-4">Your Zovu work profile is ready</h1>
      
      <p className="text-gray-400 max-w-md mx-auto mb-8 text-lg">
        You're now visible to employers and traders looking for skilled workers like you.
      </p>

      <div className="bg-[#1A1A1A] border border-[#333] rounded-2xl p-6 w-full max-w-md text-left mb-8 shadow-xl">
        <h3 className="text-white font-medium mb-4 pb-2 border-b border-[#333]">Your profile overview:</h3>
        
        <ul className="space-y-3 text-sm">
          <li className="flex">
            <span className="text-gray-500 w-24 shrink-0">Skills:</span>
            <span className="text-gray-200 font-medium">{displaySkills}</span>
          </li>
          <li className="flex">
            <span className="text-gray-500 w-24 shrink-0">Available:</span>
            <span className="text-gray-200 font-medium">{displayAvail}</span>
          </li>
          <li className="flex">
            <span className="text-gray-500 w-24 shrink-0">Location:</span>
            <span className="text-gray-200 font-medium">{displayLocs}</span>
          </li>
          <li className="flex">
            <span className="text-gray-500 w-24 shrink-0">Languages:</span>
            <span className="text-gray-200 font-medium">{displayLangs}</span>
          </li>
        </ul>
      </div>

      <div className="w-full max-w-md text-left space-y-4 mb-10">
        <h3 className="text-white font-medium">What happens next:</h3>
        
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-[#F4A11D]">→</div>
            <p className="text-gray-300 text-sm">Employers can find and hire you directly for roles and gigs</p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-[#F4A11D]">→</div>
            <p className="text-gray-300 text-sm">Every gig you complete builds your <span className="font-semibold text-white">Pulse Score</span></p>
          </div>
          <div className="flex gap-3 items-start">
            <div className="mt-0.5 text-[#F4A11D]">→</div>
            <p className="text-gray-300 text-sm">Your Pulse Score unlocks loans and financial services</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/dashboard/job-seeker')}
        className="bg-[#1A6B4A] hover:bg-[#145339] text-white font-semibold py-3.5 px-8 rounded-xl transition-colors flex items-center justify-center group"
      >
        Go to Dashboard
        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
};
