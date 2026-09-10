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
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-950 text-white flex items-center justify-center shadow-md">
              <Bell size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-950 uppercase tracking-tight">Clinical Dispatch</h3>
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Alerts & dispatches</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95 cursor-pointer"
            >
              Clear All Read
            </button>
          )}
        </div>
        
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar relative z-10">
          {loadingNotifs ? (
            <div className="p-10 text-center">
              <div className="w-8 h-8 border-2 border-slate-100 border-t-slate-950 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Polling Secure Dispatch...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto text-slate-300 mb-3 border border-slate-100">
                <Bell size={24} className="stroke-[1.5]" />
              </div>
              <h4 className="text-[10px] font-black text-slate-950 uppercase tracking-widest">All Systems Clear</h4>
              <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase tracking-tight italic">"No active clinical alerts detected."</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer relative group overflow-hidden ${
                  n.read
                    ? 'bg-slate-50/50 border-slate-100 text-slate-400'
                    : 'bg-white border-emerald-100 text-slate-900 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-4 relative z-10 text-left">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse shrink-0" />
                      )}
                      <h5 className={`font-black text-[10px] tracking-tight uppercase group-hover:text-emerald-700 transition-colors ${n.read ? 'text-slate-500' : 'text-slate-950'}`}>
                        {n.title}
                      </h5>
                    </div>
                    {n.message && (
                      <p className={`text-[9px] font-bold leading-normal uppercase tracking-tight ${n.read ? 'text-slate-400' : 'text-slate-600'}`}>
                        {n.message}
                      </p>
                    )}
                    <div className="pt-1 flex items-center gap-1.5">
                      <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">
                        {n.createdAt ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just Now'}
                      </span>
                    </div>
                  </div>
                </div>

                {!n.read && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/2" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
