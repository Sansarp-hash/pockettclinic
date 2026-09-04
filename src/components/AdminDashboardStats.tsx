import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, Activity, CreditCard, Plus, Edit2, Trash2, X, Sparkles, AlertOctagon } from 'lucide-react';
import { StatSkeleton } from './Skeleton';
import { useAppContext } from '../AppContext';

export interface AdminDashboardStatsProps {
  totalUsers: number;
  verifiedCount: number;
  activeSessionsCount: number;
  criticalErrorsCount: number;
  isLoading: boolean;
}

export interface StatCard {
  id: string;
  title: string;
  value: string | number;
  iconType: 'users' | 'shield' | 'activity' | 'credit' | 'custom' | 'alert';
  colorTheme: 'indigo' | 'emerald' | 'blue' | 'purple' | 'amber' | 'rose';
}

const DEFAULT_CARDS: StatCard[] = [
  { id: '1', title: 'Total Users', value: 'dynamic_totalUsers', iconType: 'users', colorTheme: 'indigo' },
  { id: '2', title: 'Verified Consultants', value: 'dynamic_verifiedCount', iconType: 'shield', colorTheme: 'emerald' },
  { id: '3', title: 'Active Sessions', value: 'dynamic_activeSessions', iconType: 'activity', colorTheme: 'blue' },
  { id: '4', title: 'Critical Exceptions', value: 'dynamic_errorCount', iconType: 'alert', colorTheme: 'rose' },
];

export default function AdminDashboardStats({ 
  totalUsers, 
  verifiedCount, 
  activeSessionsCount, 
  criticalErrorsCount,
  isLoading 
}: AdminDashboardStatsProps) {
  const { showToast, showConfirm } = useAppContext();

  const [cards, setCards] = useState<StatCard[]>(() => {
    const saved = localStorage.getItem('pockettclinic_admin_stats_cards');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return DEFAULT_CARDS;
  });

  const [showModal, setShowModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formIcon, setFormIcon] = useState<'users' | 'shield' | 'activity' | 'credit' | 'custom' | 'alert'>('users');
  const [formTheme, setFormTheme] = useState<'indigo' | 'emerald' | 'blue' | 'purple' | 'amber' | 'rose'>('indigo');

  useEffect(() => {
    localStorage.setItem('pockettclinic_admin_stats_cards', JSON.stringify(cards));
  }, [cards]);

  const handleOpenAdd = () => {
    setEditingCardId(null);
    setFormTitle('');
    setFormValue('');
    setFormIcon('users');
    setFormTheme('indigo');
    setShowModal(true);
  };

  const handleOpenEdit = (card: StatCard) => {
    setEditingCardId(card.id);
    setFormTitle(card.title);
    setFormValue(String(card.value));
    setFormIcon(card.iconType);
    setFormTheme(card.colorTheme);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (cards.length <= 1) {
      showToast("You must keep at least one metric card.", "error");
      return;
    }
    showConfirm({
      title: "Delete Metrics Block",
      message: "Are you sure you want to delete this metrics block?",
      type: 'danger',
      onConfirm: () => {
        setCards(cards.filter(c => c.id !== id));
        showToast("Metric card removed", "success");
      }
    });
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingCardId) {
      setCards(cards.map(c => c.id === editingCardId ? {
        ...c,
        title: formTitle,
        value: formValue,
        iconType: formIcon,
        colorTheme: formTheme
      } : c));
    } else {
      const newCard: StatCard = {
        id: 'card_' + Date.now(),
        title: formTitle,
        value: formValue || '0',
        iconType: formIcon,
        colorTheme: formTheme
      };
      setCards([...cards, newCard]);
    }
    setShowModal(false);
  };

  const resolveValue = (val: string | number) => {
    if (val === 'dynamic_totalUsers') return totalUsers;
    if (val === 'dynamic_verifiedCount') return verifiedCount;
    if (val === 'dynamic_activeSessions') return activeSessionsCount;
    if (val === 'dynamic_errorCount') return criticalErrorsCount;
    return val;
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'shield': return <ShieldCheck size={22} />;
      case 'activity': return <Activity size={22} />;
      case 'credit': return <CreditCard size={22} />;
      case 'alert': return <AlertOctagon size={22} />;
      default: return <Users size={22} />;
    }
  };

  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'emerald':
        return { wrapper: 'border-emerald-200 bg-emerald-50/20', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-950' };
      case 'blue':
        return { wrapper: 'border-slate-300 bg-slate-50/20', icon: 'bg-slate-200 text-slate-600', text: 'text-blue-950' };
      case 'purple':
        return { wrapper: 'border-slate-300 bg-slate-50/20', icon: 'bg-slate-200 text-slate-600', text: 'text-purple-950' };
      case 'amber':
        return { wrapper: 'border-amber-200 bg-amber-50/20', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-950' };
      case 'rose':
        return { wrapper: 'border-rose-200 bg-rose-50/20', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-950' };
      default:
        return { wrapper: 'border-slate-200 bg-white', icon: 'bg-slate-50 text-slate-600', text: 'text-slate-800' };
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dynamic Controls Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-2">
          <Sparkles className="text-slate-600" size={18} />
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dynamic Dashboard Controls</h4>
            <p className="text-[11px] text-slate-600 font-medium">Add, edit, customize, or delete any metrics block freely.</p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
        >
          <Plus size={16} />
          Add Custom Metric Card
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(card => {
          const theme = getThemeClasses(card.colorTheme);
          return (
            <div key={card.id} className={`p-6 rounded-2xl border ${theme.wrapper} shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative group`}>
              {/* Absolute Action Buttons */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                <button
                  onClick={() => handleOpenEdit(card)}
                  className="p-1.5 text-slate-600 hover:text-slate-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="Edit Card"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete Card"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme.icon}`}>
                  {renderIcon(card.iconType)}
                </div>
                <div>
                  <p className="text-xs text-slate-600 font-bold uppercase tracking-wider mb-1">{card.title}</p>
                  <p className={`text-3xl font-black ${theme.text}`}>
                    {isLoading ? '-' : resolveValue(card.value)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-800">
                {editingCardId ? 'Edit Metric Card' : 'Add Custom Metric Card'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Card Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Daily Revenue"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Value or Dynamic Binding</label>
                <input
                  type="text"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder="e.g. GH₵ 4,500 or dynamic_totalUsers"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[10px] text-slate-500 mt-1">Use <code className="bg-white px-1 py-0.5 rounded">dynamic_totalUsers</code>, <code className="bg-white px-1 py-0.5 rounded">dynamic_verifiedCount</code>, or <code className="bg-white px-1 py-0.5 rounded">dynamic_activeSessions</code> for real-time bindings.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Icon Type</label>
                  <select
                    value={formIcon}
                    onChange={e => setFormIcon(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="users">Users</option>
                    <option value="shield">Shield Check</option>
                    <option value="activity">Activity</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Color Theme</label>
                  <select
                    value={formTheme}
                    onChange={e => setFormTheme(e.target.value as any)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="indigo">Indigo</option>
                    <option value="emerald">Emerald</option>
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-xl font-bold text-xs text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-md cursor-pointer"
                >
                  {editingCardId ? 'Update Card' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
