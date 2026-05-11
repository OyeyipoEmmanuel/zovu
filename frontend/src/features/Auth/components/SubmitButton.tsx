import type React from 'react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => (
  <button
    type="submit"
    disabled={disabled || loading}
    className={`
      w-full bg-zovu-primary text-zovu-primary-text rounded-[8px]
      font-dm font-medium text-[16px] px-6 py-3.5
      inline-flex items-center justify-center gap-2
      transition-all duration-200
      hover:brightness-110 active:scale-[0.98]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100
      ${className}
    `}
    {...props}
  >
    {loading && (
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
);
