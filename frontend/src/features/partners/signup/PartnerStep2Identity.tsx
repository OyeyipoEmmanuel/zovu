import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerStore } from '../../../stores/partnerStore';
import { lenderProfileAPI } from '../../../lib/api';

export const PartnerStep2Identity: React.FC = () => {
  const navigate = useNavigate();
  const { accountType, setCurrentProfileStep } = usePartnerStore();

  const [bvn, setBvn] = useState('');
  const [bvnMasked, setBvnMasked] = useState(false);
  
  const [nin, setNin] = useState('');
  const [ninMasked, setNinMasked] = useState(false);
  
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'1' | '2' | ''>('');
  
  const [cac, setCac] = useState('');
  const [orgBvn, setOrgBvn] = useState('');
  const [orgBvnMasked, setOrgBvnMasked] = useState(false);
  const [yearEst, setYearEst] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isIndividual = accountType === 'individual';

  const maskValue = (val: string) => {
    if (val.length <= 4) return val;
    return '*'.repeat(val.length - 4) + val.slice(-4);
  };

  const isValidIndividual = bvn.length === 11 && nin.length === 11 && dob !== '' && gender !== '';
  const isValidOrg = cac.trim() !== '' && orgBvn.length === 11 && yearEst.length === 4;

  const isValid = isIndividual ? isValidIndividual : isValidOrg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      if (isIndividual) {
        // dob format requires mm/dd/yyyy. Let's assume standard input type="date" yields yyyy-mm-dd
        const [yyyy, mm, dd] = dob.split('-');
        const formattedDob = `${mm}/${dd}/${yyyy}`;
        await lenderProfileAPI.step2Individual({
          bvn,
          nin,
          dob: formattedDob,
          gender: gender as '1' | '2',
        });
      } else {
        await lenderProfileAPI.step2Organization({
          cac_number: cac,
          organization_bvn: orgBvn,
          year_established: Number(yearEst),
        });
      }

      setCurrentProfileStep(3);
      navigate('/dashboard/partners/complete-profile/funding');
    } catch (err: any) {
      setError(err.message || 'Failed to verify identity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-syne text-[24px] font-bold text-zovu-text-light">Identity Verification</h2>
        <p className="font-dm text-[14px] text-zovu-text">We need to verify your {isIndividual ? 'personal' : 'business'} identity to secure the platform.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {isIndividual ? (
          <>
            <div className="flex flex-col gap-2">
              <label className="font-dm text-[14px] text-zovu-text-light font-medium">BVN</label>
              <input
                type="text"
                value={bvnMasked ? maskValue(bvn) : bvn}
                onFocus={() => setBvnMasked(false)}
                onBlur={() => setBvnMasked(true)}
                onChange={(e) => {
                  if (bvnMasked) return;
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 11) setBvn(val);
                }}
                className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                placeholder="11 digit BVN"
              />
              <p className="font-dm text-[12px] text-zovu-text">Dial *565*0# to get your BVN</p>
              {bvn.length > 0 && bvn.length !== 11 && (
                <span className="font-dm text-[12px] text-red-400">BVN must be exactly 11 digits</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-dm text-[14px] text-zovu-text-light font-medium">NIN</label>
              <input
                type="text"
                value={ninMasked ? maskValue(nin) : nin}
                onFocus={() => setNinMasked(false)}
                onBlur={() => setNinMasked(true)}
                onChange={(e) => {
                  if (ninMasked) return;
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 11) setNin(val);
                }}
                className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                placeholder="11 digit NIN"
              />
              <p className="font-dm text-[12px] text-zovu-text">Dial *346# to get your NIN</p>
              {nin.length > 0 && nin.length !== 11 && (
                <span className="font-dm text-[12px] text-red-400">NIN must be exactly 11 digits</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-dm text-[14px] text-zovu-text-light font-medium">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-dm text-[14px] text-zovu-text-light font-medium">Gender</label>
                <div className="flex gap-3 h-[46px]">
                  <button
                    type="button"
                    onClick={() => setGender('1')}
                    className={`flex-1 rounded-[8px] border font-dm text-[14px] transition-all ${
                      gender === '1'
                        ? 'bg-zovu-primary/10 border-zovu-primary text-zovu-primary'
                        : 'bg-zovu-surface-2 border-zovu-border text-zovu-text hover:border-zovu-text/30'
                    }`}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('2')}
                    className={`flex-1 rounded-[8px] border font-dm text-[14px] transition-all ${
                      gender === '2'
                        ? 'bg-zovu-primary/10 border-zovu-primary text-zovu-primary'
                        : 'bg-zovu-surface-2 border-zovu-border text-zovu-text hover:border-zovu-text/30'
                    }`}
                  >
                    Female
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <label className="font-dm text-[14px] text-zovu-text-light font-medium">CAC Registration Number</label>
              <input
                type="text"
                value={cac}
                onChange={(e) => setCac(e.target.value)}
                className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                placeholder="e.g. RC123456"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-dm text-[14px] text-zovu-text-light font-medium">Organization BVN</label>
              <input
                type="text"
                value={orgBvnMasked ? maskValue(orgBvn) : orgBvn}
                onFocus={() => setOrgBvnMasked(false)}
                onBlur={() => setOrgBvnMasked(true)}
                onChange={(e) => {
                  if (orgBvnMasked) return;
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 11) setOrgBvn(val);
                }}
                className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                placeholder="11 digit Organization BVN"
              />
              {orgBvn.length > 0 && orgBvn.length !== 11 && (
                <span className="font-dm text-[12px] text-red-400">BVN must be exactly 11 digits</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-dm text-[14px] text-zovu-text-light font-medium">Year Established</label>
              <input
                type="number"
                value={yearEst}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= 4) setYearEst(val);
                }}
                className="w-full bg-zovu-surface-2 border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-3 outline-none focus:border-zovu-primary transition-colors"
                placeholder="YYYY"
              />
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-4 text-red-400 font-dm text-[13px]">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setCurrentProfileStep(1);
              navigate('/dashboard/partners/complete-profile/account');
            }}
            className="flex-1 py-4 bg-zovu-surface-2 hover:bg-zovu-surface-2/80 text-zovu-text-light font-dm text-[15px] font-medium rounded-[8px] transition-colors border border-zovu-border"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!isValid || loading}
            className="flex-[2] bg-zovu-primary text-zovu-primary-text font-dm font-bold text-[16px] py-4 rounded-[8px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-zovu-primary-text/30 border-t-zovu-primary-text rounded-full animate-spin" />}
            {loading ? 'Verifying...' : 'Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
};
