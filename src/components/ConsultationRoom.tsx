import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import alarmService from '../lib/alarmService';
import { Video, VideoOff, Mic, MicOff, Phone, MessageSquare, ChevronRight, ChevronLeft, UserCircle, ArrowLeft, FileText, CheckCircle2, Plus, Trash2, X, AlertCircle, Paperclip, Loader2, Star, Clipboard, HeartPulse, Activity, Eye, Clock, ArrowUpRight, ShieldAlert, Globe, Download, AlertTriangle, XCircle, Award, BookOpen, VolumeX, Maximize, Minimize, ChevronUp, ChevronDown, GripHorizontal, Upload, Languages, Volume2, Square, Camera, UserPlus , ShieldCheck, MoreVertical, Folder, Image as ImageIcon, Scan, ScanLine, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgoraRTC, { 
  AgoraRTCProvider, 
  useLocalCameraTrack, 
  useLocalMicrophoneTrack, 
  usePublish, 
  useRemoteUsers, 
  useRemoteAudioTracks,
  useRemoteUserTrack,
  LocalVideoTrack,
  RemoteVideoTrack,
  useJoin,
  useConnectionState
} from 'agora-rtc-react';

const VideoPresets = {
  h1080: { resolution: { width: 1920, height: 1080 }, encoding: { maxBitrate: 3000000 } },
  h720: { resolution: { width: 1280, height: 720 }, encoding: { maxBitrate: 1500000 } },
  h360: { resolution: { width: 640, height: 360 }, encoding: { maxBitrate: 500000 } }
};

function AgoraRoom({ token, consultationType, isConsultant, ...props }: any) {
  const tokenInfo = useMemo(() => {
    if (!token) return null;
    try {
      return JSON.parse(token);
    } catch (e) {
      console.error("Failed to parse Agora token:", e);
      return null;
    }
  }, [token]);

  const joinConfig = useMemo(() => {
    if (!tokenInfo) return null;
    return {
      appid: tokenInfo.appId,
      channel: tokenInfo.room,
      token: tokenInfo.token,
      uid: tokenInfo.uid,
    };
  }, [tokenInfo]);

  useJoin(joinConfig);

  const remoteUsers = useRemoteUsers();
  const connectionState = useConnectionState();

  useEffect(() => {
    console.log("[Agora] Connection State:", connectionState);
    console.log("[Agora] Remote Users:", remoteUsers.length, remoteUsers.map(u => u.uid));
  }, [connectionState, remoteUsers]);
  const audioTracks = useRemoteAudioTracks(remoteUsers);
  
  useEffect(() => {
    if (audioTracks && Array.isArray(audioTracks)) {
      audioTracks.forEach(track => {
        if (track && typeof track.play === 'function') {
          try {
            track.play();
          } catch (e) {
            console.warn("Audio play error:", e);
          }
        }
      });
    }
  }, [audioTracks]);

  return <>{props.children}</>;
}
// import '@livekit/components-styles';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, writeBatch, serverTimestamp, setDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { DigitalPrescription, VitalsRecord, ConsultationSession, isConsultantRole } from '../types';
import { formatConsultantName } from '../lib/formatters';
import PrescriptionGenerator from '../components/PrescriptionGenerator';
import ConsultationChat from '../components/ConsultationChat';
import VisitSummaryModal from '../components/VisitSummaryModal';
import ReferralGuidanceBanner from '../components/ReferralGuidanceBanner';
import OcrScannerModal from '../components/OcrScannerModal';
import ConsultantReviewSignatureModal from '../components/ConsultantReviewSignatureModal';
import ConsultantInconclusiveModal from "./consultant/ConsultantInconclusiveModal";
import ClinicalTriageSlipModal from '../components/ClinicalTriageSlipModal';
import DualFaceBiometrics from '../components/DualFaceBiometrics';
import ConsultantGuidelinesDrawer, { ConsultantGuidelinesContent } from '../components/ConsultantGuidelinesDrawer';
import RichTextEditor from '../components/RichTextEditor';
import ConsultantReferralModal from '../components/ConsultantReferralModal';
import ReferralPaymentModal from '../components/ReferralPaymentModal';
import PatientFloatingActionMenu from '../components/PatientFloatingActionMenu';

const VitalsChart: React.FC<{ data: VitalsRecord[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const width = 500;
  const height = 150;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 20;

  const sysVals = data.map(v => v.bloodPressureSys || 0);
  const diaVals = data.map(v => v.bloodPressureDia || 0);
  const hrVals = data.map(v => v.heartRate || 0);
  const allVals = [...sysVals, ...diaVals, ...hrVals];
  
  const maxVal = Math.max(...allVals, 140);
  const minVal = Math.max(0, Math.min(...allVals, 40) - 10);
  const valRange = maxVal - minVal || 1;

  const pointsCount = data.length;
  const getX = (index: number) => {
    if (pointsCount <= 1) return (width - paddingLeft - paddingRight) / 2 + paddingLeft;
    return paddingLeft + (index * (width - paddingLeft - paddingRight)) / (pointsCount - 1);
  };
  const getY = (val: number) => {
    return height - paddingBottom - ((val - minVal) * (height - paddingTop - paddingBottom)) / valRange;
  };

  const getPathD = (vals: number[]) => {
    return vals.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`).join(' ');
  };

  const sysPath = getPathD(sysVals);
  const diaPath = getPathD(diaVals);
  const hrPath = getPathD(hrVals);

  return (
    <div className="relative w-full h-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + ratio * (height - paddingTop - paddingBottom);
          const labelVal = Math.round(maxVal - ratio * valRange);
          return (
            <g key={idx} className="opacity-30">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[9px] fill-slate-400 font-bold">{labelVal}</text>
            </g>
          );
        })}

        {/* Sys Path Line */}
        {sysVals.length > 0 && (
          <path d={sysPath} fill="none" stroke="#f43f5e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dia Path Line */}
        {diaVals.length > 0 && (
          <path d={diaPath} fill="none" stroke="#fb7185" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Heart Rate Path Line */}
        {hrVals.length > 0 && (
          <path d={hrPath} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dynamic Interactive Dot Circles */}
        {data.map((item, i) => {
          const x = getX(i);
          const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
          return (
            <g key={i} className="group/dot cursor-pointer">
              {/* Highlight bar */}
              <line x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom} stroke="#e2e8f0" strokeWidth={1} className="opacity-0 group-hover/dot:opacity-60 transition-opacity pointer-events-none" />

              <circle cx={x} cy={getY(item.bloodPressureSys || 0)} r={4.5} fill="#f43f5e" stroke="#fff" strokeWidth={1.5} />
              <circle cx={x} cy={getY(item.bloodPressureDia || 0)} r={4} fill="#fb7185" stroke="#fff" strokeWidth={1.5} />
              <circle cx={x} cy={getY(item.heartRate || 0)} r={4} fill="#8b5cf6" stroke="#fff" strokeWidth={1.5} />
              
              {/* Tooltip Overlay */}
              <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none" style={{ zIndex: 50 }}>
                {(() => {
                  const tooltipWidth = 100;
                  const tooltipHeight = 48;
                  let tx = x - tooltipWidth / 2;
                  if (tx < 5) tx = 5;
                  if (tx + tooltipWidth > width - 5) tx = width - tooltipWidth - 5;
                  const ty = 2;
                  
                  return (
                    <g>
                      <rect x={tx} y={ty} width={tooltipWidth} height={tooltipHeight} rx={8} fill="#0f172a" opacity={0.95} />
                      <text x={tx + 50} y={ty + 12} textAnchor="middle" className="text-[8px] fill-slate-300 font-bold">{dateStr}</text>
                      <text x={tx + 50} y={ty + 24} textAnchor="middle" className="text-[9px] fill-rose-300 font-black">BP: {item.bloodPressureSys}/{item.bloodPressureDia}</text>
                      <text x={tx + 50} y={ty + 36} textAnchor="middle" className="text-[9px] fill-purple-300 font-black">HR: {item.heartRate} bpm</text>
                    </g>
                  );
                })()}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const generateId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

function SafeRoomComponent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ElapsedTimeOverlay() {
  const remoteUsers = useRemoteUsers();
  const participantsCount = 1 + remoteUsers.length;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const isPeerConnected = participantsCount > 1;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPeerConnected) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isPeerConnected]);

  if (!isPeerConnected) return null;

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="absolute top-4 left-4 z-50 bg-slate-900/80 backdrop-blur-xl text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-[11px] font-bold shadow-2xl border border-white/10">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
      <span className="tracking-tight">{formattedTime}</span>
    </div>
  );
}

function WaitingOverlay({ 
  isAccepted, 
  onCancel, 
  showCancelButton,
  isOnHold,
  holdReason,
  role,
  connectionTimeLeft
}: { 
  isAccepted?: boolean; 
  onCancel?: () => void; 
  showCancelButton?: boolean;
  isOnHold?: boolean;
  holdReason?: string | null;
  role?: string;
  connectionTimeLeft?: number | null;
}) {
  const remoteUsers = useRemoteUsers();
  const participantsCount = 1 + remoteUsers.length;
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isAccepted && !isOnHold) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isAccepted, isOnHold]);

  const formatTimeLeft = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  
  if (isDismissed || participantsCount > 1) return null;

  const isDisconnection = isOnHold && (holdReason?.toLowerCase().includes('disconnect') || false);

  const getTitle = () => {
    if (isDisconnection) {
      return role === 'consultant' 
        ? 'Patient Disconnected — Waiting for Patient' 
        : 'Consultant Disconnected — Waiting to Reconnect';
    }
    if (isAccepted) {
      return role === 'consultant'
        ? 'Connected — Waiting for Patient to Join'
        : 'Consultant Accepted — Connecting Call';
    }
    return 'Awaiting Consultant Acceptance';
  };

  const getDescription = () => {
    if (isDisconnection) {
      return role === 'consultant'
        ? 'The patient is experiencing connection issues or rejoining. We are waiting for them to enter the room.'
        : 'The consultant is experiencing connection issues. Please stay on this screen — we are actively waiting for them to reconnect.';
    }
    if (isAccepted) {
      return role === 'consultant'
        ? 'You have accepted this session. The room is ready — entering video stage now.'
        : 'The consultant has accepted your booking and is entering the video room. Timer has started.';
    }
    return 'Your consultation request has been dispatched. The timer will start once the consultant accepts your booking.';
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl text-white rounded-[32px] p-6 pb-24 text-center overflow-y-auto">
      <div className="relative flex items-center justify-center mb-8 shrink-0">
        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-15"></div>
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A3B24] to-[#125c38] flex items-center justify-center relative z-10 shadow-[0_12px_36px_rgba(10,59,36,0.3)] border border-emerald-500/20">
           <Video size={32} className={isDisconnection ? "text-rose-400 animate-pulse" : "text-emerald-300"} />
        </div>
      </div>
      <h3 className="font-extrabold text-2xl tracking-tight mb-2 text-white flex items-center justify-center gap-2">
        {getTitle()}
        <span className="flex gap-1 text-emerald-400"><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span><span className="animate-bounce delay-300">.</span></span>
      </h3>
      <p className="text-slate-300 text-sm font-medium max-w-md mb-6">
        {getDescription()}
      </p>

      {connectionTimeLeft !== null && connectionTimeLeft !== undefined && (
        <div className="mb-8">
          <div className="inline-flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
            <Clock size={20} className="text-amber-400 animate-pulse" />
            <span className="text-2xl font-mono font-black text-amber-300">
              {formatTimeLeft(connectionTimeLeft)}
            </span>
          </div>
          <p className="text-[10px] text-emerald-300 uppercase font-black tracking-[0.2em] mt-3">
            Connection Grace Window
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3 relative z-40">
        {!isAccepted && showCancelButton && onCancel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black uppercase tracking-widest px-8 py-4 rounded-2xl transition-all shadow-xl shadow-rose-600/40 cursor-pointer whitespace-nowrap min-h-[48px] flex items-center justify-center gap-2"
          >
            <X size={16} /> Cancel Request
          </button>
        )}
      </div>
    </div>
  );
}
function VideoStageWithHardwareStream({ 
  onEndCall, 
  isFullScreen, 
  toggleFullScreen, 
  sessionType,
  activeDocumentUrl,
  onCloseDocument,
  activeConsultation,
  notes,
  patientVitals = [],
  isWorkspaceCollapsed,
  onToggleWorkspaceCollapse,
  rawNotes,
  setRawNotes,
  isGeneratingSOAP,
  generatedSOAP,
  setGeneratedSOAP,
  handleGenerateSOAP,
  handleSaveNotes,
  scanOcrResult,
  setScanOcrResult,
  scanPreviewUrl,
  setScanPreviewUrl,
  handleScanFileChange,
  isProcessingScan,
  processScanOcr,
  setSelectedScanFile
}: { 
  onEndCall: () => void, 
  isFullScreen: boolean, 
  toggleFullScreen: () => void, 
  sessionType?: string,
  activeDocumentUrl?: string | null,
  onCloseDocument?: () => void,
  activeConsultation?: ConsultationSession | null,
  notes?: string,
  patientVitals?: VitalsRecord[],
  isWorkspaceCollapsed?: boolean,
  onToggleWorkspaceCollapse?: () => void,
  rawNotes?: string,
  setRawNotes?: (val: string) => void,
  isGeneratingSOAP?: boolean,
  generatedSOAP?: string,
  setGeneratedSOAP?: (val: string) => void,
  handleGenerateSOAP?: () => void,
  handleSaveNotes?: () => void,
  scanOcrResult?: any,
  setScanOcrResult?: (val: any) => void,
  scanPreviewUrl?: string | null,
  setScanPreviewUrl?: (val: string | null) => void,
  handleScanFileChange?: (e: React.ChangeEvent<HTMLInputElement>, type?: 'scan' | 'upload') => void,
  isProcessingScan?: boolean,
  processScanOcr?: () => void,
  setSelectedScanFile?: (val: File | null) => void
}) {
  const { role, user, showToast } = useAppContext();
  const isConsultant = useMemo(() => isConsultantRole(role) || !!user?.cadre, [role, user?.cadre]);
  const isChatType = sessionType === 'chat' || sessionType === 'CHAT_ONLY';
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(!isChatType);
  const isConsultantInitial = isConsultantRole(role) || !!user?.cadre;
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<null | 'chat' | 'soap' | 'imaging' | 'history' | 'vitals' | 'stg' | 'verify'>(null);
  
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 5 seconds of inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [showControls]);

  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const handleCameraFlip = async () => {
    try {
      const devices = await AgoraRTC.getCameras();
      if (devices.length <= 1) {
        showToast?.("No secondary camera found to flip.", "info");
        return;
      }
      const nextIndex = (currentCameraIndex + 1) % devices.length;
      setCurrentCameraIndex(nextIndex);
      const nextDevice = devices[nextIndex];
      if (localCameraTrack) {
        await localCameraTrack.setDevice(nextDevice.deviceId);
        showToast?.(`Switched camera to: ${nextDevice.label || `Camera ${nextIndex + 1}`}`, "success");
      }
    } catch (err) {
      console.error("Failed to flip camera:", err);
      showToast?.("Could not flip camera.", "error");
    }
  };

  const connectionState = useConnectionState();
  const remoteUsers = useRemoteUsers();

  useEffect(() => {
    console.log("[Agora Stage] Connection State:", connectionState);
    console.log("[Agora Stage] Remote Users Count:", remoteUsers.length);
    if (remoteUsers.length > 0) {
      console.log("[Agora Stage] Remote User 0 Video Track:", !!remoteUsers[0].videoTrack);
    }
  }, [connectionState, remoteUsers]);

  const { localCameraTrack, isLoading: isCameraLoading } = useLocalCameraTrack(true);
  const { localMicrophoneTrack, isLoading: isMicLoading } = useLocalMicrophoneTrack(true);

  useEffect(() => {
    if (localCameraTrack && connectionState === 'CONNECTED') {
      localCameraTrack.setEnabled(isVideoOn).catch(e => console.warn("Camera enable error:", e));
    }
  }, [localCameraTrack, isVideoOn, connectionState]);

  useEffect(() => {
    if (localMicrophoneTrack && connectionState === 'CONNECTED') {
      localMicrophoneTrack.setEnabled(isMicOn).catch(e => console.warn("Mic enable error:", e));
    }
  }, [localMicrophoneTrack, isMicOn, connectionState]);

  usePublish(connectionState === 'CONNECTED' ? [localCameraTrack, localMicrophoneTrack] : []);

  const remoteUser = remoteUsers[0]; 
  const { track: remoteVideoTrack } = useRemoteUserTrack(remoteUser && remoteUser.hasVideo ? remoteUser : undefined, "video");
  const activeRemoteVideoTrack = remoteUser?.videoTrack || remoteVideoTrack;

  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const remoteAudioTracksResult = useRemoteAudioTracks(remoteUsers);
  const remoteAudioTracks = (remoteAudioTracksResult && typeof remoteAudioTracksResult === 'object' && 'audioTracks' in remoteAudioTracksResult)
    ? ((remoteAudioTracksResult as any).audioTracks as any[])
    : ((remoteAudioTracksResult as any) as any[] || []);

  useEffect(() => {
    if (remoteAudioTracks && remoteAudioTracks.length > 0) {
      remoteAudioTracks.forEach(track => {
        if (track && typeof track.play === 'function') {
          try {
            const playPromise = track.play() as any;
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch((err: any) => {
                console.warn("[Agora Stage] Remote audio autoplay blocked:", err);
                setCanPlayAudio(false);
              });
            }
          } catch (err) {
            console.warn("[Agora Stage] Remote audio play error caught synchronously:", err);
            setCanPlayAudio(false);
          }
        }
      });
    }
  }, [remoteAudioTracks]);

  const startAudio = () => {
    if (remoteAudioTracks && remoteAudioTracks.length > 0) {
      remoteAudioTracks.forEach(track => {
        if (track && typeof track.play === 'function') {
          try {
            track.play();
          } catch (e) {
            console.error("[Agora Stage] Manual startAudio play failed:", e);
          }
        }
      });
    }
    setCanPlayAudio(true);
  };
  
  const consultantTrack = isConsultant ? localCameraTrack : activeRemoteVideoTrack;
  const patientTrack = isConsultant ? activeRemoteVideoTrack : localCameraTrack;

  const consultantName = activeConsultation?.consultantName 
    ? formatConsultantName(activeConsultation.consultantName, activeConsultation?.consultantCadre || (activeConsultation as any)?.cadreTarget || user?.cadre) 
    : (isConsultant ? 'You (Consultant)' : 'Consultant');
  const patientName = activeConsultation?.patientName || (isConsultant ? 'Patient' : 'You (Patient)');

  const toggleMicrophone = async () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (localMicrophoneTrack && connectionState === 'CONNECTED') {
      try {
        await localMicrophoneTrack.setEnabled(nextState);
      } catch (err) {
        console.warn("Agora setEnabled mic error caught:", err);
      }
    }
  };

  const toggleCamera = async () => {
    const nextState = !isVideoOn;
    setIsVideoOn(nextState);
    if (localCameraTrack && connectionState === 'CONNECTED') {
      try {
        await localCameraTrack.setEnabled(nextState);
      } catch (err) {
        console.warn("Agora setEnabled camera error caught:", err);
      }
    }
  };

  const [isMobileFeedsMinimized, setIsMobileFeedsMinimized] = useState(false);
  const [isPipZoomed, setIsPipZoomed] = useState(false);
  const [isDockedZoomed, setIsDockedZoomed] = useState(false);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  const isCompactLayout = !!activeOverlay || !!activeDocumentUrl;

  if (isCompactLayout) {
    return (
      <div ref={stageContainerRef} className={`${isFullScreen ? 'fixed inset-0 z-[100] bg-slate-950 rounded-none' : 'relative w-full h-full bg-slate-950 rounded-none md:rounded-[32px] overflow-hidden'} flex flex-col md:flex-row items-stretch p-0 md:p-4 gap-0 md:gap-4 select-none relative`}>
        
        {/* Smart Docked Video Feeds - Squircle Bubbles instead of squished columns */}
        <div className="relative w-auto flex flex-row md:flex-col gap-4 p-4 items-center justify-start shrink-0 z-40 bg-transparent select-none border-none">
          
          {/* Remote Video (Consultant or Patient feed) */}
          <motion.div 
            onDoubleClick={() => setIsDockedZoomed(!isDockedZoomed)}
            className={`relative ${isDockedZoomed ? 'w-40 h-40 md:w-56 md:h-56' : 'w-24 h-24 md:w-32 md:h-32'} bg-slate-900 rounded-[28px] overflow-hidden border-2 border-white/15 shadow-2xl group transition-all duration-300 cursor-pointer`}
            title="Double-tap to zoom"
          >
            {activeRemoteVideoTrack && (isConsultant ? true : isVideoOn) ? (
              <RemoteVideoTrack
                track={activeRemoteVideoTrack}
                play={true}
                className="w-full h-full object-cover"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                <UserCircle size={24} className="text-slate-600 mb-1 animate-pulse" />
                <span className="text-[9px] font-bold text-slate-400 leading-tight">
                  {isConsultant ? 'Awaiting Patient' : 'Awaiting Consultant'}
                </span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/10 whitespace-nowrap">
              {isConsultant ? patientName : consultantName}
            </div>
          </motion.div>

          {/* Local Video (Self-view feed) */}
          <motion.div 
            onDoubleClick={() => setIsDockedZoomed(!isDockedZoomed)}
            className={`relative ${isDockedZoomed ? 'w-40 h-40 md:w-56 md:h-56' : 'w-24 h-24 md:w-32 md:h-32'} bg-slate-900 rounded-[28px] overflow-hidden border-2 border-white/15 shadow-2xl group transition-all duration-300 cursor-pointer`}
            title="Double-tap to zoom"
          >
            {localCameraTrack && isVideoOn ? (
              <LocalVideoTrack
                track={localCameraTrack}
                play={true}
                className="w-full h-full object-cover transform -scale-x-100"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
                <UserCircle size={24} className="text-slate-600 mb-1" />
                <span className="text-[9px] font-bold text-slate-400 leading-tight">Camera Off</span>
              </div>
            )}
            
            {/* Quick Controls on Hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
              <button onClick={(e) => { e.stopPropagation(); toggleMicrophone(); }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white">
                {isMicOn ? <Mic size={16}/> : <MicOff size={16} className="text-rose-400"/>}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleCamera(); }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white">
                {isVideoOn ? <Video size={16}/> : <VideoOff size={16} className="text-rose-400"/>}
              </button>
            </div>

            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-xs px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/10 whitespace-nowrap">
              You
            </div>
          </motion.div>
        </div>

        {/* Active Feature or Scanned Document Workspace */}
        <div className={`flex-1 flex flex-col bg-slate-900/95 md:border md:border-white/15 md:rounded-3xl overflow-hidden md:shadow-2xl relative min-w-0 ${!isMobileFeedsMinimized ? 'pt-32 md:pt-0' : 'pt-0'}`}>
          {activeDocumentUrl ? (
            /* If a scanned document is displayed */
            <div className="flex-1 relative flex flex-col bg-slate-950">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-slate-900/60 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest text-emerald-400">
                  <FileText size={16} />
                  <span>Active Prescription / Document Scan</span>
                </div>
                <button
                  onClick={onCloseDocument}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss Document"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 relative flex items-center justify-center p-4 overflow-y-auto">
                <img 
                  src={activeDocumentUrl} 
                  alt="Medical Document" 
                  className="max-w-full max-h-[70vh] object-contain shadow-2xl rounded-2xl"
                />
              </div>
            </div>
          ) : (
            /* If an overlay tab is active */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-slate-900/60 backdrop-blur-md">
                <div className="flex items-center gap-2 text-white font-extrabold text-xs uppercase tracking-widest">
                  {activeOverlay === 'chat' && <MessageSquare size={16} className="text-emerald-400 animate-pulse" />}
                  {activeOverlay === 'soap' && <Clipboard size={16} className="text-amber-400" />}
                  {activeOverlay === 'imaging' && <ImageIcon size={16} className="text-indigo-400" />}
                  {activeOverlay === 'history' && <FileText size={16} className="text-blue-400" />}
                  {activeOverlay === 'vitals' && <HeartPulse size={16} className="text-rose-400" />}
                  {activeOverlay === 'stg' && <BookOpen size={16} className="text-teal-400" />}
                  <span className="tracking-widest">
                    {activeOverlay === 'chat' && 'Secure Chat Room'}
                    {activeOverlay === 'soap' && 'SOAP Note Documentation'}
                    {activeOverlay === 'imaging' && 'Medical Imaging & Scans'}
                    {activeOverlay === 'history' && 'Patient Medical History'}
                    {activeOverlay === 'vitals' && 'Patient Vitals Overview'}
                    {activeOverlay === 'stg' && 'Clinical Treatment Guidelines'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveOverlay(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Tab"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Workspace Body */}
              <div className="flex-1 overflow-y-auto bg-slate-900 text-white flex flex-col">
                {activeOverlay === 'chat' && (
                  <ConsultationChat
                    consultationId={activeConsultation?.sessionId || ''}
                    currentUserId={auth.currentUser?.uid || (isConsultant ? (activeConsultation?.consultantId || '') : (activeConsultation?.patientId || ''))}
                    currentUserRole={isConsultant ? 'consultant' : 'patient'}
                    currentUserName={isConsultant ? (activeConsultation?.consultantName || 'Consultant') : (activeConsultation?.patientName || 'Patient')}
                    isCompleted={activeConsultation?.status === 'COMPLETED'}
                    className="h-full border-0 rounded-none shadow-none text-slate-100 bg-transparent"
                  />
                )}
                {activeOverlay === 'verify' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    <h3 className="font-extrabold text-white mb-1 uppercase tracking-wider text-xs">Dual Face Biometrics</h3>
                    <p className="text-[11px] text-slate-300 mb-4">Verify patient identity against ID records.</p>
                    <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5">
                      <DualFaceBiometrics />
                    </div>
                  </div>
                )}
                {activeOverlay === 'soap' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    <h3 className="font-extrabold text-white mb-1 uppercase tracking-wider text-xs">Clinical SOAP Notes</h3>
                    <p className="text-[11px] text-slate-300 mb-4">Jot down rough notes and AI will structure them into a SOAP format.</p>
                    
                    <RichTextEditor 
                      value={rawNotes}
                      onChange={setRawNotes}
                      placeholder="E.g. Patient complains of headache for 3 days, temp 38C, prescribed paracetamol..."
                      minHeight="120px"
                      disabled={role === 'patient'}
                    />
                    
                    <button 
                      onClick={handleGenerateSOAP}
                      disabled={isGeneratingSOAP || !(rawNotes || '').trim()}
                      className="mt-4 w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 font-black uppercase tracking-widest text-[11px] py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isGeneratingSOAP ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                      Auto-Generate SOAP
                    </button>

                    {generatedSOAP && (
                      <div className="mt-6 border-t border-white/10 pt-6 flex-1 flex flex-col">
                        <h4 className="font-extrabold text-white mb-2 text-xs uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500"/> Generated SOAP Output
                        </h4>
                        <RichTextEditor 
                          value={generatedSOAP}
                          onChange={setGeneratedSOAP}
                          placeholder="Generated SOAP note..."
                          minHeight="200px"
                          disabled={role === 'patient'}
                        />
                        <button 
                          onClick={handleSaveNotes}
                          className="mt-4 w-full bg-white hover:bg-slate-100 text-slate-900 font-black uppercase tracking-widest text-[11px] py-3.5 rounded-xl shadow-lg transition-all cursor-pointer"
                        >
                          Save to Patient Record
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {activeOverlay === 'imaging' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    {role === 'patient' ? (
                      <div className="space-y-6 flex-1 flex flex-col">
                        <div>
                          <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                            <Camera className="text-slate-300" size={18} />
                            Scan / Upload Prescription
                          </h3>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                            Snap a photo or upload your physical paper prescription. Our OCR will scan, parse, and synchronize the medications directly with your consultant in real-time.
                          </p>
                        </div>
                        {!scanOcrResult ? (
                          <div className="space-y-4">
                            {!scanPreviewUrl ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="border-dashed border-white/15 hover:border-white/20 hover:bg-white/5 bg-white/[0.02] rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[150px] group relative">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleScanFileChange}
                                    className="hidden"
                                  />
                                  <Scan size={24} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                                  <span className="text-xs font-black uppercase tracking-widest text-white">Capture Photo</span>
                                  <span className="text-[10px] text-slate-400 mt-1">Use mobile camera</span>
                                </label>
                                <label className="border-dashed border-white/15 hover:border-white/20 hover:bg-white/5 bg-white/[0.02] rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[150px] group relative">
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleScanFileChange}
                                    className="hidden"
                                  />
                                  <Upload size={24} className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                                  <span className="text-xs font-black uppercase tracking-widest text-white">Upload File</span>
                                  <span className="text-[10px] text-slate-400 mt-1">PDF or image format</span>
                                </label>
                              </div>
                            ) : (
                              <div className="space-y-4 flex flex-col items-center w-full">
                                <div className="relative group w-full flex-1 min-h-[220px] max-h-[420px] flex items-center justify-center overflow-hidden rounded-xl bg-black/20 mb-2">
                                  <img src={scanPreviewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl shadow-sm" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setScanPreviewUrl(null);
                                      if (setSelectedScanFile) setSelectedScanFile(null);
                                    }}
                                    className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-1.5 rounded-full border border-white/10"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={processScanOcr}
                                  disabled={isProcessingScan}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[11px] py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                                  aria-label="Process and Parse Document"
                                >
                                  {isProcessingScan ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                                  Process & Parse Document
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl flex items-start gap-3">
                              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold">Document Processed Successfully</p>
                                <p className="text-[11px] text-emerald-400/80 mt-0.5">The scanned information was transmitted to your consultant's workspace.</p>
                              </div>
                            </div>
                            <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 font-mono text-[10px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {scanOcrResult.extractedText}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setScanOcrResult(null);
                                setScanPreviewUrl(null);
                              }}
                              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-[11px] py-3 rounded-xl cursor-pointer"
                            >
                              Scan Another Document
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                          <ImageIcon size={28} className="text-slate-400 animate-pulse" />
                        </div>
                        <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-1">Imaging & Prescriptions Scan</h4>
                        <p className="text-slate-400 text-[11px] max-w-xs leading-relaxed">
                          Patient can scan their physical prescriptions using their camera, and the synchronized data will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {activeOverlay === 'history' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto space-y-4">
                    <h3 className="font-extrabold text-white mb-1 uppercase tracking-wider text-xs">Patient History</h3>
                    <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl shadow-inner">
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-1">Chief Complaint</span>
                      <p className="text-slate-200 text-xs leading-relaxed">{activeConsultation?.chiefComplaints || 'Routine virtual consultation'}</p>
                    </div>
                    {(activeConsultation as any)?.medicalHistory && (
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 block mb-1">Medical Background</span>
                        <p className="text-slate-200 text-xs leading-relaxed">{(activeConsultation as any).medicalHistory}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Patient Name</span>
                        <span className="text-white text-xs font-bold mt-1 block">{activeConsultation?.patientName || 'Patient'}</span>
                      </div>
                      <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl shadow-inner">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Cadre Target</span>
                        <span className="text-white text-xs font-bold mt-1 block capitalize">{activeConsultation?.consultantCadre || (activeConsultation as any)?.cadreTarget || 'General'}</span>
                      </div>
                    </div>
                  </div>
                )}
                {activeOverlay === 'vitals' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    <h3 className="font-extrabold text-white mb-4 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <HeartPulse className="text-rose-500" /> Patient Vitals
                    </h3>
                    {patientVitals.length === 0 ? (
                      <div className="text-center text-slate-400 py-12 flex flex-col items-center">
                        <Activity size={32} className="text-slate-500 mb-4 animate-pulse" />
                        <p className="text-xs font-bold">No vitals logged yet</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/30">
                            <p className="text-[10px] uppercase tracking-wider text-rose-400 font-bold mb-1">Blood Pressure</p>
                            <p className="text-lg font-black text-rose-100">{patientVitals[patientVitals.length - 1].bloodPressureSys}/{patientVitals[patientVitals.length - 1].bloodPressureDia}</p>
                          </div>
                          <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/30">
                            <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mb-1">Heart Rate</p>
                            <p className="text-lg font-black text-blue-100">{patientVitals[patientVitals.length - 1].heartRate} bpm</p>
                          </div>
                          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1">Weight</p>
                            <p className="text-lg font-black text-emerald-100">{patientVitals[patientVitals.length - 1].weightKg} kg</p>
                          </div>
                          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1">Glucose</p>
                            <p className="text-lg font-black text-amber-100">{patientVitals[patientVitals.length - 1].glucoseLevel || 95} mg/dL</p>
                          </div>
                        </div>
                        <div className="h-48 border border-white/10 rounded-xl p-2 pt-4 bg-slate-950/40">
                          <VitalsChart data={patientVitals} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeOverlay === 'stg' && (
                  <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                    <ConsultantGuidelinesContent />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Call Controls: Minimized Pill Centered at Bottom Edge inside workspace */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-slate-950/80 backdrop-blur-xl px-4 py-2 rounded-full border border-white/15 shadow-2xl">
          <button
            type="button"
            onClick={toggleMicrophone}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md ${
              isMicOn 
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10' 
                : 'bg-rose-600 text-white shadow-rose-600/40'
            }`}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicOn ? <Mic size={17} /> : <MicOff size={17} />}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md ${
              isVideoOn 
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10' 
                : 'bg-rose-600 text-white shadow-rose-600/40'
            }`}
            title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoOn ? <Video size={17} /> : <VideoOff size={17} />}
          </button>

          <div className="w-px h-5 bg-white/15 mx-0.5" />

          <button
            type="button"
            onClick={onEndCall}
            className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-md shadow-rose-600/40"
            title={isConsultant ? 'End & Complete Session' : 'End Call'}
          >
             <Phone className="rotate-[135deg]" size={17} />
          </button>
        </div>

        {/* Folder tab (Consultant only) */}
        {isConsultant && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end">
            <button
              type="button"
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className="bg-slate-900/90 hover:bg-slate-800 text-white pl-3.5 pr-2.5 py-3 rounded-l-2xl border-y border-l border-white/20 shadow-2xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 backdrop-blur-md group"
              title="Clinical Sections Folder"
              aria-label="Clinical Sections Folder"
            >
              <Folder size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
              <ChevronLeft size={14} className={`text-slate-400 transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showFolderDropdown && (
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  className="absolute right-14 top-1/2 -translate-y-1/2 w-64 bg-slate-950/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 text-xs text-white z-50"
                >
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-white/10 flex items-center justify-between">
                    <span>Clinical Sections</span>
                    <button
                      onClick={() => setShowFolderDropdown(false)}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'chat' ? null : 'chat');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'chat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <MessageSquare size={15} className="text-emerald-400" />
                    <span>Secure Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'soap' ? null : 'soap');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'soap' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Clipboard size={15} className="text-amber-400" />
                    <span>SOAP Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'vitals' ? null : 'vitals');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'vitals' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <HeartPulse size={15} className="text-rose-400" />
                    <span>Patient Vitals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'stg' ? null : 'stg');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'stg' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <BookOpen size={15} className="text-teal-400" />
                    <span>STG Guidelines</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'history' ? null : 'history');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'history' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <FileText size={15} className="text-blue-400" />
                    <span>Patient History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'imaging' ? null : 'imaging');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'imaging' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <ImageIcon size={15} className="text-indigo-400" />
                    <span>Imaging & Scans</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  const handleStageTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.z-40') || target.closest('.z-50')) {
      return;
    }
    setShowControls(prev => !prev);
  };

  /* OTHERWISE RENDER DEFAULT FULL PIP STAGE */
  return (
    <div 
      ref={stageContainerRef}
      onClick={handleStageTap}
      className={`${isFullScreen ? 'fixed inset-0 z-[100] bg-slate-950 rounded-none' : 'relative w-full h-full bg-slate-950 rounded-none md:rounded-[32px] overflow-hidden'} flex flex-col items-center justify-center select-none cursor-pointer`}
    >
      {/* Top Header Section: Individual Slim Pills */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto max-w-[70%]">
          {/* Back/Nav Pill */}
          <button 
            onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            className="flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border border-white/10 text-white p-2 rounded-full shadow-2xl hover:bg-slate-800 transition-all active:scale-90"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Session Info Pill */}
          <div className="flex-shrink-0 bg-slate-900/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
            <UserCircle size={14} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-white whitespace-nowrap">
              {isConsultant ? patientName : consultantName}
            </span>
          </div>

          {/* Timer Pill */}
          <div className="flex-shrink-0">
             <ElapsedTimeOverlay />
          </div>

          {/* Alert/Status Pill (Optional/Conditional) */}
          {connectionState !== 'CONNECTED' && (
             <div className="flex-shrink-0 bg-amber-500/80 backdrop-blur-xl border border-amber-400/20 px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
               <AlertCircle size={14} className="text-white animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-tighter text-white">Reconnecting</span>
             </div>
          )}
        </div>

        {/* Complete/End Action Pill */}
        <div className="pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-full shadow-2xl border border-emerald-400/20 flex items-center gap-2 transition-all active:scale-95 group"
          >
            <span className="text-[11px] font-black uppercase tracking-widest">Complete</span>
            <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {!canPlayAudio && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-amber-500/90 border border-amber-300/40 text-slate-950 px-5 py-2 rounded-full shadow-2xl flex items-center gap-3 text-xs font-bold animate-bounce backdrop-blur-md">
          <VolumeX size={18} />
          <span>Audio Autoplay Blocked</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startAudio();
            }}
            className="bg-slate-950 text-white px-3.5 py-1 rounded-full text-xs font-black uppercase hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
          >
            Click to Unmute
          </button>
        </div>
      )}

      {/* Main Video Presentation Stage */}
      <div className="w-full h-full flex-1 relative overflow-hidden flex items-center justify-center">
        {(isCameraLoading || isMicLoading) && (
          <div className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 size={32} className="animate-spin text-emerald-400 mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-200">Initializing Media Hardware...</p>
          </div>
        )}

        {/* Picture-in-picture Mode */}
        <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Main Video (Full Area) */}
          {activeRemoteVideoTrack && (isConsultant ? true : isVideoOn) ? (
            <RemoteVideoTrack
              track={activeRemoteVideoTrack}
              play={true}
              className="w-full h-full object-cover"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-slate-300">
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center mb-3 shadow-2xl">
                <UserCircle size={56} className="text-slate-500 animate-pulse" />
              </div>
              <h4 className="text-white font-bold text-base mb-1">
                {isConsultant ? 'Awaiting Patient Video' : 'Awaiting Consultant Video'}
              </h4>
              <p className="text-slate-400 text-xs max-w-xs">
                {isConsultant ? 'Patient feed will fill the main screen once video is streaming.' : 'Consultant feed will appear here.'}
              </p>
            </div>
          )}

          {/* Self-View Video (Floating Rounded PiP) */}
          <motion.div 
            drag
            dragConstraints={stageContainerRef}
            dragElastic={0.1}
            dragMomentum={false}
            onClick={(e: any) => e.stopPropagation()}
            onDoubleClick={(e: any) => { e.stopPropagation(); setIsPipZoomed(!isPipZoomed); }}
            className={`absolute z-20 ${isPipZoomed ? 'w-40 h-56 sm:w-48 sm:h-64' : 'w-24 h-32 sm:w-28 sm:h-40'} rounded-2xl border border-white/20 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-slate-900 flex items-center justify-center transition-all group cursor-move backdrop-blur-xl`}
            title="Self View - Drag to move, Double-tap to zoom"
            style={{ bottom: 100, right: 20 }}
          >
            {localCameraTrack && isVideoOn ? (
              <LocalVideoTrack
                track={localCameraTrack}
                play={true}
                className="w-full h-full object-cover brightness-105 contrast-105 transform -scale-x-100"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                <UserCircle size={28} className="text-slate-500 mb-0.5" />
                <span className="text-[10px] font-bold">Camera Off</span>
              </div>
            )}
            
            {/* Hover Controls */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
              <button onClick={(e) => { e.stopPropagation(); toggleMicrophone(); }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white">
                {isMicOn ? <Mic size={16}/> : <MicOff size={16} className="text-rose-400"/>}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleCamera(); }} className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white">
                {isVideoOn ? <Video size={16}/> : <VideoOff size={16} className="text-rose-400"/>}
              </button>
            </div>

            <div className="absolute bottom-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/10">
              You
            </div>
          </motion.div>
        </div>
      </div>

      {/* Call Controls: Slim FaceTime-Style Pill centered at Bottom */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 30, x: '-50%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900/70 backdrop-blur-2xl px-4 py-2.5 rounded-full border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
          >
            {/* Mute Microphone */}
            <button
              type="button"
              onClick={toggleMicrophone}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-lg ${
                isMicOn 
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-white border border-white/5' 
                  : 'bg-rose-500 text-white shadow-rose-500/20'
              }`}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            {/* Camera Off / Video Pause */}
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-lg ${
                isVideoOn 
                  ? 'bg-slate-800/80 hover:bg-slate-700 text-white border border-white/5' 
                  : 'bg-rose-500 text-white shadow-rose-500/20'
              }`}
              title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            {/* Camera Flip */}
            <button
              type="button"
              onClick={handleCameraFlip}
              className="w-11 h-11 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white border border-white/5 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-lg"
              title="Camera Flip"
            >
              <RefreshCw size={18} />
            </button>

            <div className="w-[1px] h-6 bg-white/10 mx-0.5" />

            {/* End Call (Red Button) */}
            <button
              type="button"
              onClick={onEndCall}
              className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-[0_0_20px_rgba(225,29,72,0.4)]"
              title={isConsultant ? 'End & Complete Session' : 'End Call'}
            >
               <Phone className="rotate-[135deg]" size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Clinical Sections Folder tab (Available for BOTH roles when overlay is closed) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-end"
      >
        <button
          type="button"
          onClick={() => setShowFolderDropdown(!showFolderDropdown)}
          className="bg-slate-900/95 hover:bg-slate-850 text-white pl-4 pr-3 py-3.5 rounded-l-2xl border-y border-l border-white/15 shadow-2xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 backdrop-blur-md group"
          title="Clinical Sections Folder"
          aria-label="Clinical Sections Folder"
        >
          <Folder size={18} className="text-amber-400 group-hover:scale-110 transition-transform animate-pulse" />
          <ChevronLeft size={14} className={`text-slate-400 transition-transform ${showFolderDropdown ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showFolderDropdown && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="absolute right-14 top-1/2 -translate-y-1/2 w-64 bg-slate-950/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 text-xs text-white z-50"
            >
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-white/10 flex items-center justify-between">
                <span>Clinical Sections</span>
                <button
                  onClick={() => setShowFolderDropdown(false)}
                  className="text-slate-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>

              {isConsultant ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'chat' ? null : 'chat');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'chat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <MessageSquare size={15} className="text-emerald-400" />
                    <span>Secure Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'soap' ? null : 'soap');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'soap' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Clipboard size={15} className="text-amber-400" />
                    <span>SOAP Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'vitals' ? null : 'vitals');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'vitals' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <HeartPulse size={15} className="text-rose-400" />
                    <span>Patient Vitals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'stg' ? null : 'stg');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'stg' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <BookOpen size={15} className="text-teal-400" />
                    <span>STG Guidelines</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'history' ? null : 'history');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'history' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <FileText size={15} className="text-blue-400" />
                    <span>Patient History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'imaging' ? null : 'imaging');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'imaging' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <ImageIcon size={15} className="text-indigo-400" />
                    <span>Imaging & Scans</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'chat' ? null : 'chat');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'chat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <MessageSquare size={15} className="text-emerald-400" />
                    <span>Secure Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'vitals' ? null : 'vitals');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'vitals' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <HeartPulse size={15} className="text-rose-400" />
                    <span>My Vitals</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveOverlay(activeOverlay === 'imaging' ? null : 'imaging');
                      setShowFolderDropdown(false);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left font-semibold cursor-pointer ${
                      activeOverlay === 'imaging' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <ImageIcon size={15} className="text-indigo-400" />
                    <span>Scan / Upload Prescription</span>
                  </button>

                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


function ConnectionMonitor({ 
  sessionId, 
  tickets, 
  revokeTicket,
  activeConsultation,
  showToast,
  navigate
}: { 
  sessionId: string, 
  tickets: any[], 
  revokeTicket: (id: string, auto: boolean) => Promise<void>,
  activeConsultation: ConsultationSession | null,
  showToast: (msg: string, type: any) => void,
  navigate: any
}) {
  const remoteUsers = useRemoteUsers();
  const revocationPerformed = useRef(false);
  const participantsCount = 1 + remoteUsers.length;

  // 90-second Idle closure rule
  useEffect(() => {
    if (!activeConsultation || activeConsultation.status !== 'ACTIVE') return;
    if (!activeConsultation.acceptedAt) return;
    
    const interval = setInterval(async () => {
      if (participantsCount === 0) {
        const lastUpdate = activeConsultation.updatedAt || activeConsultation.acceptedAt;
        const lastActivityAt = typeof lastUpdate === 'string' ? new Date(lastUpdate).getTime() : Date.now();
        const idleTime = Date.now() - lastActivityAt;
        
        if (idleTime > 90 * 1000) {
          console.log('[ConnectionMonitor] Closing session due to 90s idle timeout');
          await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), { 
            status: 'TERMINATED_SYSTEM_FAILURE',
            completedAt: new Date().toISOString(),
            isOnHold: false,
            holdReason: "",
            clinicalNotes: (activeConsultation.clinicalNotes || '') + '\n\n[SYSTEM] Session terminated: Participants failed to re-join within 90 seconds.'
          });
          showToast("Session closed due to inactivity.", "warning");
          navigate('/dashboard');
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeConsultation, participantsCount, navigate, showToast]);

  useEffect(() => {
    if (participantsCount > 1 && !revocationPerformed.current) {
      const activeTickets = (tickets || []).filter(t => t.originalSessionId === sessionId && t.status === 'active');
      if (activeTickets.length > 0) {
        revocationPerformed.current = true;
        activeTickets.forEach(t => {
          revokeTicket(t.ticketId, true).catch(console.error);
        });
      }
    }
  }, [participantsCount, sessionId, tickets, revokeTicket]);

  return null;
}

export default function ConsultationRoom() {
  const agoraClient = useMemo(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    AgoraRTC.setLogLevel(4); // Set to NONE to suppress internal WS_ABORT and subscription race condition console errors
    
    // Safely wrap client.subscribe to catch and suppress INVALID_REMOTE_USER and channel subscription race conditions
    const anyClient = client as any;
    if (anyClient && typeof anyClient.subscribe === 'function') {
      const originalSubscribe = anyClient.subscribe.bind(anyClient);
      anyClient.subscribe = async (user: any, mediaType: any) => {
        try {
          // Double check if user is still present in client's active remote users
          const isStillInChannel = client.remoteUsers.some(u => u.uid === user?.uid);
          if (!isStillInChannel) {
            console.warn("[Agora Client] Skipping subscribe. Remote user is no longer in the channel list:", user?.uid);
            return null as any;
          }
          return await originalSubscribe(user, mediaType);
        } catch (err: any) {
          const errMsg = err?.message || "";
          const errCode = err?.code || "";
          if (
            errCode === "INVALID_REMOTE_USER" ||
            errMsg.includes("INVALID_REMOTE_USER") ||
            errMsg.includes("not in the channel")
          ) {
            console.warn("[Agora Client] Gracefully caught and suppressed subscription race condition for user:", user?.uid, err);
            return null as any;
          }
          throw err;
        }
      };
    }
    return client;
  }, []);
  const params = useParams<{ sessionId?: string; id?: string }>();
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(true);
  const urlRoomName = (params.sessionId || params.id || '').trim();
  const { 
    user, 
    role, 
    consultations, 
    updateConsultation, 
    addPrescription, 
    updateUserProfile, 
    issueTicket, 
    revokeTicket, 
    tickets,
    showToast,
    showConfirm
  } = useAppContext();
  const isConsultant = useMemo(() => isConsultantRole(role) || !!user?.cadre, [role, user?.cadre]);
  const navigate = useNavigate();
  const [localConsultation, setLocalConsultation] = useState<ConsultationSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  // Stop any active incoming call alarms when inside the room
  useEffect(() => {
    try {
      if (alarmService && typeof alarmService.setInConsultation === 'function') {
        alarmService.setInConsultation(true);
      }
    } catch (err) {
      console.warn("Alarm stop in ConsultationRoom suppressed:", err);
    }
    return () => {
      try {
        if (alarmService && typeof alarmService.setInConsultation === 'function') {
          alarmService.setInConsultation(false);
        }
      } catch (err) {
        console.warn("Alarm setInConsultation cleanup suppressed:", err);
      }
    };
  }, []);

  // Direct snapshot subscription for target session
  useEffect(() => {
    if (!urlRoomName) {
      setIsSessionLoading(false);
      return;
    }

    console.log('[ConsultationRoom] Subscribing to session:', urlRoomName);
    setIsSessionLoading(true);

    const docRef = doc(db, 'consultations', urlRoomName);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { sessionId: docSnap.id, ...docSnap.data() } as ConsultationSession;
        setLocalConsultation(data);
        setIsSessionLoading(false);
      } else {
        const found = consultations.find(c => c.sessionId === urlRoomName || c.roomId === urlRoomName);
        if (found) {
          setLocalConsultation(found);
          setIsSessionLoading(false);
        }
      }
    }, (err) => {
      console.warn("Direct document listener error:", err);
    });

    const timeoutId = setTimeout(() => {
      setIsSessionLoading(false);
    }, 3500);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [urlRoomName]);

  const activeConsultation = useMemo(() => {
    const found = localConsultation || consultations.find(c => c.sessionId === urlRoomName || c.roomId === urlRoomName);
    return found;
  }, [localConsultation, consultations, urlRoomName]);

  const [showRxModal, setShowRxModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showReviewSignatureModal, setShowReviewSignatureModal] = useState(false);
  const [showInconclusiveModal, setShowInconclusiveModal] = useState(false);
  const [showTriageSlipModal, setShowTriageSlipModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showPatientReferralModal, setShowPatientReferralModal] = useState(false);
  const [showGuidelinesDrawer, setShowGuidelinesDrawer] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  
  // Timer & Hold States
  const [secondsRemaining, setSecondsRemaining] = useState<number>(900);
  const [isExtending, setIsExtending] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const recordedChunks = useRef<Blob[]>([]);
  
  const [token, setToken] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  const [showGraceTimer, setShowGraceTimer] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(180);
  const [isEngineConnected, setIsEngineConnected] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [connectionTimeLeft, setConnectionTimeLeft] = useState<number | null>(null);

  // Global handler for video stage uploads
  useEffect(() => {
    (window as any).handleVideoStageUpload = async (file: File) => {
      if (!activeConsultation) return;
      try {
        showToast("Processing document...", "info");
        
        let url = "";
        try {
          const storageRef = ref(storage, `consultation_docs/${activeConsultation.sessionId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          url = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn("[Storage Fallback] Firebase Storage upload failed, falling back to base64:", storageErr);
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(new Error("Failed to read file into base64"));
            reader.readAsDataURL(file);
          });
        }
        
        await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
          ocrImageUrl: url,
          updatedAt: new Date().toISOString()
        });

        // Trigger AI Analysis in background
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/ai/analyze-medical-doc', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ imageUrl: url, docType: 'auto' })
        });
        
        const data = await res.json();
        if (data.success && data.result) {
           const result = data.result;
           const summaryMsgId = 'MSG-AI-' + Math.random().toString(36).substring(2, 9).toUpperCase();
           
           // Update consultation with AI summary and SOAP draft
           await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
             ocrExtractedText: result.summary,
             soapAIContent: `<h3>AI Document Analysis</h3><p><b>Summary:</b> ${result.summary}</p><h4>Suggested SOAP (Subjective):</h4><p>${result.soapDraft?.subjective || 'N/A'}</p><h4>Suggested SOAP (Objective):</h4><p>${result.soapDraft?.objective || 'N/A'}</p>`,
             updatedAt: new Date().toISOString()
           });

           // Also post as a system message in chat
           await setDoc(doc(db, 'consultations', activeConsultation.sessionId, 'messages', summaryMsgId), {
             messageId: summaryMsgId,
             consultationId: activeConsultation.sessionId,
             senderId: 'system_ai',
             senderRole: 'system',
             senderName: 'Clinical AI Assistant',
             text: `📋 **Document Analysis Complete**\n\n**Summary:** ${result.summary}\n\n**Medications/Findings:** ${(result.medications || []).join(', ') || 'None detected'}`,
             timestamp: new Date().toISOString()
           });
        }

        showToast("Document shared and analyzed.", "success");
      } catch (err) {
        console.error("Video stage upload failed:", err);
        showToast("Failed to share document.", "error");
      }
    };
    return () => { delete (window as any).handleVideoStageUpload; };
  }, [activeConsultation, showToast]);

  const [isAcceptedSticky, setIsAcceptedSticky] = useState(false);

  useEffect(() => {
    // Only set sticky accepted state if it's actually live with a consultant confirmation
    const isActuallyAccepted = (
      activeConsultation?.status === 'IN_PROGRESS' || 
      activeConsultation?.status === 'ACTIVE' || 
      activeConsultation?.dispatchStatus === 'accepted'
    ) && !!activeConsultation?.acceptedAt;

    if (isActuallyAccepted && !isAcceptedSticky) {
      console.log('[ConsultationRoom] Setting isAcceptedSticky to true');
      setIsAcceptedSticky(true);
    } else if (!isActuallyAccepted && isAcceptedSticky) {
      // Allow it to reset if the session is no longer active (e.g. cancelled/terminated)
      const isStillPossible = 
        activeConsultation?.status === 'PAID' || 
        activeConsultation?.status === 'PENDING' || 
        activeConsultation?.dispatchStatus === 'ringing';
        
      if (!isStillPossible) {
        setIsAcceptedSticky(false);
      }
    }
  }, [activeConsultation?.status, activeConsultation?.dispatchStatus, activeConsultation?.acceptedAt, isAcceptedSticky]);

  const consultantRoleLabel = useMemo(() => {
    if (!activeConsultation) return 'Consultant';
    const cadre = activeConsultation.consultantCadre || activeConsultation.cadreNeeded || 'Professional';
    
    const mapping: Record<string, string> = {
      'DOCTOR': 'Doctor',
      'PHARMACIST': 'Pharmacist',
      'SPECIALIST': 'Specialist',
      'PHARM_TECH': 'Pharmacy Technician',
      'PHYSICIAN_ASSISTANT': 'Physician Assistant'
    };
    
    return mapping[cadre] || cadre;
  }, [activeConsultation]);

  const isAcceptedSession = useMemo(() => {
    const isCancelled = activeConsultation?.status === 'CANCELLED_BY_USER' || activeConsultation?.status === 'CANCELLED_BY_CONSULTANT';
    if (isCancelled) return false;

    const dispatchUpper = (activeConsultation?.dispatchStatus || '').toUpperCase();
    const statusUpper = (activeConsultation?.status || '').toUpperCase();

    const hasAcceptedDispatch = dispatchUpper === 'ACCEPTED';
    const hasActiveStatus = statusUpper === 'IN_PROGRESS' || statusUpper === 'ACTIVE';
    
    // Strictly require BOTH dispatchStatus === 'ACCEPTED' AND status === 'IN_PROGRESS' / 'ACTIVE'
    const isActuallyLive = hasAcceptedDispatch && hasActiveStatus && !!activeConsultation?.acceptedAt;
    return (isAcceptedSticky || isActuallyLive);
  }, [isAcceptedSticky, activeConsultation?.status, activeConsultation?.dispatchStatus, activeConsultation?.acceptedAt]);

  // Consultant Safety Net: redirect back to dashboard if landing on unaccepted session
  useEffect(() => {
    if (isSessionLoading) return;
    if (isConsultant && activeConsultation) {
      const dispatchUpper = (activeConsultation.dispatchStatus || '').toUpperCase();
      const statusUpper = (activeConsultation.status || '').toUpperCase();
      const isRingingForMe = dispatchUpper === 'RINGING' || statusUpper === 'PAID' || statusUpper === 'PENDING';
      
      if (!isAcceptedSession && !isRingingForMe) {
        showToast("Session awaiting call acceptance — opening consultant dashboard...", "info");
        navigate('/consultant/dashboard');
      }
    }
  }, [role, isSessionLoading, activeConsultation, isAcceptedSession, navigate, showToast]);

  // 5-minute Connection Timeout Countdown Logic
  useEffect(() => {
    if (!activeConsultation || !activeConsultation.connectionStartedAt || isEngineConnected) {
      setConnectionTimeLeft(null);
      return;
    }

    const startedAt = activeConsultation.connectionStartedAt?.toDate ? activeConsultation.connectionStartedAt.toDate().getTime() : 0;
    if (startedAt === 0) return;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setConnectionTimeLeft(remaining);

      if (remaining === 0) {
        showToast("The session connection window has expired. A reschedule ticket has been issued to your account.", "info");
        navigate(role === 'patient' ? '/patient/dashboard' : '/consultant/dashboard');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeConsultation?.connectionStartedAt, isEngineConnected, navigate, role, showToast]);



  const handleCancelSession = async () => {
    if (!activeConsultation) return;
    
    if (role === 'patient' && activeConsultation.isOnHold) {
      showConfirm({
        title: "Session On Hold",
        message: "You are currently in an active session that was put on hold.\n\nDo you want to FORFEIT this session and return to dashboard (No Refund)?\n(Click Cancel to lift the hold and return to your session.)",
        type: 'danger',
        onConfirm: async () => {
          try {
            await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
              status: 'CANCELLED_BY_USER',
              dispatchStatus: 'cancelled',
              isOnHold: false,
              holdReason: "",
              updatedAt: new Date().toISOString(),
              cancelReason: 'Patient forfeited during hold'
            });
            showToast("Session cancelled. No refund was issued as the session was already in progress.", "info");
            navigate('/patient/dashboard');
          } catch(err) {
            console.error(err);
          }
        },
        onCancel: async () => {
          try {
            await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
              isOnHold: false,
              holdReason: null
            });
            showToast("Hold lifted. Returning to session...", "success");
          } catch(err) {
            console.error(err);
          }
        }
      });
      return;
    }
    
    const sessionCreatedAt = new Date((activeConsultation as any).createdAt || activeConsultation.scheduledAt || 0).getTime();
    const isStaleSession = (Date.now() - sessionCreatedAt) > (2 * 60 * 60 * 1000);
    
    if (isAcceptedSession && !isStaleSession) {
      showToast("This consultation is currently in active progress and cannot be self-cancelled. Please discuss with your consultant.", "warning");
      return;
    }

    showConfirm({
      title: "Cancel Consultation",
      message: "Are you sure you want to cancel this consultation request? You will be issued a refund payment ticket immediately.",
      type: 'danger',
      onConfirm: async () => {
        try {
          const consRef = doc(db, 'consultations', activeConsultation.sessionId);
          await updateDoc(consRef, {
            status: 'CANCELLED_BY_USER',
            dispatchStatus: 'cancelled',
            isOnHold: false,
            holdReason: "",
            updatedAt: new Date().toISOString(),
            cancelReason: 'Cancelled by patient manually prior to connection'
          });

          await issueTicket({
            patientId: activeConsultation.patientId,
            patientName: activeConsultation.patientName,
            originalSessionId: activeConsultation.sessionId,
            reason: 'failed_session',
            notes: 'Session manually cancelled by the patient before connection.',
            valueGHS: activeConsultation.amountPaidGHS || 0
          });

          showToast("Your consultation request has been cancelled. A compensation ticket has been credited to your account.", "success");
          navigate(role === 'patient' ? '/patient/dashboard' : '/dashboard');
        } catch (err: any) {
          console.error("Cancellation error:", err);
          showToast("Failed to cancel session. Please try again.", "error");
        }
      }
    });
  };

  const activeSessionId = activeConsultation?.sessionId;
  const activeSessionStatus = activeConsultation?.status;
  const activeSessionOnHold = activeConsultation?.isOnHold;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showGraceTimer && graceSecondsLeft > 0) {
      interval = setInterval(() => {
        setGraceSecondsLeft(prev => prev - 1);
      }, 1000);
    } else if (graceSecondsLeft === 0) {
      if (activeSessionId && (activeSessionStatus === 'IN_PROGRESS' || activeSessionOnHold)) {
        updateDoc(doc(db, 'consultations', activeSessionId), {
          status: 'TERMINATED_SYSTEM_FAILURE',
          isOnHold: false,
          holdReason: "",
          updatedAt: serverTimestamp(),
          visitSummary: 'Session terminated due to persistent connection failure (grace period expired).'
        }).catch(console.error);
      }

      if (role === 'patient') {
        setShowRatingModal(true);
      } else {
        navigate('/consultant/dashboard');
      }
    }
    return () => clearInterval(interval);
  }, [showGraceTimer, graceSecondsLeft, role, navigate, activeSessionId, activeSessionStatus, activeSessionOnHold]);

  const [livekitOptions] = useState(() => ({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h1080.resolution,
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    publishDefaults: {
      videoEncoding: VideoPresets.h1080.encoding,
      videoSimulcastLayers: [VideoPresets.h1080, VideoPresets.h720, VideoPresets.h360],
      dtx: true,
      red: true,
      videoCodec: 'vp8' as const,
    },
  }));

  const activeConsultationRef = useRef(activeConsultation);
  useEffect(() => {
    activeConsultationRef.current = activeConsultation;
  }, [activeConsultation]);

  const onDisconnected = useCallback(async () => {
    const currentSessionId = activeConsultationRef.current?.sessionId;
    if (isEngineConnected && currentSessionId) {
      try {
        await updateDoc(doc(db, 'consultations', currentSessionId), {
          isOnHold: true,
          holdReason: 'Participant disconnected (3m grace active)',
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to set session on hold after disconnect:", err);
      }
    }
    setIsEngineConnected(false);
    setShowGraceTimer(true);
  }, [isEngineConnected]);

  const onReconnected = useCallback(async () => {
    setIsEngineConnected(true);
    setShowGraceTimer(false);
    setGraceSecondsLeft(180);
    const currentSessionId = activeConsultationRef.current?.sessionId;
    if (currentSessionId) {
      try {
        await updateDoc(doc(db, 'consultations', currentSessionId), {
          isOnHold: false,
          holdReason: null,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Failed to resume session after reconnect:", err);
      }
    }
  }, []);

  const [scannedPrescriptions, setScannedPrescriptions] = useState<any[]>([]);
  const [selectedScanFile, setSelectedScanFile] = useState<File | null>(null);
  const [scanPreviewUrl, setScanPreviewUrl] = useState<string | null>(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanOcrResult, setScanOcrResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [localActiveDocumentUrl, setLocalActiveDocumentUrl] = useState<string | null>(null);
  const [scanActionType, setScanActionType] = useState<'scan' | 'upload' | null>(null);

  useEffect(() => {
    if (activeConsultation?.ocrImageUrl) {
      setLocalActiveDocumentUrl(activeConsultation.ocrImageUrl);
    } else {
      setLocalActiveDocumentUrl(null);
    }
  }, [activeConsultation?.ocrImageUrl]);

  useEffect(() => {
    const sId = activeConsultation?.sessionId;
    if (!sId || !isAcceptedSession) return;
    console.log('[ConsultationRoom] Subscribing to scanned prescriptions for:', sId);
    const q = query(
      collection(db, 'consultations', sId, 'scanned_prescriptions')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setScannedPrescriptions(items);
    }, (err) => {
      console.warn("Scanned prescriptions listener error:", err);
    });
    return () => unsubscribe();
  }, [activeConsultation?.sessionId]);

  const handleScanFileChange = (e: React.ChangeEvent<HTMLInputElement>, actionType: 'scan' | 'upload' = 'scan') => {
    setScanActionType(actionType);
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setScanError('Please select a valid image file (JPG, PNG, WEBP).');
        return;
      }
      setSelectedScanFile(file);
      setScanError(null);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1600;
          
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            setScanPreviewUrl(compressedBase64);
          } else {
            setScanPreviewUrl(reader.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const processScanOcr = async () => {
    if (!scanPreviewUrl) return;
    setIsProcessingScan(true);
    setScanError(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          imageBase64: scanPreviewUrl,
          mimeType: selectedScanFile?.type || 'image/jpeg'
        })
      });

      if (!response.ok) {
        throw new Error('OCR API request failed');
      }

      const data = await response.json();
      if (data.result) {
        setScanOcrResult(data.result);
      } else {
        throw new Error('No readable text returned from OCR analysis');
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      setScanError(err.message || 'Failed to scan document. Please ensure the image is clear.');
    } finally {
      setIsProcessingScan(false);
    }
  };

  const saveScanToConsultation = async () => {
    if (!scanOcrResult || !activeConsultation) return;

    try {
      setIsProcessingScan(true);
      let uploadedImageUrl = scanPreviewUrl;

      if (selectedScanFile) {
        try {
          const storageRef = ref(storage, `scanned_prescriptions/${activeConsultation.sessionId}/${Date.now()}_${selectedScanFile.name}`);
          await uploadBytes(storageRef, selectedScanFile);
          uploadedImageUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          console.warn("[Storage Fallback] Firebase Storage prescription upload failed, using compressed base64 preview instead:", storageErr);
          // Keep base64 image (uploadedImageUrl is already scanPreviewUrl)
        }
      }

      const rxId = 'SCAN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const formattedOcrText = JSON.stringify(scanOcrResult, null, 2);

      const scannedRx = {
        rxId,
        patientId: activeConsultation.patientId,
        patientName: activeConsultation.patientName || 'Patient',
        consultantId: activeConsultation.consultantId || '',
        sessionId: activeConsultation.sessionId,
        imageUrl: uploadedImageUrl,
        ocrResult: scanOcrResult,
        rawText: scanOcrResult.rawText || '',
        summary: scanOcrResult.summary || '',
        medications: scanOcrResult.medications || [],
        prescriberName: scanOcrResult.prescriberName || '',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'consultations', activeConsultation.sessionId, 'scanned_prescriptions', rxId), scannedRx);
      await setDoc(doc(db, 'users', activeConsultation.patientId, 'scanned_prescriptions', rxId), scannedRx);

      const consultRef = doc(db, 'consultations', activeConsultation.sessionId);
      if (scanActionType === 'upload') {
        await updateDoc(consultRef, {
          ocrExtractedText: formattedOcrText
        });
      } else {
        await updateDoc(consultRef, {
          ocrExtractedText: formattedOcrText,
          ocrImageUrl: uploadedImageUrl
        });
      }

      const msgId = 'MSG-SYS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      await setDoc(doc(db, 'consultations', activeConsultation.sessionId, 'messages', msgId), {
        messageId: msgId,
        consultationId: activeConsultation.sessionId,
        senderId: 'system_ocr',
        senderRole: 'patient',
        senderName: scanActionType === 'upload' ? 'Patient Attachment (Uploaded Document)' : 'Patient Attachment (Scanned Prescription)',
        text: scanActionType === 'upload'
          ? `📋 **New Document Uploaded & Shared:**\n${scanOcrResult.summary || ''}\n\n**Extracted Items:**\n${(scanOcrResult.medications || []).map((m: any) => `• ${m.name} ${m.dosage || ''} (${m.frequency || ''}) - ${m.instructions || ''}`).join('\n')}`
          : `📋 **New Prescription Scanned & Shared:**\n${scanOcrResult.summary || ''}\n\n**Extracted Items:**\n${(scanOcrResult.medications || []).map((m: any) => `• ${m.name} ${m.dosage || ''} (${m.frequency || ''}) - ${m.instructions || ''}`).join('\n')}`,
        attachmentUrl: uploadedImageUrl,
        timestamp: new Date().toISOString()
      });

      setSelectedScanFile(null);
      setScanPreviewUrl(null);
      setScanOcrResult(null);
      setScanError(null);
      
      
      if (scanActionType === 'upload') {
        showToast("Document uploaded, saved to records, and shared in the consultation!", "success");
      } else {
        showToast("Prescription scanned, saved to your records, and shared in the consultation successfully!", "success");
      }
    } catch (err: any) {
      console.error('Error saving scanned prescription:', err);
      setScanError(err.message || 'Failed to save and attach scanned prescription.');
    } finally {
      setIsProcessingScan(false);
    }
  };
  
  const [patientVitals, setPatientVitals] = useState<VitalsRecord[]>([]);
  const [rawNotes, setRawNotes] = useState('');
  const [isGeneratingSOAP, setIsGeneratingSOAP] = useState(false);
  const [generatedSOAP, setGeneratedSOAP] = useState('');

  // Patient Auto-Process Scans
  useEffect(() => {
    if (role === 'patient' && scanPreviewUrl && !scanOcrResult && !isProcessingScan && !scanError) {
      processScanOcr();
    }
  }, [role, scanPreviewUrl, scanOcrResult, isProcessingScan, scanError]);

  useEffect(() => {
    if (role === 'patient' && scanOcrResult && scanPreviewUrl && !isProcessingScan && !scanError) {
      saveScanToConsultation();
    }
  }, [role, scanOcrResult, scanPreviewUrl, isProcessingScan, scanError]);


  useEffect(() => {
    if (activeConsultation?.status === 'COMPLETED' || activeConsultation?.status === 'CANCELLED_BY_USER') {
      if (role === 'patient') {
        if (!activeConsultation.patientRating && activeConsultation?.status === 'COMPLETED') {
          setShowRatingModal(true);
        }
      } else if (isConsultant) {
        if (!activeConsultation.isConsultantSigned) {
          setShowReviewSignatureModal(true);
        }
      }
    }
  }, [activeConsultation?.status, activeConsultation?.patientRating, activeConsultation?.isConsultantSigned, role, isConsultant]);

  useEffect(() => {
    if (!activeConsultation || activeConsultation.status === 'COMPLETED') return;

    const baseDurationMins = activeConsultation.tierDurationMinutes || 15;
    const extensionMins = (activeConsultation.extensionCount || 0) * 10;
    const totalDurationMs = (baseDurationMins + extensionMins) * 60 * 1000;
    const totalDurationSecs = Math.floor(totalDurationMs / 1000);

    const isAccepted = activeConsultation.status === 'IN_PROGRESS' || activeConsultation.status === 'ACTIVE' || activeConsultation.dispatchStatus === 'accepted';

    if (!isAccepted) {
      setSecondsRemaining(totalDurationSecs);
      return;
    }

    const startTimeMs = activeConsultation.acceptedAt 
      ? new Date(activeConsultation.acceptedAt).getTime() 
      : activeConsultation.startedAt 
        ? new Date(activeConsultation.startedAt).getTime() 
        : Date.now();

    const expiryTimeMs = startTimeMs + totalDurationMs;

    const updateTimer = () => {
      if (activeConsultation.isOnHold) return;

      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((expiryTimeMs - now) / 1000));
      setSecondsRemaining(diffSecs);

      if (diffSecs === 0 && isAcceptedSession && !activeConsultation.isOnHold && (activeConsultation.status === 'IN_PROGRESS' || activeConsultation.status === 'ACTIVE')) {
        updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
          isOnHold: true,
          holdReason: 'Session duration limit reached (00:00)'
        }).catch(console.error);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [
    activeConsultation?.sessionId, 
    activeConsultation?.acceptedAt, 
    activeConsultation?.startedAt, 
    activeConsultation?.tierDurationMinutes, 
    activeConsultation?.extensionCount, 
    activeConsultation?.isOnHold, 
    activeConsultation?.status,
    activeConsultation?.dispatchStatus,
    isAcceptedSession
  ]);

  const handleExtendSession = async () => {
    if (!activeConsultation) return;
    setIsExtending(true);
    try {
      if (user?.videoChatTickets && user.videoChatTickets > 0 && role === 'patient') {
        await updateUserProfile({ videoChatTickets: user.videoChatTickets - 1 });
        const currentExtensions = activeConsultation.extensionCount || 0;
        await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
          extensionCount: currentExtensions + 1,
          isOnHold: false
        });
        showToast(`Session successfully extended by +10 minutes using 1 Video Chat Ticket! (${user.videoChatTickets - 1} tickets remaining)`, "success");
      } else {
        const currentExtensions = activeConsultation.extensionCount || 0;
        await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
          extensionCount: currentExtensions + 1,
          isOnHold: false,
          amountPaidGHS: (activeConsultation.amountPaidGHS || 0) + 15
        });
        showToast("Session successfully extended by +10 minutes!", "success");
      }
    } catch (err) {
      console.error("Failed to extend session:", err);
      showToast("Failed to extend session. Please try again.", "error");
    } finally {
      setIsExtending(false);
    }
  };

  const activePatientId = activeConsultation?.patientId;
  useEffect(() => {
    if (!activePatientId || role !== 'consultant' || !isAcceptedSession) return;
    
    console.log('[ConsultationRoom] Subscribing to patient vitals:', activePatientId);
    const vQ = query(collection(db, 'vitals'), where('patientId', '==', activePatientId));
    const unsubscribe = onSnapshot(vQ, (snap) => {
      const data: VitalsRecord[] = [];
      snap.forEach(d => data.push(d.data() as VitalsRecord));
      data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setPatientVitals(data);
    }, (err) => console.warn("ConsultationRoom vitals snapshot error:", err));

    return () => unsubscribe();
  }, [activePatientId, role]);

  const handleGenerateSOAP = async () => {
    if (!(rawNotes || '').trim()) return;
    setIsGeneratingSOAP(true);
    try {
      const response = await fetch('/api/ai/soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rawNotes })
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedSOAP(data.result);
      } else {
        showToast(data.error || 'Failed to generate SOAP note', "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to AI service', "error");
    } finally {
      setIsGeneratingSOAP(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeConsultation) return;
    try {
      await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
        clinicalNotes: generatedSOAP || rawNotes
      });
      showToast('Notes saved successfully.', "success");
    } catch (err) {
      console.error(err);
      showToast('Failed to save notes.', "error");
    }
  };

  const handleDownloadPDF = () => {
    if (!activeConsultation) return;
    
    import('jspdf').then(({ jsPDF }) => {
      const docPdf = new jsPDF();
      const isPatient = role === 'patient';
      
      docPdf.setFontSize(22);
      docPdf.setTextColor(79, 70, 229);
      docPdf.text("PockettClinic Visit Summary", 20, 20);
      
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 116, 139);
      docPdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      docPdf.line(20, 35, 190, 35);

      docPdf.setFontSize(12);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text(`Patient: ${activeConsultation.patientName}`, 20, 45);
      docPdf.text(`Consultant: ${activeConsultation.consultantName || 'Consultant'}`, 20, 52);
      docPdf.text(`Session ID: ${activeConsultation.sessionId}`, 20, 59);
      
      docPdf.line(20, 64, 190, 64);

      let yOffset = 75;

      if (activeConsultation.chiefComplaints) {
        docPdf.setFontSize(14);
        docPdf.setFont("helvetica", "bold");
        docPdf.text("Chief Complaints", 20, yOffset);
        yOffset += 7;
        
        docPdf.setFontSize(12);
        docPdf.setFont("helvetica", "normal");
        const splitComplaints = docPdf.splitTextToSize(activeConsultation.chiefComplaints, 170);
        docPdf.text(splitComplaints, 20, yOffset);
        yOffset += (splitComplaints.length * 6) + 10;
      }

      const notesToPrint = isPatient ? (activeConsultation.visitSummary || activeConsultation.clinicalNotes || '') : (activeConsultation.clinicalNotes || '');
      
      if (notesToPrint) {
        const plainTextNotes = notesToPrint.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        
        docPdf.setFontSize(14);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(isPatient ? "Visit Summary / Medical Advice" : "Clinical Notes (SOAP)", 20, yOffset);
        yOffset += 7;
        
        docPdf.setFontSize(12);
        docPdf.setFont("helvetica", "normal");
        const splitNotes = docPdf.splitTextToSize(plainTextNotes, 170);
        docPdf.text(splitNotes, 20, yOffset);
      }

      docPdf.save(`PockettClinic_Summary_${activeConsultation.sessionId}.pdf`);
    }).catch(err => {
      console.error("Failed to load jsPDF", err);
      showToast("Failed to generate PDF. Please try again.", "error");
    });
  };

  const consultantName = activeConsultation?.consultantName;
  const consultantPrefix = activeConsultation?.consultantPrefix;
  const patientName = activeConsultation?.patientName;
  const userDisplayName = user?.displayName;

  useEffect(() => {
    if (!urlRoomName || !isAcceptedSession || isFetchingToken || token || connectionError) return;

    const fetchToken = async () => {
      setIsFetchingToken(true);
      try {
        const participantName = (isConsultant 
          ? formatConsultantName(activeConsultation?.consultantName, activeConsultation?.consultantPrefix) 
          : activeConsultation?.patientName) || user?.displayName || (isConsultant ? 'Consultant' : 'Patient');

        const idToken = await auth.currentUser?.getIdToken();

        const response = await fetch('/api/agora/token', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            roomName: urlRoomName,
            participantName: participantName
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          const tokenString = JSON.stringify({ token: data.token, appId: data.appId, uid: data.uid, room: urlRoomName });
  if (typeof tokenString === 'string') {
            setToken(tokenString);
          } else {
            setConnectionError('Invalid token format received from server');
          }
        } else {
          setConnectionError(data.error || 'Failed to get connection token');
        }
      } catch (error) {
        setConnectionError('Network error connecting to media server');
      } finally {
        setIsFetchingToken(false);
      }
    };

    fetchToken();
  }, [urlRoomName, role, activeConsultation, user?.displayName, token, connectionError, isFetchingToken]);

  const submitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !activeConsultation) return;
    
    setIsSubmittingRating(true);
    try {
      await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
        patientRating: rating,
        patientReviewText: feedback
      });
      setRatingSubmitted(true);
      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Failed to submit rating', err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunks.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        recordedChunks.current = [];
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });

        setIsUploadingRecording(true);
        try {
          const storageRef = ref(storage, `consultation_recordings/${urlRoomName}_${Date.now()}.webm`);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          
          if (urlRoomName) {
            await updateDoc(doc(db, 'consultations', urlRoomName), {
              recordingUrl: url
            });
            updateConsultation(urlRoomName, { recordingUrl: url });
          }
        } catch (err) {
          console.error("Failed to upload recording", err);
          showToast("Failed to upload the recording. Please try again.", "error");
        } finally {
          setIsUploadingRecording(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      showToast("Could not start recording. Please check permissions or use a supported browser.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && typeof mediaRecorderRef.current.stop === 'function') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("[MediaRecorder] Stop error:", e);
      }
    }
  };

  if (activeConsultation?.status === 'INCONCLUSIVE') {
    const isEscalated = !!activeConsultation?.inconclusiveContext;
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto mt-12 bg-white rounded-[32px] border border-slate-200 shadow-lg animate-in fade-in">
        <AlertTriangle size={48} className="text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-black tracking-tight text-slate-800">{isEscalated ? 'Consultation Escalated/Inconclusive' : 'Consultation Inconclusive'}</h2>
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          {isEscalated 
            ? "The consultant has marked this session as inconclusive (e.g., requires escalation to a doctor). Your progress has been saved to your vault."
            : "The consultant was unable to accept your request within the ringing period. The session has timed out."
          }
        </p>
        {!isEscalated && (
          <div className="mt-4 p-3.5 bg-slate-50 border border-indigo-100 rounded-2xl text-indigo-950 text-xs font-bold leading-relaxed text-center">
            The medical issue still holds and has been onboarded! A full refund ticket has been generated and credited to your account.
          </div>
        )}
        {(() => {
          const activePatientTickets = (tickets || []).filter(t => t.patientId === user?.uid && t.status === 'active');
          if (activePatientTickets.length === 0) return null;
          return (
            <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-4 w-full">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left mb-2.5">Refund Tickets Credited</p>
              <div className="space-y-1.5">
                {activePatientTickets.map((t: any) => (
                  <div key={t.ticketId} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono font-black text-slate-600">{t.ticketId}</span>
                    <span className="font-bold text-slate-600">Reason: {t.reason || 'Support Ticket'}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <button 
          onClick={() => navigate('/patient/dashboard')} 
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-600 text-white font-black px-6 py-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!isConsultant && (activeConsultation?.status === 'CANCELLED' || activeConsultation?.status === 'CANCELLED_BY_USER' || activeConsultation?.status === 'CANCELLED_BY_CONSULTANT')) {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center max-w-md mx-auto mt-12 bg-white rounded-[32px] border border-slate-200 shadow-lg animate-in fade-in">
        <XCircle size={48} className="text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-black tracking-tight text-slate-800">Consultation Cancelled</h2>
        <p className="text-slate-600 text-sm mt-2 leading-relaxed">
          This consultation request was successfully cancelled.
        </p>
        <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-950 text-xs font-bold leading-relaxed text-center">
          A full payment refund ticket has been generated and credited to your account.
        </div>
        <button 
          onClick={() => navigate('/patient/dashboard')} 
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-600 text-white font-black px-6 py-4 rounded-xl shadow-md transition-all text-xs uppercase tracking-wider"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (isSessionLoading) {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 text-slate-600 animate-spin mb-4" />
        <h2 className="text-lg font-black tracking-tight text-slate-800">Securing Clinical Connection...</h2>
        <p className="text-xs text-slate-600 mt-2 max-w-sm">
          Establishing encrypted end-to-end medical room parameters. Please hold.
        </p>
      </div>
    );
  }

  if (!activeConsultation) {
    return (
      <div className="flex-1 p-8 text-center flex flex-col items-center justify-center">
        <h2 className="text-xl font-black tracking-tight text-slate-800">Session Not Found</h2>
        <p className="text-slate-600 mt-2">This consultation link is invalid or expired.</p>
        <button onClick={() => navigate(isConsultant ? '/consultant/dashboard' : '/patient/dashboard')} className="mt-4 text-slate-600 font-bold hover:underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Strict Lifecycle Gate: If call is not yet accepted, render ONLY the Awaiting Connection UI
  if (!isAcceptedSession) {
    return (
      <div className="flex-1 w-full min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-lg bg-white rounded-[32px] p-8 border border-slate-200 shadow-xl text-center flex flex-col items-center">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 bg-emerald-600 rounded-full animate-ping opacity-25"></div>
            <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center relative z-10 shadow-lg">
              <Clock size={36} className="text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>
          <h2 className="font-extrabold text-2xl text-slate-900 mb-2 flex items-center justify-center gap-1 tracking-tight">
            Awaiting Consultant Connection
            <span className="flex gap-1">
              <span className="animate-bounce delay-75 text-emerald-600">.</span>
              <span className="animate-bounce delay-150 text-emerald-600">.</span>
              <span className="animate-bounce delay-300 text-emerald-600">.</span>
            </span>
          </h2>
          <p className="text-slate-500 text-sm font-medium max-w-md mb-8 leading-relaxed">
            Your request has been dispatched. The video conference room and clinical workspace will launch automatically as soon as the consultant accepts your booking.
          </p>
          {role === 'patient' && (
            <button
              onClick={handleCancelSession}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-4 px-6 rounded-2xl shadow-lg shadow-rose-600/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <X size={16} /> Cancel Consultation Request
            </button>
          )}
          <button
            onClick={() => navigate(role === 'consultant' ? '/consultant/dashboard' : '/patient/dashboard')}
            className="mt-4 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const otherPersonName = isConsultant ? activeConsultation.patientName : (activeConsultation.consultantName || 'Consultant');

  const minsLeft = Math.floor(secondsRemaining / 60);
  const secsLeft = secondsRemaining % 60;
  const formattedTimer = `${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')}`;

  const isWarningTimer = isAcceptedSession && secondsRemaining > 0 && secondsRemaining <= 180;
  const isExpiredTimer = isAcceptedSession && (secondsRemaining === 0 || activeConsultation.isOnHold);

  const isPatientFaceTimeMode = !isConsultant && activeConsultation?.type !== 'chat' && activeConsultation?.sessionType !== 'CHAT_ONLY';

  return (
    <AgoraRTCProvider client={agoraClient}>
      <div className={`fixed inset-0 z-[100] md:z-auto ${isPatientFaceTimeMode ? 'bg-black p-0 overflow-hidden' : 'bg-[#F8FAFC] md:bg-transparent p-0 md:p-4 lg:p-6'} flex-1 w-full flex flex-col transition-all duration-300 ${isConsultant ? 'md:h-[calc(100vh-64px)] md:max-h-[calc(100vh-64px)] md:overflow-hidden' : (isPatientFaceTimeMode ? 'h-[100dvh]' : 'md:min-h-[calc(100vh-4rem)]')}`}>
      
      <div className={`flex flex-col lg:flex-row ${isPatientFaceTimeMode ? 'gap-0' : 'gap-4 lg:gap-6'} flex-1 items-stretch overflow-hidden`}>
        <div className={`space-y-0 md:space-y-4 h-full flex flex-col transition-all duration-300 ease-in-out flex-1 min-w-0 ${
          isConsultant ? 'h-full' : ''
        } ${activeConsultation?.type === 'chat' || activeConsultation?.sessionType === 'CHAT_ONLY' ? 'hidden lg:flex w-full h-auto' : ''} flex`}>
          
          {/* Header Row */}
          <div className="flex items-center justify-between bg-white md:bg-white p-3 md:p-4 rounded-none md:rounded-2xl border-b md:border border-slate-200 shadow-sm shrink-0 z-10 sticky top-[48px] md:relative">
             <div className="flex items-center gap-2 md:gap-3">
               <button 
                 onClick={() => {
                   if (role === 'patient') {
                     setShowRatingModal(true);
                   } else {
                     navigate('/consultant/dashboard');
                   }
                 }} 
                 className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-600"
               >
                 <ArrowLeft size={20} />
               </button>
               <div className="flex flex-col md:flex-row md:items-center gap-0 md:gap-3">
                 <div className="flex items-center gap-2">
                   <h2 className="text-sm md:text-lg font-black tracking-tight text-slate-800 line-clamp-1">
                     {role === 'consultant' ? activeConsultation.patientName : (activeConsultation.consultantName || 'Consultant')}
                    {role === 'patient' && consultantRoleLabel && (
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {consultantRoleLabel}
                      </span>
                    )}
                   </h2>
                   {activeConsultation.preferredLanguage && (
                     <span className="hidden md:flex bg-white text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full items-center gap-1">
                       <Globe size={10} /> {activeConsultation.preferredLanguage}
                     </span>
                   )}
                 </div>
                 
                 {/* Mobile Integrated Timer */}
                 <div className="md:hidden flex items-center gap-1.5 text-[10px] font-black text-slate-500">
                   <Clock size={12} className={!isAcceptedSession ? 'animate-pulse text-amber-500' : isWarningTimer ? 'text-amber-600' : isExpiredTimer ? 'text-rose-600' : 'text-slate-500'} />
                   <span className={isWarningTimer ? 'text-amber-700' : isExpiredTimer ? 'text-rose-700' : ''}>
                     {!isAcceptedSession ? 'Pending' : formattedTimer}
                   </span>
                 </div>

                 <p className="hidden md:block text-xs text-slate-600">
                   {activeConsultation.isOnHold ? 'Session on Hold' : 'Session In Progress'}
                 </p>
               </div>
             </div>

             <div className="flex items-center gap-2">
                {/* Patient Actions */}
                {role === 'patient' && (
                  <div className="flex items-center gap-2">
                    {activeConsultation?.status === 'COMPLETED' && (
                      <button
                        onClick={handleDownloadPDF}
                        className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-[10px] md:text-xs px-3 md:px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                      >
                        <Download size={14} />
                        <span className="hidden md:inline">Download PDF Summary</span>
                        <span className="md:hidden">PDF</span>
                      </button>
                    )}
                    {isExpiredTimer && (
                      <button
                        onClick={handleExtendSession}
                        disabled={isExtending}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] md:text-xs px-3 md:px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        {isExtending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        <span>Extend</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Desktop Timer (Original) */}
                <div className={`hidden md:flex px-3 py-1.5 rounded-xl border text-xs font-black items-center gap-2 shadow-sm ${
                  !isAcceptedSession
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : isExpiredTimer 
                      ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' 
                      : isWarningTimer 
                        ? 'bg-amber-50 text-amber-800 border-amber-300 animate-bounce' 
                        : 'bg-slate-50 text-slate-600 border-slate-300'
                }`}>
                  <Clock size={16} className={!isAcceptedSession ? 'text-amber-600 animate-pulse' : isWarningTimer ? 'text-amber-600' : isExpiredTimer ? 'text-rose-600' : 'text-slate-600'} />
                  <span>{!isAcceptedSession ? 'Awaiting Acceptance' : formattedTimer}</span>
                </div>

                {isConsultant && (
                  <div className="flex items-center gap-2">
                    {/* Persistent Primary Action: Complete */}
                    {/* Inconclusive Action */}
                    <button 
                      onClick={() => setShowInconclusiveModal(true)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <AlertTriangle size={16} />
                      <span className="hidden md:inline">Inconclusive</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (activeConsultation?.sessionId) {
                          updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
                            status: 'COMPLETED',
                            endedAt: serverTimestamp()
                          }).catch(console.error);
                        }
                        setShowReviewSignatureModal(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <CheckCircle2 size={16} />
                      <span className="hidden md:inline">Complete Session</span>
                      <span className="md:hidden">Complete</span>
                    </button>

                    {/* Secondary Actions: Mobile Menu / Desktop Inline */}
                    <div className="relative">
                      <button
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className="md:hidden p-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                        <MoreVertical size={20} />
                      </button>

                      {/* Mobile Actions Drawer/Menu */}
                      <AnimatePresence>
                        {showActionMenu && (
                          <>
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setShowActionMenu(false)}
                              className="fixed inset-0 bg-slate-900/40 z-[110] md:hidden backdrop-blur-sm"
                     />
                            <motion.div
                              initial={{ y: "100%" }}
                              animate={{ y: 0 }}
                              exit={{ y: "100%" }}
                              transition={{ type: "spring", damping: 25, stiffness: 200 }}
                              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-6 z-[120] md:hidden shadow-2xl space-y-3"
                            >
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Clinical Actions</h3>
                              
                              <button
                                onClick={() => { setShowReferralModal(true); setShowActionMenu(false); }}
                                className="w-full flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all"
                              >
                                <UserPlus size={18} /> Refer to Consultant
                              </button>

                              <button
                                onClick={() => { setShowTriageSlipModal(true); setShowActionMenu(false); }}
                                className="w-full flex items-center gap-3 p-4 bg-slate-50 text-slate-800 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all border border-slate-100"
                              >
                                <FileText size={18} /> View Triage Slip
                              </button>

                              <button
                                onClick={() => { isRecording ? stopRecording() : startRecording(); setShowActionMenu(false); }}
                                className={`w-full flex items-center gap-3 p-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all ${isRecording ? 'bg-rose-50 text-rose-800 border border-rose-100' : 'bg-slate-50 text-slate-800 border border-slate-100'}`}
                              >
                                <Video size={18} /> {isRecording ? 'Stop Recording' : 'Start Recording'}
                              </button>

                              <button
                                onClick={() => { setShowRxModal(true); setShowActionMenu(false); }}
                                className="w-full flex items-center gap-3 p-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/20"
                              >
                                <Plus size={18} /> Issue Prescription
                              </button>

                              <button
                                onClick={() => setShowActionMenu(false)}
                                className="w-full p-4 text-slate-500 font-bold text-sm"
                              >
                                Cancel
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                      {/* Desktop Actions Inline */}
                      <div className="hidden md:flex items-center gap-2">
                        <button
                          onClick={() => setShowReferralModal(true)}
                          className="bg-emerald-600 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <UserPlus size={15} /> Refer to Consultant
                        </button>
                        <button
                          onClick={() => setShowTriageSlipModal(true)}
                          className="bg-white hover:bg-slate-50 text-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200"
                        >
                          <FileText size={14} className="text-slate-600" /> Triage
                        </button>
                        <button 
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1 shadow-sm ${isRecording ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                        >
                          <Video size={14} /> {isRecording ? 'Stop Rec' : 'Record'}
                        </button>
                        <button 
                          onClick={() => setShowRxModal(true)}
                          className="bg-emerald-600 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={14} /> Issue Rx
                        </button>
                      </div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* On-Hold Session Extension Alert Banner */}
          {activeConsultation.isOnHold && (
            (() => {
              const isDisconnectionHold = activeConsultation.holdReason?.toLowerCase().includes('disconnect') || false;
              
              if (isDisconnectionHold) {
                return (
                  <div className="bg-rose-50 border-slate-100 border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                        <AlertCircle size={20} className="text-rose-600 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-bold text-rose-950 text-sm">Consultation Paused (Connection Interrupted)</h4>
                        <p className="text-xs text-rose-800">
                          {role === 'patient'
                            ? 'The consultant lost connection. We are waiting for them to reconnect. Your session timer is paused.'
                            : 'The patient lost connection or has not entered the room yet. The session timer is paused.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
                            isOnHold: false,
                            holdReason: null,
                            updatedAt: new Date().toISOString()
                          });
                        } catch (e) {
                          console.error("Failed to resume call:", e);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-600 active:scale-95 text-slate-600 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                    >
                      Resume Call
                    </button>
                  </div>
                );
              }

              return (
                <div className="bg-amber-50 border-slate-100 border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm">Session Duration Limit Reached (On Hold)</h4>
                      <p className="text-xs text-amber-800">
                        {role === 'patient' 
                          ? 'Your standard session time has ended. Extend for +10 minutes to continue consultation.' 
                          : 'The consultation duration has expired. Awaiting patient extension top-up.'}
                      </p>
                    </div>
                  </div>
                  {role === 'patient' && (
                    <button
                      onClick={handleExtendSession}
                      disabled={isExtending}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-slate-600 text-xs font-bold px-5 py-3 rounded-xl transition-colors shrink-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-1.5"
                    >
                      {isExtending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Top Up +10 Mins (GHS 15)
                    </button>
                  )}
                </div>
              );
            })()
          )}

          {/* Patient Guidance Banner */}
          <ReferralGuidanceBanner consultation={activeConsultation} />

          {/* Patient Inter-Consultant Referral Banners */}
          {role === 'patient' && activeConsultation?.referralState === 'PROPOSED' && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-indigo-500/10 border-slate-100 border-amber-400 rounded-3xl p-5 mb-4 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-600 flex items-center justify-center shrink-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <UserPlus size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded uppercase">Referral Proposed</span>
                    <h4 className="text-sm font-extrabold text-slate-800">
                      Primary Consultant recommends a referral to a {
                        activeConsultation.referralTargetCategory === 'DOCTOR' ? 'Doctor' :
                        activeConsultation.referralTargetCategory === 'PHARMACIST' ? 'Pharmacist' :
                        activeConsultation.referralTargetCategory === 'PHYSICIAN_ASSISTANT' ? 'Physician Assistant' :
                        activeConsultation.referralTargetCategory === 'PHARM_TECH' ? 'Pharmacy Technician' :
                        activeConsultation.referralTargetCategory === 'SPECIALIST' ? 'Specialist' : 'Consultant'
                      }
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Rationale: "{activeConsultation.referralNote || 'Consultant has requested a specialist review.'}" • Top-Up Fee: GHS {activeConsultation.referralFeeGHS || 30}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPatientReferralModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-slate-600 font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-amber-600/20 whitespace-nowrap transition-all uppercase tracking-wider shrink-0 cursor-pointer"
              >
                Review & Accept Referral
              </button>
            </div>
          )}
          <div className={`bg-slate-950 overflow-hidden relative flex items-center justify-center transition-all duration-300 ${isPatientFaceTimeMode ? 'rounded-none shadow-none w-full h-full flex-1' : `rounded-[32px] shadow-2xl ${activeConsultation?.type === 'chat' || activeConsultation?.sessionType === 'CHAT_ONLY' ? 'hidden' : (role === 'consultant' ? 'w-full h-full flex-1 rounded-none md:rounded-[32px]' : (!isAcceptedSession ? 'w-full min-h-[420px] lg:aspect-auto lg:flex-1' : 'w-full aspect-video lg:aspect-auto lg:flex-1'))}`}`}>
             {!isAcceptedSession ? (
               <div className={`w-full h-full z-10 flex flex-col items-center justify-center p-6 text-center ${isPatientFaceTimeMode ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-600 min-h-[420px] rounded-[32px]'}`}>
                 <div className="relative flex items-center justify-center mb-6">
                   <div className="absolute inset-0 bg-emerald-600 rounded-full animate-ping opacity-25"></div>
                   <div className={`w-20 h-20 rounded-full flex items-center justify-center relative z-10 shadow-2xl ${isPatientFaceTimeMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200/80'}`}>
                      <Clock size={32} className="text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} />
                   </div>
                 </div>
                 <h3 className={`font-extrabold text-2xl mb-2 flex items-center justify-center gap-2 ${isPatientFaceTimeMode ? 'text-white' : 'text-slate-900'}`}>
                   Awaiting Consultant Connection
                   <span className="flex gap-1"><span className="animate-bounce delay-75 text-emerald-600">.</span><span className="animate-bounce delay-150 text-emerald-600">.</span><span className="animate-bounce delay-300 text-emerald-600">.</span></span>
                 </h3>
                 <p className={`text-sm font-medium max-w-md mb-8 leading-relaxed ${isPatientFaceTimeMode ? 'text-slate-400' : 'text-slate-500'}`}>
                   Your request has been dispatched. The video conference room and timer will start automatically as soon as the consultant accepts your booking.
                 </p>
                 {role === 'patient' && (
                   <button
                     onClick={handleCancelSession}
                     className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-8 py-4 rounded-2xl shadow-lg shadow-rose-600/30 transition-all uppercase tracking-widest flex items-center gap-2 active:scale-95 cursor-pointer"
                   >
                     <X size={16} /> Cancel Consultation Request
                   </button>
                 )}
               </div>
              ) : (activeConsultation?.status === 'COMPLETED' || activeConsultation?.status === 'CANCELLED_BY_USER') ? (
                <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white rounded-[32px] p-8 text-center animate-in fade-in">
                  <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={48} className="text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Session Completed</h2>
                  <p className="text-slate-400 max-w-md">
                    {isConsultant 
                      ? "The consultation has ended. Please complete your post-session wrap-up."
                      : "The consultation has ended. Thank you for using PockettClinic."}
                  </p>
                </div>
              ) : (token && typeof token === "string") ? (
                <AgoraRoom token={token} consultationType={activeConsultation?.type || activeConsultation?.sessionType} isConsultant={isConsultant}>
                  <div className="w-full h-full relative">
                      <SafeRoomComponent>
                        <ConnectionMonitor sessionId={activeConsultation?.sessionId || urlRoomName} tickets={tickets} revokeTicket={revokeTicket} activeConsultation={activeConsultation} showToast={showToast} navigate={navigate} />
                        {!isPatientFaceTimeMode && <ElapsedTimeOverlay />}
                        {!isPatientFaceTimeMode && (
                          <WaitingOverlay 
                            isAccepted={isAcceptedSession} 
                            showCancelButton={role === 'patient'} 
                            onCancel={handleCancelSession} 
                            isOnHold={activeConsultation?.isOnHold} 
                            holdReason={activeConsultation?.holdReason} 
                            role={role} 
                            connectionTimeLeft={connectionTimeLeft}
                          />
                        )}
                        {activeConsultation?.type !== 'chat' && activeConsultation?.sessionType !== 'CHAT_ONLY' ? (
                          <VideoStageWithHardwareStream 
                            isFullScreen={isFullScreen}
                            toggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                            rawNotes={rawNotes}
                            setRawNotes={setRawNotes}
                            isGeneratingSOAP={isGeneratingSOAP}
                            generatedSOAP={generatedSOAP}
                            setGeneratedSOAP={setGeneratedSOAP}
                            handleGenerateSOAP={handleGenerateSOAP}
                            handleSaveNotes={handleSaveNotes}
                            scanOcrResult={scanOcrResult}
                            setScanOcrResult={setScanOcrResult}
                            scanPreviewUrl={scanPreviewUrl}
                            setScanPreviewUrl={setScanPreviewUrl}
                            handleScanFileChange={handleScanFileChange}
                            isProcessingScan={isProcessingScan}
                            processScanOcr={processScanOcr}
                            setSelectedScanFile={setSelectedScanFile}
                            sessionType={activeConsultation?.type || activeConsultation?.sessionType}
                            activeDocumentUrl={localActiveDocumentUrl}
                            onCloseDocument={() => {
                              setLocalActiveDocumentUrl(null);
                            }}
                            onEndCall={() => {
                              if (role === 'consultant') {
                                if (activeConsultation?.sessionId) {
                                  updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
                                    status: 'COMPLETED',
                                    endedAt: serverTimestamp()
                                  }).catch(console.error);
                                }
                                setShowReviewSignatureModal(true);
                              } else {
                                showConfirm({
                                  title: "End Call",
                                  message: "Are you sure you want to end this call? You will be redirected to the rating and summary page.",
                                  onConfirm: async () => {
                                    if (activeConsultation?.sessionId) {
                                      try {
                                        await updateDoc(doc(db, 'consultations', activeConsultation.sessionId), {
                                          status: 'COMPLETED',
                                          endedAt: serverTimestamp()
                                        });
                                      } catch (e) {
                                        console.error("Failed to end consultation", e);
                                      }
                                    }
                                    setShowRatingModal(true);
                                  }
                                });
                              }
                            }}
                            activeConsultation={activeConsultation}
                            notes={activeConsultation?.clinicalNotes || activeConsultation?.visitSummary}
                            patientVitals={patientVitals}
                            isWorkspaceCollapsed={isWorkspaceCollapsed}
                            onToggleWorkspaceCollapse={() => setIsWorkspaceCollapsed(!isWorkspaceCollapsed)}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-[32px] overflow-hidden p-8 text-center">
                            <div className="w-24 h-24 bg-emerald-600/20 rounded-full flex items-center justify-center mb-6">
                              <MessageSquare size={48} className="text-slate-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-600 mb-2">Secure Chat Consultation</h2>
                            <p className="text-slate-500 max-w-sm">You are connected to a secure, text-only consultation. Use the chat sidebar to communicate with your consultant.</p>
                          </div>
                        )}
                      </SafeRoomComponent>
                    </div>
                  </AgoraRoom>
               ) : connectionError ? (
               <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-white w-full h-full rounded-[32px]">
                 <AlertCircle size={48} className="text-rose-400 mb-4 animate-pulse" />
                 <h3 className="text-white font-bold text-xl mb-2">Consultation Room Connection Error</h3>
                 <p className="text-slate-300 max-w-md text-sm">
                    {connectionError}. Please ensure your internet connection is stable and try again.
                 </p>
                 <button 
                  className="mt-6 w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 flex items-center justify-center text-white transition-colors shadow-lg shadow-rose-600/30 cursor-pointer"
                  onClick={() => navigate(role === 'consultant' ? '/consultant/dashboard' : '/patient/dashboard')}
                >
                  <Phone className="rotate-[135deg]" size={24} />
                </button>
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center text-white">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-4"></div>
                 <p className="text-slate-200 font-medium">Connecting to secure room...</p>
               </div>
             )}
          </div>
        </div>
        
      </div>

      {!isConsultant && activeConsultation && (
        <PatientFloatingActionMenu 
          onScanChange={handleScanFileChange}
          isProcessing={isProcessingScan}
        />
      )}

      {showRxModal && (
        <PrescriptionGenerator 
          consultation={activeConsultation} 
          onClose={() => setShowRxModal(false)} 
        />
      )}

      {showSummaryModal && activeConsultation && (
        <VisitSummaryModal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          consultation={activeConsultation}
          onSuccess={() => {
            if (role === 'patient') {
              setShowRatingModal(true);
            } else {
              showToast("Visit summary saved and consultation completed.", "success");
            }
          }}
        />
      )}

      {showRatingModal && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden flex flex-col p-8 text-center">
            {ratingSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Thank You</h3>
                <p className="text-slate-600">Your feedback has been submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={submitRating} className="flex flex-col">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Rate Your Experience</h3>
                <p className="text-slate-600 mb-8">How was your consultation with {activeConsultation.consultantName || 'your consultant'}?</p>
                
                <div className="flex items-center justify-center gap-2 mb-8">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        size={40}
                        className={`${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-100 text-slate-500 hover:text-amber-200'
                        } transition-colors`}
                     />
                    </button>
                  ))}
                </div>

                <div className="text-left mb-8">
                  <label className="block text-sm font-bold text-slate-800 mb-2">Additional Feedback (Optional)</label>
                  <textarea
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us about your experience..."
                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-slate-300 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/patient/dashboard')}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-white transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    disabled={rating === 0 || isSubmittingRating}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-slate-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {isSubmittingRating ? <Loader2 size={18} className="animate-spin" /> : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showOcrModal && activeConsultation && (
        <OcrScannerModal
          consultationId={activeConsultation.sessionId}
          onClose={() => setShowOcrModal(false)}
        />
      )}

      {showReviewSignatureModal && activeConsultation && (
        <ConsultantReviewSignatureModal
          consultation={activeConsultation}
          consultantName={user?.fullName || activeConsultation.consultantName || 'Consultant'}
          consultantId={user?.uid || activeConsultation.consultantId || 'consultant'}
          conversationText={generatedSOAP || rawNotes}
          onClose={() => setShowReviewSignatureModal(false)}
          onSignedSuccess={() => {
            setShowReviewSignatureModal(false);
            navigate('/consultant/dashboard');
          }}
        />
      )}

      {showInconclusiveModal && activeConsultation && (
        <ConsultantInconclusiveModal
          consultationId={activeConsultation.sessionId}
          onClose={() => setShowInconclusiveModal(false)}
          onSuccess={() => {
            setShowInconclusiveModal(false);
            navigate("/consultant/dashboard");
          }}
        />
      )}
      {showTriageSlipModal && activeConsultation && (
        <ClinicalTriageSlipModal
          isOpen={showTriageSlipModal}
          onClose={() => setShowTriageSlipModal(false)}
          consultation={activeConsultation}
        />
      )}

      <ConsultantGuidelinesDrawer
        isOpen={showGuidelinesDrawer}
        onClose={() => setShowGuidelinesDrawer(false)}
      />

      {showReferralModal && activeConsultation && user && (
        <ConsultantReferralModal
          isOpen={showReferralModal}
          onClose={() => setShowReferralModal(false)}
          consultation={activeConsultation}
          currentUser={user}
        />
      )}

      {activeConsultation && (
        <ReferralPaymentModal
          isOpen={showPatientReferralModal || (role === 'patient' && activeConsultation.referralState === 'PROPOSED')}
          onClose={() => setShowPatientReferralModal(false)}
          consultation={activeConsultation}
        />
      )}
    </div>
  </AgoraRTCProvider>
);
}
