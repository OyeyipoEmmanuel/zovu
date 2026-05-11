import type React from 'react';
import type { FieldError } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  id: string;
  error?: FieldError;
  children: React.ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, id, error, children, hint }) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={id}
      className="font-dm text-[14px] font-medium text-zovu-text leading-[1.4] tracking-[0.01em]"
    >
      {label}
    </label>
    {children}
    {hint && !error && (
      <span className="font-dm text-[12px] text-zovu-text/60 leading-[1.2]">{hint}</span>
    )}
    {error && (
      <span className="font-dm text-[12px] text-red-400 leading-[1.2]" role="alert">
        {error.message}
      </span>
    )}
  </div>
);
