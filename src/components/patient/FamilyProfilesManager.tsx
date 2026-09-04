import React, { useState, useEffect } from 'react';
import { Users, Plus, UserPlus, Heart, Shield, X, Check, ChevronRight, AlertCircle, Baby, UserCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { FamilyMember } from '../../types';

interface FamilyProfilesManagerProps {
  primaryPatientId: string;
  primaryPatientName: string;
  selectedDependentId: string | null;
  onSelectDependent: (dependent: FamilyMember | null) => void;
}

export default function FamilyProfilesManager({
  primaryPatientId,
  primaryPatientName,
  selectedDependentId,
  onSelectDependent,
}: FamilyProfilesManagerProps) {
  const [dependents, setDependents] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<FamilyMember['relationship']>('CHILD');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<FamilyMember['gender']>('MALE');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!primaryPatientId) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'family_members'),
      where('primaryPatientId', '==', primaryPatientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: FamilyMember[] = [];
      snapshot.forEach(docSnap => {
        list.push({ memberId: docSnap.id, ...docSnap.data() } as FamilyMember);
      });
      setDependents(list);
      setIsLoading(false);
    }, (err) => {
      console.warn("Firestore family members error, using local state:", err);
      if (dependents.length === 0) {
        setDependents([
          {
            memberId: 'dep_1',
            patientId: primaryPatientId,
            primaryPatientId,
            fullName: 'Kweku Mensah',
            relationship: 'CHILD',
            age: 6,
            gender: 'MALE',
            bloodGroup: 'A+',
            allergies: ['Penicillin', 'Peanuts'],
            chronicConditions: ['Asthma (Mild)'],
            emergencyContactPhone: '+233 24 123 4567',
            createdAt: new Date().toISOString()
          },
          {
            memberId: 'dep_2',
            patientId: primaryPatientId,
            primaryPatientId,
            fullName: 'Nana Ama Pokuaa',
            relationship: 'PARENT',
            age: 68,
            gender: 'FEMALE',
            bloodGroup: 'O+',
            allergies: ['Sulfa drugs'],
            chronicConditions: ['Hypertension', 'Type 2 Diabetes'],
            emergencyContactPhone: '+233 20 987 6543',
            createdAt: new Date().toISOString()
          }
        ]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [primaryPatientId]);

  const handleCreateDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) return;

    setIsSubmitting(true);
    const newId = `dep_${Date.now()}`;
    const newMember: FamilyMember = {
      memberId: newId,
      patientId: primaryPatientId,
      primaryPatientId,
      fullName,
      relationship,
      age: age ? Number(age) : undefined,
      gender,
      bloodGroup,
      allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
      chronicConditions: chronicConditions.split(',').map(c => c.trim()).filter(Boolean),
      emergencyContactPhone: emergencyPhone,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'family_members', newId), newMember);
      setDependents(prev => [...prev, newMember]);
      setIsAddModalOpen(false);
      // Auto select newly created dependent
      onSelectDependent(newMember);
      // Reset form
      setFullName('');
      setAge('');
      setAllergies('');
      setChronicConditions('');
      setEmergencyPhone('');
    } catch (err) {
      console.warn("Could not save dependent to firestore:", err);
      setDependents(prev => [...prev, newMember]);
      onSelectDependent(newMember);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRelationshipIcon = (rel: FamilyMember['relationship']) => {
    switch (rel) {
      case 'CHILD': return <Baby size={14} className="text-pink-500" />;
      case 'PARENT': return <Heart size={14} className="text-red-500" />;
      default: return <UserCheck size={14} className="text-slate-600" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-emerald-600" />
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">
              Family & Dependent Profiles
            </h3>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Switch profile to manage consultations, medication schedules, and vitals for your loved ones.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
        >
          <UserPlus size={14} />
          <span>Add Family Member</span>
        </button>
      </div>

      {/* Profile Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Primary Account Holder Pill */}
        <button
          onClick={() => onSelectDependent(null)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            selectedDependentId === null
              ? 'bg-white text-slate-600 shadow-md shadow-slate-900/20'
              : 'bg-white hover:bg-slate-50 text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Myself ({primaryPatientName || 'Primary'})</span>
        </button>

        {/* Dependents Pills */}
        {dependents.map(dep => {
          const isSelected = selectedDependentId === dep.memberId;
          return (
            <button
              key={dep.memberId}
              onClick={() => onSelectDependent(dep)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white hover:bg-slate-50 text-slate-800'
              }`}
            >
              {getRelationshipIcon(dep.relationship)}
              <span>{dep.fullName}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md uppercase font-black ${
                isSelected ? 'bg-emerald-700 text-slate-600' : 'bg-slate-50 text-slate-600'
              }`}>
                {dep.relationship}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Dependent Info Strip */}
      {selectedDependentId && (
        <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
          {(() => {
            const activeDep = dependents.find(d => d.memberId === selectedDependentId);
            if (!activeDep) return null;
            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-950">Active Dependent: {activeDep.fullName}</span>
                  {activeDep.age && <span className="text-emerald-700 font-medium">({activeDep.age} yrs, {activeDep.gender})</span>}
                  {activeDep.bloodGroup && (
                    <span className="bg-emerald-200/80 text-emerald-900 font-black px-2 py-0.5 rounded text-[10px]">
                      Blood: {activeDep.bloodGroup}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-800">
                  {activeDep.allergies && activeDep.allergies.length > 0 && (
                    <span className="mr-3 font-semibold text-rose-700">Allergies: {activeDep.allergies.join(', ')}</span>
                  )}
                  {activeDep.chronicConditions && activeDep.chronicConditions.length > 0 && (
                    <span className="font-semibold text-slate-800">Conditions: {activeDep.chronicConditions.join(', ')}</span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Add Dependent Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                  <Users size={20} />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-800">Add Dependent Profile</h4>
                  <p className="text-xs text-slate-600">Book care & manage health for family members</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateDependent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kweku Mensah, Nana Yaa Pokuaa"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Relationship *</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="CHILD">Child / Infant</option>
                    <option value="PARENT">Parent / Elderly</option>
                    <option value="SPOUSE">Spouse / Partner</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Other Dependent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Age (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 5 or 68"
                    value={age}
                    onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-)</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="A-">A Negative (A-)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="B-">B Negative (B-)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                    <option value="AB-">AB Negative (AB-)</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Known Drug or Food Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa, Peanuts"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Chronic Conditions / Health Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Asthma, Hypertension, Sickle Cell"
                  value={chronicConditions}
                  onChange={(e) => setChronicConditions(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-all"
                >
                  {isSubmitting ? 'Creating...' : 'Add Dependent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
