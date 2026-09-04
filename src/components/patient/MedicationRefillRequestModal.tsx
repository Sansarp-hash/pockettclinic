import React, { useState } from 'react';
import { Pill, X, CheckCircle2, Loader2, Send, MapPin, Phone } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAppContext } from '../../AppContext';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

interface MedicationRefillRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription?: any;
}

export default function MedicationRefillRequestModal({
  isOpen,
  onClose,
  prescription
}: MedicationRefillRequestModalProps) {
  const { user, showToast } = useAppContext();
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmitRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    try {
      const refillId = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await addDoc(collection(db, 'refill_requests'), {
        refillId,
        patientId: user.uid || user.id,
        patientName: user.fullName || user.displayName || 'Patient',
        patientPhone: deliveryPhone,
        deliveryAddress,
        prescriptionId: prescription?.id || 'DIRECT_REFILL',
        medicationsList: prescription?.medications || [
          { name: 'Amoxicillin 500mg', dosage: '1 cap TDS x 7 days' },
          { name: 'Paracetamol 500mg', dosage: '2 tabs BD x 3 days' }
        ],
        notes,
        status: 'PENDING_PARTNER_FULFILLMENT',
        createdAt: new Date().toISOString(),
        serverCreatedAt: serverTimestamp()
      });

      showToast(`Refill Request #${refillId} sent to partner pharmacy network!`, "success");
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'refill_requests');
      showToast("Failed to submit refill request.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Pill size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Medication Refill Re-Order</h3>
              <p className="text-[11px] text-slate-400">Request e-pharmacy dispatch for active prescriptions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmitRefill} className="p-5 space-y-4 text-xs">
          {/* Medications Summary Box */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prescription Items for Dispatch</span>
            {prescription?.medications ? (
              <ul className="space-y-1 text-slate-700 font-semibold">
                {prescription.medications.map((m: any, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{m.name || m.medicationName} — <span className="text-slate-500 font-normal">{m.dosage || m.frequency}</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600 font-medium">Standard Maintenance Refill Package (Partner Pharmacy Fullfilment)</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <MapPin size={12} className="text-emerald-600" /> Delivery Address / Location *
            </label>
            <input
              type="text"
              required
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              placeholder="e.g. Hse 42, Independence Avenue, Airport Residential, Accra"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Phone size={12} className="text-emerald-600" /> Dispatch Contact Phone *
            </label>
            <input
              type="text"
              required
              value={deliveryPhone}
              onChange={e => setDeliveryPhone(e.target.value)}
              placeholder="e.g. 0244123456"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[44px] font-bold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Additional Pharmacist Instructions</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Please call before rider dispatch"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-800 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 min-h-[44px] border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Submit Refill Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
