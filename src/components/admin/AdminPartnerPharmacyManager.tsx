import React, { useState, useEffect } from 'react';
import { Store, Plus, Search, ShieldCheck, MapPin, Phone, Mail, CheckCircle2, XCircle, Trash2, Loader2, Save, X } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface PartnerPharmacy {
  id?: string;
  name: string;
  pcLicenseNo: string; // Pharmacy Council License
  supervisingPharmacist: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  status: 'VERIFIED' | 'PENDING' | 'SUSPENDED';
  isFulfillmentActive: boolean;
}

export default function AdminPartnerPharmacyManager() {
  const { showToast } = useAppContext();
  const [pharmacies, setPharmacies] = useState<PartnerPharmacy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [pcLicenseNo, setPcLicenseNo] = useState('');
  const [supervisingPharmacist, setSupervisingPharmacist] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'partner_pharmacies'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PartnerPharmacy[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() as PartnerPharmacy }));
      setPharmacies(list);
      setIsLoading(false);
    }, (err) => {
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const handleAddPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'partner_pharmacies'), {
        name,
        pcLicenseNo,
        supervisingPharmacist,
        phone,
        email,
        region,
        city,
        status: 'VERIFIED',
        isFulfillmentActive: true,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });

      showToast(`Registered partner pharmacy "${name}".`, "success");
      setShowAddModal(false);
      setName('');
      setPcLicenseNo('');
      setSupervisingPharmacist('');
      setPhone('');
      setEmail('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'partner_pharmacies');
      showToast("Failed to register pharmacy.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pharmacy: PartnerPharmacy) => {
    if (!pharmacy.id) return;
    try {
      await updateDoc(doc(db, 'partner_pharmacies', pharmacy.id), {
        isFulfillmentActive: !pharmacy.isFulfillmentActive
      });
      showToast(`Updated fulfillment state for ${pharmacy.name}`, "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partner_pharmacies/${pharmacy.id}`);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'partner_pharmacies', id));
      showToast("Removed pharmacy partner.", "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `partner_pharmacies/${id}`);
    }
  };

  const filtered = pharmacies.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.pcLicenseNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6">
      {/* Background E-Pharmacy Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black border border-indigo-100 shrink-0">
            <Store size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-800">Partner E-Pharmacies & Fulfillment Directory</h3>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                Background Admin Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Register, audit Pharmacy Council licenses, and manage e-pharmacy network dispatch partners.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          <Plus size={16} /> Add Partner Pharmacy
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Pharmacy Name</th>
              <th className="py-3.5 px-4">PC License No</th>
              <th className="py-3.5 px-4">Supervising Pharmacist</th>
              <th className="py-3.5 px-4">Location</th>
              <th className="py-3.5 px-4">Contact Phone</th>
              <th className="py-3.5 px-4">Fulfillment Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No partner pharmacies registered yet. Click "Add Partner Pharmacy" to onboard a fulfillment store.
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-800">{p.name}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{p.pcLicenseNo}</td>
                  <td className="py-3.5 px-4 text-slate-700">{p.supervisingPharmacist}</td>
                  <td className="py-3.5 px-4 text-slate-600">{p.city}, {p.region}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">{p.phone}</td>
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`px-3 py-1 rounded-full font-bold text-[10px] uppercase cursor-pointer ${
                        p.isFulfillmentActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {p.isFulfillmentActive ? '🟢 Active Dispatch' : '🔴 Inactive'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 min-w-[36px] min-h-[36px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={20} className="text-emerald-400" />
                <h3 className="font-bold text-sm">Onboard Partner E-Pharmacy</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPharmacy} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pharmacy Enterprise Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. TopUp Pharmacy Ghana Ltd"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pharmacy Council License *</label>
                  <input
                    type="text"
                    required
                    value={pcLicenseNo}
                    onChange={e => setPcLicenseNo(e.target.value)}
                    placeholder="PC/GH/8821"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-mono font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supervising Pharmacist</label>
                  <input
                    type="text"
                    required
                    value={supervisingPharmacist}
                    onChange={e => setSupervisingPharmacist(e.target.value)}
                    placeholder="Pharm. K. Annan"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0302123456"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City / Region</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Accra / Kumasi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-3 min-h-[44px] border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
