import React, { useState, useRef, useEffect } from 'react';
import { Plus, Camera, Upload, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PatientFloatingActionMenu({ onScanChange, isProcessing }: { onScanChange: (e: React.ChangeEvent<HTMLInputElement>, type?: 'scan' | 'upload') => void, isProcessing: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setIsOpen(!isOpen);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="absolute bottom-4 right-4 z-[200] flex flex-col items-end" ref={menuRef}>
      {/* Hidden file inputs */}
      <input type="file" accept="image/*" capture="environment" onChange={(e) => { setIsOpen(false); onScanChange(e, 'scan'); }} ref={scanRef} className="hidden" />
      <input type="file" accept="image/*" onChange={(e) => { setIsOpen(false); onScanChange(e, 'upload'); }} ref={uploadRef} className="hidden" />

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="flex flex-col mb-3 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl min-w-[140px]"
          >
            <button 
              onClick={() => scanRef.current?.click()}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white font-semibold text-xs transition-colors active:scale-95"
            >
              <Camera size={16} className="text-emerald-400" />
              <span>Scan</span>
            </button>
            <button 
              onClick={() => uploadRef.current?.click()}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-white font-semibold text-xs transition-colors active:scale-95"
            >
              <Upload size={16} className="text-indigo-400" />
              <span>Upload</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={toggleOpen}
        disabled={isProcessing}
        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-300 border border-white/15 ${isOpen ? 'bg-slate-700' : 'bg-slate-900/80 backdrop-blur-md hover:bg-slate-800 active:scale-90'} ${isProcessing ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : (isOpen ? <X size={18} /> : <Plus size={18} />)}
      </button>
    </div>
  );
}
