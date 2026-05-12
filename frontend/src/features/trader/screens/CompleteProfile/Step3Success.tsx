import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCheck, HiOutlineClipboardCopy } from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuthStore } from '../../../../stores';
import { copyToClipboard } from '../../../../lib/utils';

export const Step3Success: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Mark completion to 100%
    updateUser({ profileCompletion: 100 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (user?.squadVaNumber) {
      const ok = await copyToClipboard(user.squadVaNumber);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const whatsappText = `Pay me via my Zovu account:\n\nAccount Name: ${user?.firstName} ${user?.lastName}\nAccount Number: ${user?.squadVaNumber}\nBank: ${user?.squadVaBank}\n\nPowered by Zovu ✨`;

  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 bg-zovu-primary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <div className="w-14 h-14 bg-zovu-primary rounded-full flex items-center justify-center text-zovu-primary-text shadow-lg transform scale-110">
          <HiCheck size={32} />
        </div>
      </div>

      <h2 className="font-syne text-[24px] font-bold text-zovu-text-light mb-2">
        Your Zovu account is ready
      </h2>
      <p className="font-dm text-[14px] text-zovu-text mb-8">
        You can now receive payments directly into your wallet.
      </p>

      <div className="w-full bg-zovu-surface-2 border border-zovu-primary/30 rounded-[12px] p-6 mb-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-zovu-primary/10 to-transparent pointer-events-none" />
        
        <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-2">
          Your Account Number
        </p>
        <p className="font-syne text-[36px] font-bold text-zovu-text-light leading-none tracking-tight mb-2">
          {user?.squadVaNumber || '---'}
        </p>
        <p className="font-dm text-[14px] font-medium text-zovu-primary mb-6">
          {user?.squadVaBank || 'GTBank'}
        </p>

        <div className="flex items-center justify-center gap-3 relative z-10">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 flex-1 bg-zovu-surface-1 border border-zovu-border py-2.5 rounded-[8px] font-dm text-[13px] font-medium text-zovu-text-light hover:border-zovu-primary transition-colors"
          >
            <HiOutlineClipboardCopy size={16} />
            {copied ? 'Copied!' : 'Copy Number'}
          </button>
          
          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 flex-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 py-2.5 rounded-[8px] font-dm text-[13px] font-medium hover:bg-[#25D366]/20 transition-colors"
          >
            <FaWhatsapp size={16} />
            Share via WhatsApp
          </a>
        </div>
      </div>

      <button
        onClick={() => navigate('/dashboard/trader')}
        className="w-full bg-zovu-primary text-zovu-primary-text font-dm font-medium text-[16px] py-4 rounded-[10px] hover:brightness-110 active:scale-[0.99] transition-all"
      >
        Go to Dashboard
      </button>
    </div>
  );
};
