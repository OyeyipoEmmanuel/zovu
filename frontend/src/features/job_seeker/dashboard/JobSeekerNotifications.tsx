import React, { useEffect, useState } from 'react';
import { jobSeekerAPI } from '../../../lib/api';
import type { JSNotification } from '../../../lib/mockData';

const getNotifIcon = (type: string) => {
  switch (type) {
    case 'job': return '💼';
    case 'payment': return '💸';
    case 'score': return '⭐';
    default: return '🔔';
  }
};

const getNotifIconBg = (type: string) => {
  switch (type) {
    case 'job': return 'bg-[#3B82F6]/10';
    case 'payment': return 'bg-[#1A6B4A]/10';
    case 'score': return 'bg-[#F4A11D]/10';
    default: return 'bg-zovu-surface-2';
  }
};

export const JobSeekerNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<JSNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'job' | 'payment' | 'score'>('all');
  const [marking, setMarking] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobSeekerAPI.getNotifications(filter === 'all' ? undefined : filter as 'job' | 'payment' | 'score');
      setNotifications(data);
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filter]);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await jobSeekerAPI.markNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    } catch { /* silent */ }
    finally { setMarking(false); }
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const tabs = ['all', 'job', 'payment', 'score'] as const;
  const tabLabels: Record<string, string> = {
    all: 'All',
    job: 'Jobs',
    payment: 'Payments',
    score: 'Score',
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-syne text-[28px] font-bold text-zovu-text-light">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#1A6B4A] text-white text-[11px] font-dm font-bold">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={marking}
            className="font-dm text-[13px] text-[#1A6B4A] hover:underline disabled:opacity-50"
          >
            {marking ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-zovu-border overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-6 py-3 font-dm text-[14px] font-medium capitalize whitespace-nowrap border-b-2 -mb-[1px] transition-colors ${
              filter === tab ? 'border-[#1A6B4A] text-[#1A6B4A]' : 'border-transparent text-zovu-text hover:text-zovu-text-light'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-zovu-surface-1 border border-zovu-border rounded-[12px] p-4 animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-full bg-zovu-surface-2 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-3/4 bg-zovu-surface-2 rounded" />
                <div className="h-3 w-full bg-zovu-surface-2 rounded" />
                <div className="h-3 w-16 bg-zovu-surface-2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[16px] text-center">
          <p className="text-red-400 font-dm mb-4">{error}</p>
          <button onClick={loadData} className="px-6 py-2 bg-zovu-surface-2 text-zovu-text-light rounded-md font-dm">Retry</button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-zovu-surface-1 border border-zovu-border rounded-[16px] p-12 text-center">
          <p className="font-dm text-[15px] text-zovu-text">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`flex items-start gap-3 p-4 rounded-[12px] border transition-colors ${
                notif.unread
                  ? 'bg-[#1A6B4A]/5 border-[#1A6B4A]/20'
                  : 'bg-zovu-surface-1 border-zovu-border hover:bg-zovu-surface-2/30'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[18px] flex-shrink-0 ${getNotifIconBg(notif.type)}`}>
                {getNotifIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-dm text-[14px] ${notif.unread ? 'text-zovu-text-light font-bold' : 'text-zovu-text-light font-medium'}`}>{notif.title}</h3>
                  {notif.unread && <div className="w-2.5 h-2.5 rounded-full bg-[#1A6B4A] flex-shrink-0 mt-1.5" />}
                </div>
                <p className="font-dm text-[13px] text-zovu-text mt-1 leading-relaxed">{notif.body}</p>
                <span className="font-dm text-[11px] text-zovu-text/60 mt-2 inline-block">{notif.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
