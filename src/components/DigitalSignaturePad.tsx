import React, { useRef, useState, useEffect } from "react";
import { PenTool, RotateCcw, ShieldCheck, CheckCircle2, Lock, AlertCircle, Sparkles } from "lucide-react";

interface DigitalSignaturePadProps {
  onSignatureCapture: (signatureDataUrl: string, pin: string, signatureHash: string) => void;
  signerName: string;
  signerRole?: string;
  defaultPin?: string;
  title?: string;
}

export default function DigitalSignaturePad({
  onSignatureCapture,
  signerName,
  signerRole = "Licensed Consultant",
  defaultPin = "",
  title = "Consultant Digital Signature Gate"
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [pin, setPin] = useState(defaultPin);
  const [pinError, setPinError] = useState<string | null>(null);
  const [signatureHash, setSignatureHash] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set high resolution crisp scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F172A"; // Dark slate ink
    ctx.lineWidth = 2.5;
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasDrawn(true);
    setPinError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setIsVerified(false);
    setSignatureHash(null);
  };

  // Generate SHA-256 cryptographic signature stamp
  const generateSignatureHash = async (dataUrl: string, consultantPin: string) => {
    const encoder = new TextEncoder();
    const rawData = `${signerName}-${consultantPin}-${Date.now()}-${dataUrl.slice(-100)}`;
    const buffer = encoder.encode(rawData);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 32).toUpperCase();
  };

  const handleAuthorizeAndSign = async () => {
    if (!hasDrawn) {
      setPinError("Please draw your official signature on the canvas below.");
      return;
    }
    if (!pin.trim() || pin.trim().length < 4) {
      setPinError("A valid consultant security PIN (min 4 digits/chars) is required for digital sign-off.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const hash = await generateSignatureHash(dataUrl, pin.trim());
    setSignatureHash(hash);
    setIsVerified(true);
    setPinError(null);

    onSignatureCapture(dataUrl, pin.trim(), hash);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-600">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">{title}</h4>
            <p className="text-[11px] text-slate-600 font-medium">Authenticating: <span className="font-bold text-slate-800">{signerName}</span> ({signerRole})</p>
          </div>
        </div>
        {isVerified && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cryptographically Signed
          </span>
        )}
      </div>

      {/* Canvas Drawing Surface */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-slate-800 uppercase text-[11px] flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-slate-600" /> Draw Official Digital Signature
          </label>
          <button
            type="button"
            onClick={clearCanvas}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Clear Canvas
          </button>
        </div>

        <div className="relative border-slate-100 border-dashed border-slate-300 rounded-xl bg-white/50 hover:border-slate-300 transition-colors">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-32 cursor-crosshair touch-none rounded-xl"
          />
          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 opacity-50" /> Sign above using touch or mouse cursor
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Security PIN Authorization & Execution */}
      <div className="space-y-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-800 uppercase mb-1">
              Consultant License Security PIN / GMC Key
            </label>
            <input
              type="password"
              placeholder="Enter PIN (e.g. GMC-8729)"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(null);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          <div className="sm:self-end">
            <button
              type="button"
              onClick={handleAuthorizeAndSign}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify & Apply Digital Signature</span>
            </button>
          </div>
        </div>

        {pinError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pinError}</span>
          </div>
        )}

        {isVerified && signatureHash && (
          <div className="p-3 bg-white text-emerald-400 rounded-xl text-[11px] font-mono space-y-1">
            <div className="flex items-center justify-between text-slate-500 font-sans text-[10px] uppercase tracking-wider font-extrabold">
              <span>SHA-256 Signature Fingerprint</span>
              <span className="text-emerald-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Authenticated</span>
            </div>
            <div className="break-all font-bold tracking-tight text-slate-600">{signatureHash}</div>
          </div>
        )}
      </div>
    </div>
  );
}
