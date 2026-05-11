import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ hasError, options, placeholder, className = '', ...props }, ref) => (
    <select
      ref={ref}
      className={`
        w-full bg-zovu-bg border rounded-[8px] px-4 py-3
        font-dm text-[16px] text-zovu-text-light leading-[1.5]
        transition-colors duration-200
        outline-none appearance-none
        bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23A0A0A0%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
        bg-no-repeat bg-[position:right_12px_center]
        pr-10
        ${hasError
          ? 'border-red-400 focus:border-red-400'
          : 'border-zovu-border focus:border-zovu-amber'
        }
        ${className}
      `}
      {...props}
    >
      {placeholder && (
        <option value="" className="text-zovu-text/40">
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
);

SelectInput.displayName = 'SelectInput';
