import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineUser,
  HiOutlineShieldCheck,
  HiOutlineBell,
  HiOutlineLogout,
  HiOutlineChevronRight,
} from 'react-icons/hi';
import { useAuthStore } from '../../../stores';

const settingsGroups = [
  {
    title: 'Account',
    items: [
      { icon: HiOutlineUser, label: 'Edit Profile', desc: 'Name, email, business info', action: 'profile' },
      { icon: HiOutlineShieldCheck, label: 'Identity Verification', desc: 'BVN, NIN, and documents', action: 'identity' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: HiOutlineBell, label: 'Notifications', desc: 'Push, email, and SMS alerts', action: 'notifications' },
    ],
  },
];

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-syne text-[24px] sm:text-[28px] font-bold text-zovu-text-light">Settings</h1>

      {settingsGroups.map((group) => (
        <div key={group.title}>
          <p className="font-dm text-[12px] text-zovu-text uppercase tracking-wider mb-3">{group.title}</p>
          <div className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] overflow-hidden divide-y divide-zovu-border">
            {group.items.map((item) => (
              <button
                key={item.action}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-zovu-surface-2/50 transition-colors duration-150 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-zovu-surface-2 flex items-center justify-center shrink-0">
                  <item.icon size={18} className="text-zovu-text-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-[14px] text-zovu-text-light font-medium">{item.label}</p>
                  <p className="font-dm text-[12px] text-zovu-text">{item.desc}</p>
                </div>
                <HiOutlineChevronRight size={18} className="text-zovu-text shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-5 py-4 bg-zovu-surface-1 border border-red-500/20 rounded-[12px] hover:border-red-500/40 transition-colors duration-200 w-full"
      >
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
          <HiOutlineLogout size={18} className="text-red-400" />
        </div>
        <span className="font-dm text-[14px] text-red-400 font-medium">Log Out</span>
      </button>
    </div>
  );
};
