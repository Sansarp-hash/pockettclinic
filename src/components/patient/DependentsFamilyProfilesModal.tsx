import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Heart, Calendar, Trash2, X, Plus, Save, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface Dependent {
  id?: string;
  fullName: string;
  relationship: 'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING' | 'OTHER';
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  allergies?: string;
  medicalConditions?: string;
}

interface DependentsFamilyProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDependentForBooking?: (dependent: Dependent) => void;
}

export default function DependentsFamilyProfilesModal({
  isOpen,
  onClose,
  onSelectDependentForBooking
}: DependentsFamilyProfilesModalProps) {
  const { user, showToast } = useAppContext();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<'CHILD' | 'SPOUSE' | 'PARENT' | 'SIBLING' | 'OTHER'>('CHILD');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('FEMALE');
  const [allergies, setAllergies] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');

  useEffect(() => {
    if (!user || !isOpen) return;
    const userId = user.uid || user.id;
    const q = query(collection(db, 'patient_dependents'), where('patientId', '==', userId));

    const unsub = onSnapshot(q, (snap) => {
      const list: Dependent[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() as Dependent }));
      setDependents(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'patient_dependents');
      setIsLoading(false);
    });

    return () => unsub();
  }, [user?.uid, isOpen]);

  if (!isOpen) return null;

  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const userId = user.uid || user.id;
      await addDoc(collection(db, 'patient_dependents'), {
        patientId: userId,
        fullName,
        relationship,
        dateOfBirth,
        gender,
        allergies,
        medicalConditions,
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });

      showToast(`Added ${fullName} to family profiles.`, "success");
      setShowAddForm(false);
      setFullName('');
      setAllergies('');
      setMedicalConditions('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'patient_dependents');
      showToast("Failed to add family member.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDependent = async (id?: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'patient_dependents', id));
      showToast("Removed family member profile.", "info");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `patient_dependents/${id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Family & Dependents Profiles</h3>
              <p className="text-[11px] text-slate-400">Book virtual consultations on behalf of family members</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {!showAddForm ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved Family Members ({dependents.length})</span>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus size={14} /> Add Family Profile
                </button>
              </div>

              {dependents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 font-medium">
                  No family members added yet. Click "Add Family Profile" to create dependent profiles.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {dependents.map(dep => (
                    <div key={dep.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                          <span>{dep.fullName}</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full uppercase">
                            {dep.relationship}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          DOB: {dep.dateOfBirth || 'N/A'} • Gender: {dep.gender}
                        </p>
                        {dep.allergies && (
                          <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                            Allergies: {dep.allergies}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onSelectDependentForBooking && (
                          <button
                            onClick={() => {
                              onSelectDependentForBooking(dep);
                              onClose();
                            }}
                            className="px-3 py-2 min-h-[38px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] cursor-pointer"
                          >
                            Book For Them
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteDependent(dep.id)}
                          className="p-2 min-w-[38px] min-h-[38px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleAddDependent} className="space-y-3">
              <h4 className="font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1">
                <UserPlus size={14} className="text-emerald-600" /> New Dependent Details
              </h4>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Kwame Mensah Jr."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Relationship</label>
                  <select
                    value={relationship}
                    onChange={e => setRelationship(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                  >
                    <option value="CHILD">Child / Minor</option>
                    <option value="SPOUSE">Spouse / Partner</option>
                    <option value="PARENT">Parent / Elderly</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Other Relative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Known Allergies / Pre-Existing Conditions</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin Allergy, Asthma"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-medium text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-3 min-h-[44px] border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Profile
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
