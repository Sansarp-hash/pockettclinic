import React, { useState, useEffect } from 'react';
import { Pill, FileText, Search, CheckCircle2, Edit3, Trash2, Eye, ShieldCheck, Filter, AlertCircle, Save, X, Loader2, HeartPulse, Download, FileSpreadsheet } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function AdminClinicalPrescriptionVault() {
  const { showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'vault'>('prescriptions');
  
  // Prescriptions State
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [rxSearchQuery, setRxSearchQuery] = useState('');
  const [editingRx, setEditingRx] = useState<any | null>(null);
  const [isSavingRx, setIsSavingRx] = useState(false);

  // Medical Vault State
  const [vaultRecords, setVaultRecords] = useState<any[]>([]);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [selectedVaultDoc, setSelectedVaultDoc] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to prescriptions
    const qRx = query(collection(db, 'prescriptions'));
    const unsubRx = onSnapshot(qRx, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ rxId: d.id, id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPrescriptions(list);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'prescriptions');
      setIsLoading(false);
    });

    // Listen to medical vault uploads
    const qVault = query(collection(db, 'medical_vault'));
    const unsubVault = onSnapshot(qVault, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ docId: d.id, id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.uploadedAt || b.createdAt || 0).getTime() - new Date(a.uploadedAt || a.createdAt || 0).getTime());
      setVaultRecords(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'medical_vault');
    });

    return () => {
      unsubRx();
      unsubVault();
    };
  }, []);

  // Handle Prescription Correction
  const handleSaveRxEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRx) return;
    setIsSavingRx(true);
    try {
      await updateDoc(doc(db, 'prescriptions', editingRx.rxId || editingRx.id), {
        medications: editingRx.medications,
        notes: editingRx.notes,
        isFulfilled: editingRx.isFulfilled,
        status: editingRx.status || 'valid',
        correctedByAdminAt: new Date().toISOString()
      });
      showToast(`Prescription Rx #${editingRx.rxId} corrected & updated.`, "success");
      setEditingRx(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${editingRx.rxId}`);
      showToast("Failed to update prescription.", "error");
    } finally {
      setIsSavingRx(false);
    }
  };

  // Toggle Vault Tag Status
  const handleUpdateVaultTag = async (docId: string, tag: 'verified' | 'flagged' | 'archived') => {
    try {
      await updateDoc(doc(db, 'medical_vault', docId), {
        complianceTag: tag,
        updatedAt: new Date().toISOString()
      });
      showToast(`Vault document compliance tag updated to '${tag.toUpperCase()}'.`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `medical_vault/${docId}`);
      showToast("Failed to update vault tag.", "error");
    }
  };

  // Delete Vault Doc
  const handleDeleteVaultDoc = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'medical_vault', docId));
      showToast("Vault record deleted.", "info");
      setSelectedVaultDoc(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `medical_vault/${docId}`);
      showToast("Failed to delete record.", "error");
    }
  };

  const filteredRx = prescriptions.filter(p => {
    const query = rxSearchQuery.toLowerCase().trim();
    const rxId = (p.rxId || p.id || '').toLowerCase();
    const patient = (p.patientName || '').toLowerCase();
    const doctor = (p.consultantName || '').toLowerCase();
    return !query || rxId.includes(query) || patient.includes(query) || doctor.includes(query);
  });

  const filteredVault = vaultRecords.filter(v => {
    const query = vaultSearchQuery.toLowerCase().trim();
    const name = (v.title || v.fileName || '').toLowerCase();
    const patient = (v.patientName || v.patientId || '').toLowerCase();
    return !query || name.includes(query) || patient.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Tab Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'prescriptions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Pill size={16} /> e-Prescription Audit & OCR Correction
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'vault'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <FileText size={16} /> Medical Vault Compliance Manager
          </button>
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          {activeTab === 'prescriptions' ? `${prescriptions.length} Prescriptions` : `${vaultRecords.length} Vault Uploads`}
        </span>
      </div>

      {/* PRESCRIPTIONS AUDIT & OCR CORRECTION PANEL */}
      {activeTab === 'prescriptions' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Pill size={22} className="text-emerald-600" /> Electronic Prescription Ledger
              </h3>
              <p className="text-xs text-slate-500 mt-1">Review e-slips, correct OCR drug name errors, or invalidate unfulfilled prescriptions.</p>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={rxSearchQuery}
                onChange={e => setRxSearchQuery(e.target.value)}
                placeholder="Search Rx ID, patient, doctor..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6">Rx ID & Date</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Prescribing Consultant</th>
                  <th className="py-3.5 px-4">Medications Listed</th>
                  <th className="py-3.5 px-4">Fulfillment Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRx.map(p => (
                  <tr key={p.rxId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-800">
                      <div>
                        <span>#{p.rxId}</span>
                        <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-800">
                      {p.patientName || 'Patient'}
                    </td>

                    <td className="py-4 px-4 font-medium text-slate-700">
                      {p.consultantName || 'Consultant'}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.medications || []).map((m: any, idx: number) => (
                          <span key={idx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            {m.drugName || m.name} ({m.dosage})
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        p.status === 'invalid' 
                          ? 'bg-rose-100 text-rose-800' 
                          : p.isFulfilled 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status === 'invalid' ? 'Invalidated' : p.isFulfilled ? 'Fulfilled' : 'Active Valid Rx'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setEditingRx({ ...p })}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit / Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MEDICAL VAULT COMPLIANCE PANEL */}
      {activeTab === 'vault' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText size={22} className="text-indigo-600" /> Patient Medical Vault Directory
              </h3>
              <p className="text-xs text-slate-500 mt-1">Audit uploaded lab results, imaging files, and vaccination records across patient accounts.</p>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={vaultSearchQuery}
                onChange={e => setVaultSearchQuery(e.target.value)}
                placeholder="Search file name, patient UID..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6">Document Title / File</th>
                  <th className="py-3.5 px-4">Patient Reference</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4">Compliance Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredVault.map(v => (
                  <tr key={v.docId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-indigo-600 shrink-0" />
                        <div>
                          <span>{v.title || v.fileName || 'Medical Document'}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">{v.fileType || 'PDF / Image'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-700">
                      {v.patientName || v.patientId || 'Patient'}
                    </td>

                    <td className="py-4 px-4 text-slate-500">
                      {v.uploadedAt ? new Date(v.uploadedAt).toLocaleDateString() : 'Recent'}
                    </td>

                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        v.complianceTag === 'verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : v.complianceTag === 'flagged'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {v.complianceTag || 'Unaudited'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => setSelectedVaultDoc(v)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={13} /> Inspect
                      </button>
                      <button
                        onClick={() => handleDeleteVaultDoc(v.docId)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT PRESCRIPTION MODAL */}
      {editingRx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill size={20} className="text-emerald-400" />
                <h3 className="font-bold text-base">Edit & Correct Prescription #{editingRx.rxId}</h3>
              </div>
              <button onClick={() => setEditingRx(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRxEdits} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prescription Status</label>
                <select
                  value={editingRx.status || 'valid'}
                  onChange={e => setEditingRx({ ...editingRx, status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 outline-none"
                >
                  <option value="valid">Valid Active Prescription</option>
                  <option value="invalid">Invalidated / Voided</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Medications List</label>
                <div className="space-y-3">
                  {(editingRx.medications || []).map((med: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={med.drugName || med.name || ''}
                          onChange={e => {
                            const newMeds = [...editingRx.medications];
                            newMeds[i].drugName = e.target.value;
                            setEditingRx({ ...editingRx, medications: newMeds });
                          }}
                          placeholder="Drug Name"
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 outline-none"
                        />
                        <input
                          type="text"
                          value={med.dosage || ''}
                          onChange={e => {
                            const newMeds = [...editingRx.medications];
                            newMeds[i].dosage = e.target.value;
                            setEditingRx({ ...editingRx, medications: newMeds });
                          }}
                          placeholder="Dosage (e.g. 500mg)"
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prescription Notes / Instructions</label>
                <textarea
                  rows={3}
                  value={editingRx.notes || ''}
                  onChange={e => setEditingRx({ ...editingRx, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRx(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRx}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  {isSavingRx ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Corrections
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT VAULT DOCUMENT MODAL */}
      {selectedVaultDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-indigo-400" />
                <h3 className="font-bold text-base">{selectedVaultDoc.title || 'Inspect Vault Document'}</h3>
              </div>
              <button onClick={() => setSelectedVaultDoc(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">File Details</span>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{selectedVaultDoc.fileName || selectedVaultDoc.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Patient UID: {selectedVaultDoc.patientId}</p>
              </div>

              {selectedVaultDoc.fileUrl && (
                <div className="aspect-video bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden">
                  {selectedVaultDoc.fileUrl.startsWith('data:image') ? (
                    <img src={selectedVaultDoc.fileUrl} alt="Vault Preview" className="w-full h-full object-contain" />
                  ) : (
                    <a
                      href={selectedVaultDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-2"
                    >
                      <Download size={14} /> Open Document File
                    </a>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Set Compliance Tag</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateVaultTag(selectedVaultDoc.docId, 'verified')}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    ✓ Mark Verified
                  </button>
                  <button
                    onClick={() => handleUpdateVaultTag(selectedVaultDoc.docId, 'flagged')}
                    className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold rounded-xl transition-all cursor-pointer"
                  >
                    ⚠ Flag Non-Compliant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
