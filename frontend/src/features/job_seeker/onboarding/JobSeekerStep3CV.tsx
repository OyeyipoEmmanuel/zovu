import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobSeekerStore } from '../../../stores/jobSeekerStore';
import { jobSeekerOnboardingAPI } from '../../../lib/api';
import { Loader2, UploadCloud, X, FileText, Image as ImageIcon } from 'lucide-react';

export const JobSeekerStep3CV = () => {
  const navigate = useNavigate();
  const { setCurrentStep } = useJobSeekerStore();

  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);
  const [portfolioLink, setPortfolioLink] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  const handleBioChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= 300) setBio(text);
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Photo must be JPG or PNG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be less than 2MB');
      return;
    }

    setError(null);
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDocsUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let newError = null;
    const validFiles = files.filter(file => {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        newError = 'Documents must be PDF, JPG, or PNG';
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        newError = 'Each document must be less than 5MB';
        return false;
      }
      return true;
    });

    if (newError) setError(newError);

    const totalDocs = [...documents, ...validFiles];
    if (totalDocs.length > 3) {
      setError('You can only upload a maximum of 3 documents');
      setDocuments(totalDocs.slice(0, 3));
    } else {
      setDocuments(totalDocs);
    }
  };

  const removeDoc = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const bioLength = bio.length;
  let counterColor = 'text-gray-500';
  if (bioLength >= 290) counterColor = 'text-red-500';
  else if (bioLength >= 250) counterColor = 'text-[#F4A11D]';

  const isValid = bio.length >= 50;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('bio', bio);
      if (portfolioLink) formData.append('portfolio_link', portfolioLink);
      if (photo) formData.append('photo', photo);
      documents.forEach(doc => formData.append('documents', doc));

      await jobSeekerOnboardingAPI.cv(formData);
      
      setCurrentStep('preferences');
      navigate('/dashboard/job-seeker/onboarding/preferences');
    } catch (err: any) {
      setError(err.detail || 'Failed to save CV data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Build your Zovu CV</h1>
        <p className="text-gray-400">This is shown to employers when you apply for gigs. Make it count.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Profile Bio */}
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <label className="block text-sm font-medium text-gray-300">Profile Bio <span className="text-red-500">*</span></label>
          <span className={`text-xs font-medium ${counterColor}`}>
            {bioLength} / 300
          </span>
        </div>
        <textarea
          value={bio}
          onChange={handleBioChange}
          rows={4}
          placeholder="Describe yourself in a few sentences. E.g. I am a reliable logistics worker based in Mile 12 with 3 years of experience in loading and offloading goods..."
          className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D] resize-none"
        />
        {bio.length > 0 && bio.length < 50 && (
          <p className="text-xs text-red-500">Minimum 50 characters required.</p>
        )}
      </div>

      {/* Profile Photo */}
      <div className="space-y-2 pt-4 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-300">Profile Photo</label>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-[#333] text-gray-300 px-2 py-0.5 rounded">Recommended</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div 
            className="w-24 h-24 rounded-full border-2 border-dashed border-[#555] bg-[#1A1A1A] flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer"
            onClick={() => photoInputRef.current?.click()}
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                  <UploadCloud className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-500" />
            )}
          </div>
          
          <div className="flex-1">
            <button
              onClick={() => photoInputRef.current?.click()}
              className="bg-[#1A1A1A] hover:bg-[#2A2A2A] border border-[#333] text-sm text-gray-300 px-4 py-2 rounded-lg transition-colors mb-2"
            >
              Choose Image
            </button>
            <p className="text-xs text-gray-500">JPG or PNG. Max 2MB.</p>
          </div>
          
          <input 
            type="file" 
            ref={photoInputRef} 
            onChange={handlePhotoUpload} 
            accept="image/jpeg, image/png" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Documents */}
      <div className="space-y-4 pt-4 border-t border-[#2A2A2A]">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Certifications / Documents (Optional)</label>
          <p className="text-xs text-gray-500">Trade certificates, NABTEB, NECO, driver's license, or any relevant document</p>
        </div>

        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div key={index} className="flex items-center justify-between bg-[#1A1A1A] border border-[#333] rounded-lg p-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <FileText className="w-5 h-5 text-[#F4A11D] shrink-0" />
                  <span className="text-sm text-gray-200 truncate">{doc.name}</span>
                </div>
                <button onClick={() => removeDoc(index)} className="text-gray-500 hover:text-red-500 transition-colors ml-4 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {documents.length < 3 && (
          <div 
            onClick={() => docsInputRef.current?.click()}
            className="border-2 border-dashed border-[#333] hover:border-[#555] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#1A1A1A]/50"
          >
            <UploadCloud className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-300">Click to upload document</p>
            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG up to 5MB (Max 3)</p>
          </div>
        )}
        <input 
          type="file" 
          ref={docsInputRef} 
          onChange={handleDocsUpload} 
          accept="application/pdf, image/jpeg, image/png" 
          multiple 
          className="hidden" 
        />
      </div>

      {/* Portfolio Link */}
      <div className="space-y-2 pt-4 border-t border-[#2A2A2A]">
        <label className="block text-sm font-medium text-gray-300">Portfolio Link (Optional)</label>
        <input
          type="url"
          value={portfolioLink}
          onChange={(e) => setPortfolioLink(e.target.value)}
          placeholder="https://"
          className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#F4A11D]"
        />
        <p className="text-xs text-gray-500">Link to your work, social media, or any online presence</p>
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
            'Continue to Preferences'
          )}
        </button>
      </div>
    </div>
  );
};
