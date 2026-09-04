import React, { useRef, useState } from "react";
import { Camera, ShieldCheck, ShieldAlert, Award, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface DualFaceBiometricsProps {}

export default function DualFaceBiometrics({}: DualFaceBiometricsProps) {
  const [face1Base64, setFace1Base64] = useState<string | null>(null);
  const [face2Base64, setFace2Base64] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<1 | 2 | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async (slot: 1 | 2) => {
    setIsCapturing(slot);
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera access failed in dual face match:", err.message);
      setErrorMsg("Unable to access camera in this frame. Please upload a picture instead.");
      setIsCapturing(null);
    }
  };

  const capturePhoto = (slot: 1 | 2) => {
    if (!videoRef.current || !streamRef.current) return;
    
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(320, 0);
        ctx.scale(-1, 1); // mirror capture
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const dataUrl = canvas.toDataURL("image/jpeg");
        
        if (slot === 1) setFace1Base64(dataUrl);
        else setFace2Base64(dataUrl);
      }
    } catch (e: any) {
      console.error("Capture photo error:", e);
    } finally {
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        if (track && typeof track.stop === 'function') {
          track.stop();
        }
      });
      streamRef.current = null;
    }
    setIsCapturing(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (slot === 1) setFace1Base64(base64);
        else setFace2Base64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const runComparison = async () => {
    if (!face1Base64 || !face2Base64) {
      setErrorMsg("Please provide both Face 1 (Official ID) and Face 2 (Live Selfie) to run the audit.");
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("idToken") || "auth_token";
      const response = await fetch("/api/admin/compare-faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ face1: face1Base64, face2: face2Base64 })
      });

      const data = await response.json();
      if (response.status !== 200 || data.error) {
        throw new Error(data.error || "Biometric comparison API rejected the request.");
      }
      setResult(data);
    } catch (err: any) {
      console.warn("Dual face comparison failed:", err.message);
      setErrorMsg(`Compliance API Error: ${err.message}. Please check your connection or system logs.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h4 className="font-bold text-slate-800 text-sm">Dual-Face Biometric Audit Verification</h4>
        <p className="text-xs text-slate-600 mt-1">
          Perform a dual-face biometric matching comparison of a consultant's GMC Licence Photo with their active consultation video feed selfie to secure compliance.
        </p>
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Face 1 Slot */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 tracking-wide uppercase">
            Face 1: Official Licence ID Photo
          </label>
          
          <div className="relative h-44 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden">
            {face1Base64 ? (
              <img src={face1Base64} className="w-full h-full object-cover" alt="ID Licence Photo" />
            ) : (
              <div className="text-center p-4 space-y-2">
                <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-600">Capture ID Card photo</p>
              </div>
            )}

            {/* Quick Overlays */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2">
              <button
                onClick={() => startCamera(1)}
                className="px-2.5 py-1.5 bg-white/80 hover:bg-white text-slate-600 rounded-lg text-[10px] font-bold backdrop-blur-xs transition-all"
              >
                Snap ID
              </button>
              <label className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                Upload
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 1)} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Face 2 Slot */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-800 tracking-wide uppercase">
            Face 2: Active Profile Selfie Capture
          </label>
          
          <div className="relative h-44 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden">
            {face2Base64 ? (
              <img src={face2Base64} className="w-full h-full object-cover transform scale-x-[-1]" alt="Live Profile Selfie" />
            ) : (
              <div className="text-center p-4 space-y-2">
                <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-600">Capture Live Video selfie</p>
              </div>
            )}

            {/* Quick Overlays */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2">
              <button
                onClick={() => startCamera(2)}
                className="px-2.5 py-1.5 bg-white/80 hover:bg-white text-slate-600 rounded-lg text-[10px] font-bold backdrop-blur-xs transition-all"
              >
                Snap Selfie
              </button>
              <label className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                Upload
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 2)} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Camera Capture Module */}
      {isCapturing && (
        <div className="bg-white p-4 rounded-xl space-y-3 flex flex-col items-center border border-slate-200">
          <div className="relative w-72 h-56 bg-white rounded-lg overflow-hidden border border-slate-200">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-600 text-[10px] font-bold text-slate-600 rounded">
              Active Camera Room
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => capturePhoto(isCapturing)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              Capture Snapshot {isCapturing}
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-white hover:bg-slate-750 text-slate-500 font-bold text-xs rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Call to action */}
      <button
        onClick={runComparison}
        disabled={isLoading || !face1Base64 || !face2Base64}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing facial landmark contours & computing biometric match...
          </>
        ) : (
          <>
            <Award className="w-4 h-4" />
            Audit Biometrics Match Analysis
          </>
        )}
      </button>

      {errorMsg && (
        <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Results panel */}
      {result && (
        <div className={`p-5 rounded-xl border flex flex-col sm:flex-row items-center sm:items-start gap-4 transition-all ${
          result.isMatch ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
        }`}>
          <div className="flex-shrink-0">
            {result.isMatch ? (
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-full">
                <ShieldCheck className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-3 bg-rose-100 text-rose-800 rounded-full">
                <ShieldAlert className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="space-y-1.5 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h5 className={`font-bold text-sm ${result.isMatch ? "text-emerald-800" : "text-rose-800"}`}>
                {result.isMatch ? "Compliance Biometrics Passed" : "Biometrics Discrepancy Found"}
              </h5>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                result.isMatch ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
              }`}>
                Score: {result.matchPercentage}%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal font-medium">{result.reasoning}</p>
          </div>
          <button
            onClick={() => {
              setFace1Base64(null);
              setFace2Base64(null);
              setResult(null);
            }}
            className="p-2 bg-white border border-slate-200 hover:bg-white text-slate-600 rounded-lg flex items-center gap-1 text-[11px] font-semibold flex-shrink-0 self-center sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
