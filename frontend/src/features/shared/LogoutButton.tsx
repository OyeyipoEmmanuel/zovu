import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineLogout } from 'react-icons/hi';
import { useAuthStore } from '../../stores/authStore';
import { logout as logoutRequest, clearAccessToken } from '../../services/authService';
import { invalidateAuthMeCache } from '../../lib/api';

interface LogoutButtonProps {
  className?: string;
  variant?: 'sidebar' | 'bottom-bar' | 'icon';
  label?: string;
}

const baseClass: Record<NonNullable<LogoutButtonProps['variant']>, string> = {
  sidebar:
    'flex items-center gap-3 px-4 py-3 rounded-[8px] font-dm text-[14px] text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors w-full text-left',
  'bottom-bar':
    'flex flex-col items-center gap-0.5 px-2 py-1 rounded-md text-red-300 hover:text-red-200',
  icon:
    'flex items-center gap-2 px-3 py-2 rounded-[8px] font-dm text-[13px] text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors',
};

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  className,
  variant = 'sidebar',
  label = 'Log out',
}) => {
  const navigate = useNavigate();
  const storeLogout = useAuthStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logoutRequest().catch(() => {
        // Server-side logout is best-effort; still clear local state.
      });
    } finally {
      clearAccessToken();
      invalidateAuthMeCache();
      storeLogout();
      setBusy(false);
      navigate('/login', { replace: true });
    }
  };

  const cls = `${baseClass[variant]} ${className ?? ''}`.trim();

  if (variant === 'bottom-bar') {
    return (
      <button onClick={handleLogout} disabled={busy} className={cls} aria-label="Log out">
        <HiOutlineLogout size={20} />
        <span className="font-dm text-[9px]">Log out</span>
      </button>
    );
  }

  return (
    <button onClick={handleLogout} disabled={busy} className={cls} aria-label="Log out">
      <HiOutlineLogout size={variant === 'icon' ? 16 : 20} />
      <span>{busy ? 'Logging out…' : label}</span>
    </button>
  );
};

export default LogoutButton;
