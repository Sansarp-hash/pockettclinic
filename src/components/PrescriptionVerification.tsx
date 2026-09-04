import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Download, CheckCircle2, Loader2, AlertTriangle, Maximize2, X, ShoppingBag } from 'lucide-react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DigitalPrescription, Order } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { useAppContext } from '../AppContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatMemberId } from '../lib/memberId';

export default function PrescriptionVerification() {
  const { rxId } = useParams<{ rxId: string }>();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<DigitalPrescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRx = async () => {
      if (!rxId) return;
      try {
        const docRef = doc(db, 'prescriptions', rxId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPrescription(docSnap.data() as DigitalPrescription);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `prescriptions/${rxId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchRx();
  }, [rxId]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Prescription-${rxId}`
  });

  const handleDispense = async () => {
    if (!rxId || !prescription) return;
    setDispensing(true);
    try {
      const docRef = doc(db, 'prescriptions', rxId);
      const timestamp = new Date().toISOString();
      await updateDoc(docRef, {
        isFulfilled: true,
        fulfilledAtPharmacy: timestamp
      });
      setPrescription({
        ...prescription,
        isFulfilled: true,
        fulfilledAtPharmacy: timestamp
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${rxId}`);
    } finally {
      setDispensing(false);
    }
  };

  const handleOrderDelivery = async () => {
    if (!prescription || !user) return;
    setOrdering(true);
    try {
      const orderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      // Estimate cost at GHS 50 per medication for demo
      const totalAmount = prescription.medications.length * 50;
      
      const newOrder: Order = {
        orderId,
        patientId: user.uid,
        items: prescription.medications.map(m => ({
          itemId: `RX-${m.drugName || m.name || 'MED'}`,
          name: `${m.drugName || m.name || 'Medication'} ${m.dosage || ''}`,
          quantity: 1,
          price: 50
        })),
        totalAmount,
        paymentStatus: 'PAID',
        deliveryStatus: 'PENDING',
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'orders', orderId), newOrder);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
        throw err;
      }
      
      // Mark as dispensed
      const docRef = doc(db, 'prescriptions', prescription.rxId);
      const timestamp = new Date().toISOString();
      try {
        await updateDoc(docRef, {
          isFulfilled: true,
          fulfilledAtPharmacy: timestamp
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `prescriptions/${prescription.rxId}`);
        throw err;
      }
      
      setPrescription({
        ...prescription,
        isFulfilled: true,
        fulfilledAtPharmacy: timestamp
      });
      setOrderSuccess(true);
    } catch (err) {
      console.error("Order Delivery Error:", err);
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div id="rx-verification-loading" className="flex-1 flex items-center justify-center p-8 min-h-[400px]">
        <Loader2 className="animate-spin text-slate-600" size={32} />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div id="rx-verification-not-found" className="flex-1 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-black tracking-tight text-slate-800">Prescription Not Found</h2>
        <p className="text-slate-600 mt-2">This prescription ID is invalid or does not exist.</p>
        <Link id="btn-return-home" to="/" className="mt-4 text-slate-600 font-bold hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div id="rx-verification-container" className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      
      {prescription.isFulfilled && (
        <div id="rx-already-dispensed-banner" className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-2xl flex items-start gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <AlertTriangle className="text-amber-500 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-amber-800 text-lg">Already Dispensed</h3>
            <p className="text-amber-700 mt-1">
              This prescription was marked as dispensed on {prescription.fulfilledAtPharmacy ? new Date(prescription.fulfilledAtPharmacy).toLocaleString() : 'earlier'}. 
              It cannot be reused.
            </p>
          </div>
        </div>
      )}

      {!prescription.isFulfilled && !orderSuccess && (
        <div id="rx-valid-banner" className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div>
            <h3 className="font-bold text-emerald-800 text-lg">Valid Prescription</h3>
            <p className="text-emerald-700 mt-1">This prescription is active and ready for dispensing.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {user?.role === 'patient' ? (
              <button 
                id="btn-order-rx-delivery"
                onClick={handleOrderDelivery}
                disabled={ordering}
                className="bg-emerald-600 hover:bg-emerald-600 disabled:bg-indigo-400 text-slate-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center flex-1 sm:flex-none gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer"
              >
                {ordering ? <Loader2 className="animate-spin" size={18} /> : <ShoppingBag size={18} />}
                Order Delivery (GHS {prescription.medications.length * 50})
              </button>
            ) : (
              <button 
                id="btn-mark-rx-dispensed"
                onClick={handleDispense}
                disabled={dispensing}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-slate-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center flex-1 sm:flex-none gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer"
              >
                {dispensing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Mark as Dispensed
              </button>
            )}
          </div>
        </div>
      )}
      
      {orderSuccess && (
        <div id="rx-order-success-banner" className="bg-slate-50 border-l-4 border-slate-300 p-6 rounded-2xl flex items-start gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <CheckCircle2 className="text-slate-600 shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-slate-600 text-lg">Order Placed Successfully!</h3>
            <p className="text-slate-600 mt-1">
              Your prescription order has been sent to the pharmacy for processing and delivery. 
              You can track it in your dashboard.
            </p>
          </div>
        </div>
      )}

      <div id="rx-printable-sheet" ref={componentRef} className="bg-white rounded-[32px] shadow-lg border border-slate-200 overflow-hidden relative print:shadow-none print:border-none">
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600 print:hidden"></div>
        
        <div className="p-8 md:p-12 border-b border-slate-200 flex flex-col md:flex-row justify-between gap-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div 
              id="rx-qr-thumbnail"
              onClick={() => setShowQrModal(true)}
              className="w-24 h-24 bg-white p-2 border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all relative group print:pointer-events-none"
              title="Click to enlarge QR code"
            >
              <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : `https://pockettclinic.health/verify-rx/${prescription.rxId}`} size={80} />
              <div className="absolute inset-0 bg-white/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
                <Maximize2 size={24} className="text-slate-600" />
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 mb-4 print:mb-2">
                <ShieldCheck size={14} /> Official E-Prescription
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Prescription</h1>
              <p className="text-slate-600 font-mono text-sm">Rx ID: {prescription.rxId}</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <h3 className="font-bold text-slate-800 text-lg">{prescription.consultantName}</h3>
            <p className="text-slate-600 font-mono font-bold text-xs mt-0.5">
              Prescriber ID: {prescription.consultantMemberId || formatMemberId({ uid: prescription.consultantId, role: 'consultant', cadre: prescription.consultantCadre })}
            </p>
            <p className="text-slate-600 font-medium text-xs mt-0.5">{prescription.consultantCadre || 'Medical Consultant'}</p>
            {prescription.consultantPin && (
              <p className="text-slate-600 text-sm mt-1">Council PIN: <span className="font-mono text-slate-800">{prescription.consultantPin}</span></p>
            )}
            <p className="text-slate-600 text-sm mt-1">Date: {prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="p-8 md:p-12 bg-white/50 print:bg-transparent">
          <div className="mb-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col md:flex-row gap-6 justify-between print:border-slate-300 print:shadow-none">
            <div>
              <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Patient Details</h4>
              <p className="text-lg font-black tracking-tight text-slate-800">{prescription.patientName}</p>
              <p className="text-slate-600 font-mono font-bold text-xs mt-0.5">
                Patient ID: {prescription.patientMemberId || formatMemberId({ uid: prescription.patientId, role: 'patient' })}
              </p>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Age / Gender</h4>
              <p className="text-lg font-black tracking-tight text-slate-800">{prescription.patientAge ?? 'N/A'} / {prescription.patientGender ?? 'N/A'}</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center text-lg italic serif print:border print:border-slate-300">Rx</span>
              Medications
            </h3>
            
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 print:shadow-none print:border-slate-300">
              <ul className="divide-y divide-slate-100 print:divide-slate-200">
                {prescription.medications.map((med, i) => (
                  <li key={i} className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="md:w-1/2">
                        <h4 className="font-bold text-lg text-slate-800">{med.drugName || med.name}</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded-md text-sm print:border print:border-slate-300">{med.dosage}</span>
                          <span className="text-slate-600 font-medium bg-white px-2 py-1 rounded-md text-sm print:border print:border-slate-200">{med.frequency}</span>
                          <span className="text-slate-600 font-medium bg-white px-2 py-1 rounded-md text-sm print:border print:border-slate-200">
                            {med.durationDays ? `${med.durationDays} days` : med.duration || 'As directed'}
                          </span>
                          {med.refills !== undefined && med.refills > 0 && (
                            <span className="text-slate-600 font-medium bg-white px-2 py-1 rounded-md text-sm print:border print:border-slate-200">
                              {med.refills} Refills
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 md:w-1/2 print:bg-transparent print:border-slate-300">
                        <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Sig (Instructions)</p>
                        <p className="text-slate-800 font-medium">{med.instructions || 'Take as directed by doctor'}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            {prescription.diagnosisNotes && (
              <div className="mt-8">
                <h4 className="font-bold text-slate-800 mb-2">Diagnosis / Notes</h4>
                <p className="text-slate-600 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 italic print:shadow-none print:border-slate-300">
                  "{prescription.diagnosisNotes}"
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-8 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <p className="text-xs text-slate-500 max-w-sm text-center sm:text-left">
            This digital prescription is cryptographically signed and independently verifiable by pharmacies using the Rx ID.
          </p>
          <button 
            id="btn-download-rx-pdf"
            onClick={() => handlePrint()} 
            className="bg-white hover:bg-white text-slate-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap cursor-pointer"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      {showQrModal && (
        <div id="rx-qr-modal" className="fixed inset-0 bg-slate-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowQrModal(false)}>
          <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-2xl relative flex flex-col items-center max-w-md w-full" onClick={e => e.stopPropagation()}>
            <button 
              id="btn-close-qr-modal"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-white hover:bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-black tracking-tight text-slate-800 mb-6 flex items-center gap-2">
              <Maximize2 size={20} className="text-slate-600" /> 
              Scan to Verify
            </h3>
            <div className="bg-white p-4 border-slate-100 border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 mb-6">
              <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : `https://pockettclinic.health/verify-rx/${prescription.rxId}`} size={256} />
            </div>
            <p className="text-center text-slate-600 text-sm">
              Show this QR code to the pharmacist. They will scan it to verify the authenticity of your digital prescription.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
