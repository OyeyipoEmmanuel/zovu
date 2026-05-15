import React, { useState } from 'react';
import { fileComplaint } from '../../lib/api';

interface ComplaintModalProps {
  transactionId: string;
  transactionLabel?: string;
  onClose: () => void;
  onFiled?: () => void;
}

const CATEGORIES = [
  { value: 'transaction_failed', label: 'Transaction failed' },
  { value: 'payment_delayed', label: 'Payment delayed' },
  { value: 'wrong_amount', label: 'Wrong amount' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'other', label: 'Other' },
] as const;

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  transactionId,
  transactionLabel,
  onClose,
  onFiled,
}) => {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>(
    'transaction_failed',
  );
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError('Please describe the issue with at least 10 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fileComplaint({
        transaction_id: transactionId,
        category,
        description: description.trim(),
        urgency,
      });
      setSuccess(`Complaint #${res.id.slice(0, 8)} sent to admin. We&apos;ll email you when it&apos;s resolved.`);
      if (onFiled) onFiled();
      setTimeout(onClose, 1500);
    } catch (e) {
      setError((e as Error).message || 'Could not file complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="font-syne text-[20px] font-bold text-zovu-text-light mb-1">
          Report an issue
        </h2>
        {transactionLabel && (
          <p className="font-dm text-[13px] text-zovu-text mb-4">
            About:{' '}
            <span className="text-zovu-text-light">{transactionLabel}</span>
          </p>
        )}

        <label className="flex flex-col gap-1 mb-3">
          <span className="font-dm text-[12px] text-zovu-text-light font-medium">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            aria-label="Complaint category"
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value} className="bg-zovu-surface-1">
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 mb-3">
          <span className="font-dm text-[12px] text-zovu-text-light font-medium">
            Urgency
          </span>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((u) => (
              <button
                type="button"
                key={u}
                onClick={() => setUrgency(u)}
                className={`flex-1 py-2 rounded-[8px] font-dm text-[12px] font-medium capitalize ${
                  urgency === u
                    ? 'bg-[#1A6B4A] text-white'
                    : 'bg-zovu-surface-2 text-zovu-text-light'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1 mb-3">
          <span className="font-dm text-[12px] text-zovu-text-light font-medium">
            What happened?
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            minLength={10}
            placeholder="Tell us exactly what went wrong"
            className="w-full bg-transparent border border-zovu-border rounded-[8px] font-dm text-[14px] text-zovu-text-light px-4 py-2 outline-none focus:border-zovu-primary resize-none"
          />
        </label>

        {error && (
          <p className="font-dm text-[12px] text-red-400 mb-3" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="font-dm text-[12px] text-emerald-400 mb-3">{success}</p>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-zovu-surface-2 text-zovu-text-light font-dm text-[13px] rounded-[8px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-[#1A6B4A] text-white font-dm text-[13px] font-medium rounded-[8px] hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send to admin'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComplaintModal;
