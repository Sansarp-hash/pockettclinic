import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { useAppContext } from '../AppContext';

interface OcrScannerModalProps {
  consultationId: string;
  onClose: () => void;
  onSuccess?: (extractedText: string, imageUrl: string) => void;
}

export default function OcrScannerModal({ consultationId, onClose, onSuccess }: OcrScannerModalProps) {
  const { showToast } = useAppContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    rawText?: string;
    medications?: { name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }[];
    patientName?: string;
    prescriberName?: string;
    summary?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select a valid image file (JPG, PNG, WEBP).');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processOcr = async () => {
    if (!previewUrl) return;
    setIsScanning(true);
    setErrorMessage(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          imageBase64: previewUrl,
          mimeType: selectedFile?.type || 'image/jpeg'
        })
      });

      if (!response.ok) {
        throw new Error('OCR API request failed');
      }

      const data = await response.json();
      if (data.result) {
        setOcrResult(data.result);
      } else {
        throw new Error('No readable text returned from OCR analysis');
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMessage(err.message || 'Failed to scan document. Please ensure the image is clear.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveToConsultation = async () => {
    if (!ocrResult) return;

    try {
      let uploadedImageUrl = previewUrl;

      // Upload image to Firebase storage if file selected
      if (selectedFile) {
        const storageRef = ref(storage, `ocr_documents/${consultationId}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        uploadedImageUrl = await getDownloadURL(storageRef);
      }

      const formattedOcrText = JSON.stringify(ocrResult, null, 2);

      // Save to Firestore consultation record
      const consultRef = doc(db, 'consultations', consultationId);
      await updateDoc(consultRef, {
        ocrExtractedText: formattedOcrText,
        ocrImageUrl: uploadedImageUrl
      });

      // Also post message to chat sub-collection for visibility
      const msgId = Math.random().toString(36).substring(2, 9).toUpperCase();
      await setDoc(doc(db, 'consultations', consultationId, 'messages', msgId), {
        messageId: msgId,
        consultationId,
        senderId: 'system_ocr',
        senderRole: 'patient',
        senderName: 'Patient Attachment (OCR Scanned)',
        text: `📋 **Scanned Prescription / Lab Slip Analysis:**\n${ocrResult.summary || ''}\n\n**Extracted Items:**\n${(ocrResult.medications || []).map(m => `• ${m.name} ${m.dosage || ''} (${m.frequency || ''}) - ${m.instructions || ''}`).join('\n')}`,
        attachmentUrl: uploadedImageUrl,
        timestamp: new Date().toISOString()
      });

      if (onSuccess && uploadedImageUrl) {
        onSuccess(formattedOcrText, uploadedImageUrl);
      }
      onClose();
    } catch (err) {
      console.error('Error saving OCR result:', err);
      showToast('Failed to attach document to consultation history.', "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[32px] max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-600">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Prescription & Lab OCR Scanner</h3>
              <p className="text-xs text-slate-600 font-medium">Extract handwritten prescriptions, lab slips, or medication boxes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-600 rounded-full hover:bg-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* File Upload Box */}
          {!ocrResult && (
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Upload Document Image
              </label>
              <div className="border-slate-100 border-dashed border-slate-300 hover:border-slate-300 bg-slate-50/30 rounded-2xl p-6 text-center transition-colors relative cursor-pointer flex flex-col items-center justify-center min-h-[200px]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {previewUrl ? (
                  <div className="relative group w-full flex flex-col items-center">
                    <img src={previewUrl} alt="Document Preview" className="max-h-56 rounded-xl object-contain shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 mb-3" />
                    <p className="text-xs text-slate-600 font-bold">Click or tap to replace image</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center text-slate-600 mb-3 border border-indigo-100">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-bold text-slate-800">Drop prescription photo or tap to browse</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Supports JPG, PNG, WEBP (Handwritten or printed)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button: Perform OCR */}
          {previewUrl && !ocrResult && (
            <button
              onClick={processOcr}
              disabled={isScanning}
              className="w-full bg-emerald-600 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isScanning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Scanning Handwriting & Medical Terms...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Scan & Parse Prescription</span>
                </>
              )}
            </button>
          )}

          {/* OCR Extracted Results Card */}
          {ocrResult && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-900 text-xs font-bold">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Handwriting parsed successfully! Review extracted clinical details below.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Original Attachment</p>
                  {previewUrl && (
                    <img src={previewUrl} alt="Scanned Attachment" className="max-h-48 rounded-lg object-cover shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60" />
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 max-h-56 overflow-y-auto">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                    <FileText size={14} className="text-slate-600" /> Extracted Medications ({ocrResult.medications?.length || 0})
                  </h4>
                  {ocrResult.medications && ocrResult.medications.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {ocrResult.medications.map((m, idx) => (
                        <li key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200">
                          <p className="font-bold text-indigo-950">{m.name} <span className="text-slate-600 font-medium">{m.dosage}</span></p>
                          <p className="text-slate-600 text-[11px] font-medium">{m.frequency} • {m.instructions}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-600 whitespace-pre-wrap">{ocrResult.rawText}</p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Clinical Summary</p>
                <p className="text-xs text-slate-800 mt-1 font-medium leading-relaxed">{ocrResult.summary}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setOcrResult(null)}
                  className="px-4 py-3 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
                >
                  Rescan
                </button>
                <button
                  onClick={handleSaveToConsultation}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-600 text-white text-xs font-bold py-3 px-6 rounded-2xl transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Attach to Consultation Room & History</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
