
import React, { useState } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  dangerous?: boolean;
  confirmationText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  dangerous = false,
  confirmationText,
}) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const isConfirmDisabled = dangerous && confirmationText && inputText !== confirmationText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141414] border border-white/10 rounded-[16px] w-full max-w-md p-6 shadow-2xl">
        <h3 className={`font-syne text-[20px] font-bold mb-2 ${dangerous ? 'text-red-500' : 'text-white'}`}>
          {title}
        </h3>
        <p className="font-dm text-[14px] text-[#A0A0A0] mb-6">
          {description}
        </p>

        {dangerous && confirmationText && (
          <div className="mb-6">
            <label className="block font-dm text-[12px] text-[#F5F5F5] mb-2">
              Type <span className="font-bold text-white">"{confirmationText}"</span> to confirm:
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full bg-transparent border border-white/10 rounded-[8px] px-4 py-3 font-dm text-[14px] text-white outline-none focus:border-red-500/50 transition-colors"
              placeholder={confirmationText}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-[#2A2A2A] text-[#F5F5F5] font-dm font-medium text-[14px] rounded-[10px] hover:bg-[#333] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isConfirmDisabled}
            className={`flex-1 py-3 font-dm font-medium text-[14px] rounded-[10px] transition-all ${
              dangerous
                ? 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40'
                : 'bg-[#1A6B4A] text-white hover:bg-[#1A6B4A]/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
