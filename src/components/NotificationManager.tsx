import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Inbox } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppContext } from '../AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  targetUid?: string;
  read?: boolean;
  createdAt?: any;
}

function formatRelativeTime(timestamp: any): string {
  if (!timestamp) return 'Just now';
  let date: Date;
  if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    return 'Just now';
  }

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  if (diffInMs < 0) return 'Just now';
  const diffInMins = Math.floor(diffInMs / 60000);
  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationManager({ iconClassName = 'text-slate-600 hover:bg-white' }: { iconClassName?: string }) {
  const { user } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const userUid = user?.uid || user?.id;
    if (!userUid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'user_notifications', userUid, 'items'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched: NotificationItem[] = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as NotificationItem[];

        setNotifications(fetched);
        setLoading(false);
      }, (err) => {
        console.warn('Notification stream warning:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'user_notifications');
      setLoading(false);
    }
  }, [user?.uid, user?.id, user?.role]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const userUid = user?.uid || user?.id;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (!db || !userUid) return;
    try {
      const unread = notifications.filter(n => !n.read);
      for (const item of unread) {
        await updateDoc(doc(db, 'user_notifications', userUid, 'items', item.id), { read: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'user_notifications');
    }
  };

  const markSingleRead = async (id: string) => {
    const userUid = user?.uid || user?.id;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (!db || !userUid) return;
    try {
      await updateDoc(doc(db, 'user_notifications', userUid, 'items', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'user_notifications');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition-colors relative cursor-pointer ${iconClassName}`}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-600 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Bell size={14} className="text-[#0A3B24]" />
              <span className="font-black text-xs text-slate-800 uppercase tracking-wide">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-emerald-100 text-[#0A3B24] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button 
                onClick={markAllRead} 
                className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check size={10} /> Mark all read
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Inbox size={24} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-500">No new notifications</p>
                <p className="text-[10px] text-slate-400">All caught up! Real-time alerts will appear here.</p>
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => markSingleRead(n.id)}
                  className={`p-3 rounded-xl text-xs space-y-1 transition-all cursor-pointer border ${
                    n.read 
                      ? 'bg-white border-slate-100 text-slate-600' 
                      : 'bg-emerald-50/50 border-emerald-100 text-slate-900 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-slate-800 text-xs leading-snug">{n.title}</p>
                    <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                  {n.message && (
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {n.message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
