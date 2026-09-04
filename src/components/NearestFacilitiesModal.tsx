import React from 'react';
import { X, Building2, Phone, MapPin, ExternalLink } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NearestFacilitiesModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  const facilities = [
    { name: 'Korle Bu Teaching Hospital', location: 'Accra, Greater Accra', phone: '+233 30 267 4072', type: 'Tertiary Emergency Hospital' },
    { name: 'Komfo Anokye Teaching Hospital', location: 'Kumasi, Ashanti', phone: '+233 32 202 2301', type: 'Tertiary Emergency Hospital' },
    { name: '37 Military Hospital', location: 'Accra, Greater Accra', phone: '+233 30 277 6111', type: 'Emergency Hospital Ward' },
    { name: 'Ridge Hospital (Greater Accra Regional)', location: 'Accra, Greater Accra', phone: '+233 30 222 8382', type: 'Regional Referral Facility' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-base text-slate-800">Emergency Hospital Wards (Ghana)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          In emergency situations, dial <strong className="text-rose-600 font-extrabold">112 / 193</strong> or go directly to the nearest emergency ward:
        </p>

        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {facilities.map((f, i) => (
            <div key={i} className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-slate-800">{f.name}</h4>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">{f.type}</span>
              </div>
              <p className="text-slate-600 flex items-center gap-1"><MapPin size={12} /> {f.location}</p>
              <p className="text-slate-800 font-semibold flex items-center gap-1"><Phone size={12} className="text-slate-600" /> {f.phone}</p>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full py-2.5 bg-white hover:bg-white text-slate-600 rounded-xl font-bold text-xs">
          Close Facilities List
        </button>
      </div>
    </div>
  );
}
