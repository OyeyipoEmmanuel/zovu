import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { ArrowLeft, CheckCircle, ChevronLeft } from 'lucide-react';
import { useEffect } from 'react';

const STEPS = [
  { id: 'skills', label: 'Step 1: Skills', path: '/dashboard/job-seeker/onboarding/skills' },
  { id: 'experience', label: 'Step 2: Experience', path: '/dashboard/job-seeker/onboarding/experience' },
  { id: 'cv', label: 'Step 3: CV', path: '/dashboard/job-seeker/onboarding/cv' },
  { id: 'preferences', label: 'Step 4: Preferences', path: '/dashboard/job-seeker/onboarding/preferences' },
];

export const JobSeekerOnboarding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { jobSeekerOnboardingComplete } = useJobSeekerStore();

  const isSuccessScreen = location.pathname.includes('/success');
  const currentStepIndex = STEPS.findIndex(s => location.pathname.includes(s.path));

  // Redirect if they land on base url
  useEffect(() => {
    if (location.pathname === '/dashboard/job-seeker/onboarding') {
      if (jobSeekerOnboardingComplete) {
        navigate('/dashboard/job-seeker/onboarding/success', { replace: true });
      } else {
        navigate('/dashboard/job-seeker/onboarding/skills', { replace: true });
      }
    }
  }, [location.pathname, navigate, jobSeekerOnboardingComplete]);

  const handleBack = () => {
    if (currentStepIndex > 0) {
      navigate(STEPS[currentStepIndex - 1].path);
    }
  };

  if (isSuccessScreen) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans">
      <header className="p-4 md:p-6 border-b border-[#2A2A2A]">
        <div className="max-w-3xl mx-auto w-full">
          {/* Header Top: Back button & Logo area if needed */}
          <div className="flex items-center mb-6 h-8">
                    <Link to="/dashboard/job-seeker" className="pt-3 text-white transition-colors flex gap-1 items-center">
            <ArrowLeft className="w-5 h-5 " />
            Back to Dashboard
        </Link>
            {currentStepIndex > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                <span>Back</span>
              </button>
            )}
          </div>

          {/* Step Indicator */}
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#2A2A2A] z-0" />

            {STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              let bgColor = 'bg-[#2A2A2A]';
              let textColor = 'text-gray-500';
              let borderColor = 'border-[#2A2A2A]';

              if (isCompleted) {
                bgColor = 'bg-[#1A6B4A]';
                textColor = 'text-[#1A6B4A]';
                borderColor = 'border-[#1A6B4A]';
              } else if (isCurrent) {
                bgColor = 'bg-[#F4A11D]';
                textColor = 'text-[#F4A11D]';
                borderColor = 'border-[#F4A11D]';
              }

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-[#0D0D0D] ${borderColor}`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-[#1A6B4A]" />
                    ) : (
                      <div className={`w-3 h-3 rounded-full ${bgColor}`} />
                    )}
                  </div>
                  <span className={`text-xs md:text-sm font-medium hidden md:block ${textColor}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        <div className="w-full max-w-xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
