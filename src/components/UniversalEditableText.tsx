import React, { useState, useEffect } from 'react';
import { Edit3, Check, X, Sparkles } from 'lucide-react';
import { useAppContext } from '../AppContext';

interface UniversalEditableTextProps {
  id: string;
  defaultText: string;
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  className?: string;
}

export const UniversalEditableText: React.FC<UniversalEditableTextProps> = ({
  id,
  defaultText,
  tag = 'span',
  className = ''
}) => {
  const { user } = useAppContext();
  const isAdmin = user?.role === 'admin' || user?.email?.includes('admin') || localStorage.getItem('pockettclinic_impersonating_admin') === 'true';
  const isMasterEditActive = localStorage.getItem('pockettclinic_master_edit_mode') === 'true';

  const storageKey = `pockettclinic_editable_text_${id}`;
  const [text, setText] = useState(() => {
    return localStorage.getItem(storageKey) || defaultText;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(text);

  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) setText(saved);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setText(tempText);
    localStorage.setItem(storageKey, tempText);
    setIsEditing(false);
    window.dispatchEvent(new Event('storage'));
  };

  const Component = tag as any;

  if (!isAdmin || !isMasterEditActive) {
    return <Component className={className}>{text}</Component>;
  }

  return (
    <span className="relative group inline-block align-baseline">
      <Component className={`${className} ring-2 ring-lime-300/50 bg-slate-50/30 rounded px-1 transition-all`}>
        {text}
      </Component>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setTempText(text);
          setIsEditing(true);
        }}
        className="absolute -top-3 -right-3 z-40 bg-emerald-600 text-white p-1 rounded-full shadow-lg hover:bg-emerald-600 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer"
        title="Edit Text / Logo / Header"
      >
        <Edit3 size={11} />
      </button>

      {isEditing && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="text-slate-600" size={18} />
                Edit App Element
              </h3>
              <button type="button" onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Text / Content / Title ID: {id}</label>
              <textarea
                value={tempText}
                onChange={e => setTempText(e.target.value)}
                rows={3}
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-emerald-600 hover:bg-emerald-600 shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={15} />
                Save & Apply App-Wide
              </button>
            </div>
          </form>
        </div>
      )}
    </span>
  );
};
