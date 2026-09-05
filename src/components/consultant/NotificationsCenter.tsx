import React from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  read: boolean;
  createdAt: any;
}

interface NotificationsCenterProps {
  notifications: NotificationItem[];
  loadingNotifs: boolean;
  unreadCount: number;
  userUid: string;
  onNavigateToFeedback: () => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  loadingNotifs,
  unreadCount,
  userUid,
  onNavigateToFeedback
}) => {
  const handleMarkAllRead = async () => {
    if (!userUid) return;
    const unread = notifications.filter(n => !n.read);
    for (const item of unread) {
      await updateDoc(doc(db, 'user_notifications', userUid, 'items', item.id), { read: true });
    }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.read && userUid) {
      await updateDoc(doc(db, 'user_notifications', userUid, 'items', n.id), { read: true });
    }
    const lowerTitle = (n.title || '').toLowerCase();
    const lowerMsg = (n.message || '').toLowerCase();
    if (
      lowerTitle.includes('feedback') || 
      lowerTitle.includes('rating') || 
      lowerTitle.includes('review') || 
      lowerMsg.includes('feedback') || 
      lowerMsg.includes('rating') || 
      lowerMsg.includes('review')
    ) {
      onNavigateToFeedback();
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">Notifications Center</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] text-emerald-700 font-extrabold hover:underline uppercase tracking-widest cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>
        
        <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
          {loadingNotifs ? (
            <div className="p-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 mb-4 border border-slate-100 shadow-inner">
                <Bell size={28} className="stroke-[1.6]" />
              </div>
              <p className="text-sm font-black text-slate-800 uppercase tracking-tight">No new notifications</p>
              <p className="text-xs text-slate-500 font-medium">All caught up! Real-time clinical alerts will appear here.</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 group ${
                  n.read
                    ? 'bg-white border-slate-100 text-slate-600 grayscale-[0.5]'
                    : 'bg-emerald-50/30 border-emerald-100 text-slate-900 shadow-sm scale-[1.01]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-black text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors uppercase tracking-tight text-sm">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 bg-emerald-600 rounded-full shrink-0 mt-1.5 shadow-[0_0_8px_rgba(5,150,105,0.4)]" />}
                </div>
                {n.message && <p className="text-xs text-slate-600 font-semibold leading-relaxed">{n.message}</p>}
                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest pt-1">
                  {n.createdAt ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
