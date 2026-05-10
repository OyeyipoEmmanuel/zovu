import React from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ hasError, className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`
        w-full bg-zovu-bg border rounded-[8px] px-4 py-3
        font-dm text-[16px] text-zovu-text-light leading-[1.5]
        placeholder:text-zovu-text/40
        transition-colors duration-200
        outline-none
        ${hasError
          ? 'border-red-400 focus:border-red-400'
          : 'border-zovu-border focus:border-zovu-amber'
        }
        ${className}
      `}
      {...props}
    />
  )
);

TextInput.displayName = 'TextInput';
