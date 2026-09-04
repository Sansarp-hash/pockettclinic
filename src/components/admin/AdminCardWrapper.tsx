import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, X, Check } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface AdminCardWrapperProps {
  cardId: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultBadge?: string;
  children: (data: {
    title: string;
    description?: string;
    badge?: string;
    isEditing: boolean;
  }) => React.ReactNode;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updated: { title: string; description?: string; badge?: string }) => void;
}

export const AdminCardWrapper: React.FC<AdminCardWrapperProps> = ({
  cardId,
  defaultTitle,
  defaultDescription,
  defaultBadge,
  children,
  onDelete,
  onUpdate
}) => {
  const { user, isMasterEditMode } = useAppContext();
  
  // Strict admin check
  const isAdmin = user?.role === 'admin';

  const storageKey = `pockettclinic_card_${cardId}`;
  const savedState = localStorage.getItem(storageKey);
  const parsed = savedState ? JSON.parse(savedState) : null;

  const [isDeleted, setIsDeleted] = useState(parsed?.isDeleted || false);
  const [title, setTitle] = useState(parsed?.title || defaultTitle);
  const [description, setDescription] = useState(parsed?.description || defaultDescription);
  const [badge, setBadge] = useState(parsed?.badge || defaultBadge);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!parsed?.title) setTitle(defaultTitle);
  }, [defaultTitle]);

  useEffect(() => {
    if (!parsed?.description) setDescription(defaultDescription);
  }, [defaultDescription]);

  useEffect(() => {
    if (!parsed?.badge) setBadge(defaultBadge);
  }, [defaultBadge]);

  const [tempTitle, setTempTitle] = useState(title);
  const [tempDesc, setTempDesc] = useState(description || '');
  const [tempBadge, setTempBadge] = useState(badge || '');

  if (isDeleted) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setTitle(tempTitle);
    setDescription(tempDesc);
    setBadge(tempBadge);
    setIsEditing(false);
    localStorage.setItem(storageKey, JSON.stringify({ title: tempTitle, description: tempDesc, badge: tempBadge, isDeleted: false }));
    if (onUpdate) onUpdate(cardId, { title: tempTitle, description: tempDesc, badge: tempBadge });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    const isPermanent = !!onDelete;
    setIsDeleted(true);
    if (isPermanent) {
      onDelete(cardId);
    } else {
      localStorage.setItem(storageKey, JSON.stringify({ title, description, badge, isDeleted: true }));
    }
    setShowDeleteConfirm(false);
  };

  return (
    <div className="relative group/card-wrapper">
      {isAdmin && (
        <div className="absolute top-2 right-2 z-30 opacity-0 group-hover/card-wrapper:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-1 rounded-xl shadow-lg border border-slate-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTempTitle(title);
              setTempDesc(description || '');
              setTempBadge(badge || '');
              setIsEditing(true);
            }}
            className="p-1 text-slate-500 hover:text-slate-600 hover:bg-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
            title="Edit Card Details"
          >
            <Edit2 size={13} />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-rose-400 hover:text-slate-600 hover:bg-rose-600 text-white rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
            title="Delete Card"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}

      {typeof children === 'function' 
        ? children({ title, description, badge, isEditing }) 
        : children
      }

      {isEditing && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">Edit Card Content</h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Card Title / Heading</label>
              <input
                type="text"
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {defaultDescription !== undefined && (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Card Description / Body</label>
                <textarea
                  value={tempDesc}
                  onChange={e => setTempDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}

            {defaultBadge !== undefined && (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Badge / Tag Text</label>
                <input
                  type="text"
                  value={tempBadge}
                  onChange={e => setTempBadge(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-emerald-600 hover:bg-emerald-600 shadow-md flex items-center gap-1.5"
              >
                <Check size={15} />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
              <Trash2 size={32} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-800">Confirm Deletion</h3>
              <p className="text-sm font-medium text-slate-600 leading-relaxed">
                {!!onDelete 
                  ? "CRITICAL: Are you sure you want to PERMANENTLY DELETE this record? This action cannot be undone."
                  : "Hide this card from public view? (You can restore it later in Edit Mode)"}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete();
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold text-slate-600 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
              >
                Yes, Delete Record
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCardWrapper;
