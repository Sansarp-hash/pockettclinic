import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { Video, ArrowLeft, ShieldCheck, AlertCircle, Loader2, Phone, FileText, CheckCircle2, UserCircle, FileBadge, X } from 'lucide-react';
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

function RemoteUserVideo({ user }: { user: any }) {
  const { track: remoteVideoTrack } = useRemoteUserTrack(user && user.hasVideo ? user : undefined, "video");
  const activeTrack = user?.videoTrack || remoteVideoTrack;
  if (!activeTrack) {
    return <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">Camera Off</div>;
  }
  return <RemoteVideoTrack track={activeTrack} play={true} className="w-full h-full object-cover" />;
}

function AgoraReviewRoom({ token, children, onError }: any) {
  const tokenInfo = useMemo(() => {
    if (!token) return null;
    try {
      return JSON.parse(token);
    } catch (e) {
      console.error("Failed to parse Agora review token:", e);
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
    console.log("[Agora Review] Connection State:", connectionState);
    console.log("[Agora Review] Remote Users:", remoteUsers.length);
  }, [connectionState, remoteUsers]);
  const audioTracks = useRemoteAudioTracks(remoteUsers);
  
  useEffect(() => {
    if (audioTracks && Array.isArray(audioTracks)) {
      audioTracks.forEach(track => {
        if (track && typeof track.play === 'function') {
          try {
            track.play();
          } catch (e) {
            console.warn("Review audio play error:", e);
          }
        }
      });
    }
  }, [audioTracks]);

  return (
    <div className="w-full h-full relative">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full p-4">
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
          <LocalVideoReview />
          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white border border-white/10">You</div>
        </div>
        {remoteUsers.map(user => (
          <div key={user.uid} className="relative bg-slate-800 rounded-2xl overflow-hidden border border-white/10">
            <RemoteUserVideo user={user} />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-xs text-white border border-white/10">Participant</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalVideoReview() {
  const { localCameraTrack } = useLocalCameraTrack(true);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  usePublish([localCameraTrack, localMicrophoneTrack]);

  return <LocalVideoTrack track={localCameraTrack} play={true} className="w-full h-full object-cover transform -scale-x-100" />;
}
// import '@livekit/components-styles';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function ReviewRoom() {
  const agoraClient = useMemo(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
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
  const { consultantId: paramConsultantId, id: paramId } = useParams();
  const consultantId = paramConsultantId || paramId;
  const { user, showToast } = useAppContext();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const [consultantData, setConsultantData] = useState<any | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!consultantId || !user) return;

    // Listen to consultant profile for admins to review live
    if (user.role === 'admin') {
      const unsub = onSnapshot(doc(db, 'users', consultantId), (docSnap) => {
        if (docSnap.exists()) {
          setConsultantData(docSnap.data());
        }
      });
      return () => unsub();
    }
  }, [consultantId, user]);


  useEffect(() => {
    if (!consultantId || !user) return;

    const fetchToken = async () => {
      try {
        const participantName = user?.fullName || user?.displayName || 'Participant';
        const idToken = await auth.currentUser?.getIdToken();
        
        const response = await fetch('/api/agora/token', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({
            roomName: `review-${consultantId}`,
            participantName: `${participantName} (${user?.role === 'admin' ? 'Admin' : 'Consultant'})`
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch token');
        }

        setToken(JSON.stringify({ 
          token: data.token, 
          appId: data.appId, 
          uid: data.uid, 
          room: `review-${consultantId}` 
        }));
      } catch (err: any) {
        console.error("Token fetch error:", err);
        setConnectionError(err.message || 'Failed to connect to video server');
      }
    };

    fetchToken();
  }, [consultantId, user]);

  const handleVerifyConsultant = async () => {
    if (!consultantId || !consultantData) return;
    setIsVerifying(true);
    try {
      await updateDoc(doc(db, 'users', consultantId), {
        verificationStatus: 'verified',
        isVerified: true,
        verifiedAt: new Date().toISOString()
      });
      showToast('Consultant successfully verified! You may now conclude the Face-to-Face review.', "success");
    } catch (err) {
      console.error("Error verifying consultant:", err);
      showToast('Failed to verify consultant.', "error");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AgoraRTCProvider client={agoraClient}>
      <div className="flex-1 w-full h-full flex flex-col bg-white min-h-screen">
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/consultant/dashboard')}
            className="p-2 hover:bg-white rounded-full transition-colors text-slate-600 cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-sky-600" />
            <div>
              <h2 className="font-bold text-slate-800 leading-tight">Face-to-Face Compliance Review</h2>
              <p className="text-xs text-slate-600 font-medium">Secure Administrative Audit Room</p>
            </div>
          </div>
        </div>
        {user?.role === 'admin' && consultantData && consultantData.isVerified && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-200 font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CheckCircle2 size={16} />
            Officially Verified
          </div>
        )}
      </div>

      <div className="flex-1 p-4 md:p-6 flex flex-col lg:flex-row gap-6 relative overflow-hidden min-h-0">
        {/* Main Video Area */}
        <div className="flex-1 bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl relative flex items-center justify-center border-4 border-slate-900 h-full min-h-[500px]">
          {token ? (
            <AgoraReviewRoom
              token={token}
              onError={(error: any) => {
                console.warn("Video Review Room connection error caught:", error);
                if (error?.message) {
                  setConnectionError(error.message);
                }
              }}
            />
          ) : connectionError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle size={48} className="text-rose-500 mb-4" />
              <h3 className="text-white font-bold text-xl mb-2">Connection Failed</h3>
              <p className="text-slate-400 max-w-md text-sm">
                {connectionError}. Please ensure your internet connection is stable and try again.
              </p>
              <button 
                className="mt-6 bg-rose-500 hover:bg-rose-600 px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-white font-bold transition-colors shadow-lg cursor-pointer"
                onClick={() => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/consultant/dashboard')}
              >
                <Phone className="rotate-[135deg]" size={18} />
                Leave Room
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 size={48} className="text-sky-500 animate-spin mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">Joining Secure Room...</h3>
              <p className="text-slate-400 text-sm">Establishing encrypted connection</p>
            </div>
          )}
        </div>

        {/* Admin Live Audit Sidebar */}
        {user?.role === 'admin' && consultantData && (
          <div className="w-full lg:w-96 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col shrink-0 h-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
              <FileBadge className="text-sky-600" size={24} />
              <div>
                <h3 className="font-bold text-slate-800">Live Audit Profile</h3>
                <p className="text-xs text-slate-500">Cross-check details during interview</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Summary */}
              <div className="flex items-center gap-4">
                {consultantData.profilePhotoUrl ? (
                  <img src={consultantData.profilePhotoUrl} alt="Consultant" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                    <UserCircle size={32} />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-800">{consultantData.fullName || 'Unknown'}</h4>
                  <p className="text-sm font-medium text-sky-600 capitalize">{consultantData.cadre}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{consultantData.email}</p>
                </div>
              </div>

              {/* Identity & Credentials */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Identity Proof</h5>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Ghana Card PIN</p>
                      <p className="text-sm font-mono text-slate-800 font-medium">{consultantData.ghanaCardNumber || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Professional Credentials</h5>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">Regulatory Council PIN / License</p>
                      <p className="text-sm font-mono text-slate-800 font-medium">{consultantData.councilPin || consultantData.licenseNumber || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Compliance Status</h5>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Terms Acceptance</span>
                      {consultantData.reviewTermsAcceptedAt ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <X size={16} className="text-rose-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Indemnity Agreement</span>
                      {consultantData.indemnityStatus ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : (
                        <X size={16} className="text-rose-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white shrink-0">
              {consultantData.isVerified ? (
                <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} />
                  Account Fully Verified
                </div>
              ) : (
                <button
                  onClick={handleVerifyConsultant}
                  disabled={isVerifying || !consultantData.reviewTermsAcceptedAt}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Approve & Verify Consultant
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </AgoraRTCProvider>
);
}
