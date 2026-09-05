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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-2xl shadow-slate-950/20">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-950 uppercase tracking-tight">Clinical Dispatch</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">Real-time system alerts & patient logs</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-5 py-2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95 cursor-pointer"
            >
              Clear All Read
            </button>
          )}
        </div>
        
        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar relative z-10">
          {loadingNotifs ? (
            <div className="p-24 text-center">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-950 rounded-full animate-spin mx-auto mb-6" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Polling Secure Dispatch...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-24 text-center">
              <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center mx-auto text-slate-200 mb-6 border border-slate-50 shadow-inner">
                <Bell size={40} className="stroke-[1.5]" />
              </div>
              <h4 className="text-[13px] font-black text-slate-950 uppercase tracking-[0.2em]">All Systems Clear</h4>
              <p className="text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-tight italic">"No active clinical alerts or system dispatches detected at this time."</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-6 rounded-[2rem] border transition-all duration-300 cursor-pointer relative group overflow-hidden ${
                  n.read
                    ? 'bg-white border-slate-50 text-slate-400 grayscale'
                    : 'bg-white border-emerald-100 text-slate-900 shadow-lg shadow-emerald-500/5 scale-[1.01]'
                }`}
              >
                <div className="flex items-start justify-between gap-6 relative z-10">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse shrink-0" />
                      )}
                      <h5 className={`font-black text-sm tracking-tight uppercase group-hover:text-emerald-600 transition-colors ${n.read ? 'text-slate-500' : 'text-slate-950'}`}>
                        {n.title}
                      </h5>
                    </div>
                    {n.message && (
                      <p className={`text-[11px] font-bold leading-relaxed ${n.read ? 'text-slate-400' : 'text-slate-600'}`}>
                        {n.message}
                      </p>
                    )}
                    <div className="pt-2 flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {n.createdAt ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just Now'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover FX */}
                {!n.read && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
