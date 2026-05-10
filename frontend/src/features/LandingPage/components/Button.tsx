import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, className = '', ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center font-dm font-medium transition-colors duration-200';
  
  // Default radius is 0.5rem (8px) - rounded-lg in tailwind, but we'll use rounded-md or rounded-lg
  // Let's stick to standard tailwind classes: rounded-lg = 0.5rem in Tailwind v4 default, wait no, rounded-lg is 0.5rem in v3.
  // In Tailwind v4, rounded-lg is 0.5rem. Let's use rounded-[8px] to be precise.
  
  const variants = {
    primary: 'bg-zovu-primary text-zovu-primary-text rounded-[8px] hover:bg-opacity-90 px-6 py-3',
    secondary: 'bg-transparent border border-zovu-border text-zovu-text-light rounded-[8px] hover:border-zovu-primary hover:text-zovu-text-light px-6 py-3',
    tertiary: 'bg-transparent text-zovu-text hover:text-zovu-text-light px-4 py-2',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
