import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { useAppContext } from '../AppContext';
import { ConsultationSession, DigitalPrescription } from '../types';
import { Calendar, Clock, Stethoscope, FileText, CheckCircle2, MessageSquare, Video, Download, X, ExternalLink, ChevronRight, UserCircle, Sparkles, Play, Star, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { formatConsultantName } from '../lib/formatters';
import ConsultationChat from './ConsultationChat';
import ReferralGuidanceBanner from './ReferralGuidanceBanner';

interface ConsultationHistoryProps {
  patientId?: string;
}

export default function ConsultationHistory({ patientId }: ConsultationHistoryProps = {}) {
  const { consultations, prescriptions, user, showToast, showConfirm } = useAppContext();
  const [selectedTranscriptSession, setSelectedTranscriptSession] = useState<ConsultationSession | null>(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [localRating, setLocalRating] = useState(0);
  const [localFeedback, setLocalFeedback] = useState('');
  const [ratingSessionId, setRatingSessionId] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const effectivePatientId = patientId || user?.uid;

  const handleSubmitRating = async () => {
    if (!ratingSessionId) return;
    setIsSubmittingRating(true);
    try {
      await updateDoc(doc(db, 'consultations', ratingSessionId), {
        patientRating: localRating,
        patientReviewText: localFeedback
      });
      setShowRatingForm(false);
      setRatingSessionId(null);
      setLocalFeedback('');
      setLocalRating(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consultations/${ratingSessionId}`);
      showToast("Failed to submit rating.", "error");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Filter completed or past consultations for patient
  const myConsultations = consultations
    .filter(c => c.patientId === effectivePatientId || (!patientId && user?.role === 'patient'))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  if (myConsultations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-600">
        <Stethoscope size={48} className="mx-auto text-slate-500 mb-3" />
        <p className="font-bold text-slate-800">No Consultation History Yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Your completed medical consultations, visit summaries, and chat transcripts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-800">Past Consultations & Medical History</h3>
          <p className="text-xs text-slate-600 font-medium">Review doctor notes, visit summaries, prescriptions, and full chat transcripts.</p>
        </div>
      </div>

      <div className="space-y-5">
        {myConsultations.map((session) => {
          const rx = prescriptions.find(p => p.sessionId === session.sessionId);

          return (
            <div
              key={session.sessionId}
              className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 hover:shadow-md transition-all relative"
            >
              {/* Top Row: Doctor Info & Date */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-indigo-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                    <UserCircle size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                      {formatConsultantName(session.consultantName, session.consultantPrefix)}
                    </h4>
                    <p className="text-xs text-slate-600 font-bold flex items-center gap-1">
                      <Stethoscope size={12} /> Medical Consultant
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left sm:text-right text-xs text-slate-600 font-medium">
                    <p className="font-bold text-slate-800 flex items-center sm:justify-end gap-1">
                      <Calendar size={14} className="text-slate-600" />
                      {new Date(session.scheduledAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center sm:justify-end gap-1 mt-0.5">
                      <Clock size={12} />
                      {new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      session.status === 'COMPLETED' || session.status === 'CLINICAL_ESCALATION'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : session.status === 'IN_PROGRESS'
                        ? 'bg-slate-50 text-slate-600 border border-slate-300'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
              </div>

              {/* Chief Complaints / Symptoms */}
              {session.chiefComplaints && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Chief Symptoms Reported
                  </span>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800">
                    {session.chiefComplaints}
                  </div>
                </div>
              )}

              {/* Doctor Visit Summary & Notes */}
              {session.visitSummary ? (
                <div className="mb-4 bg-slate-50/40 border border-indigo-100 rounded-2xl p-4">
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-slate-600" /> Visit Summary & Instructions
                  </h5>
                  <div 
                    className="text-xs text-slate-800 font-medium leading-relaxed prose prose-sm max-w-none prose-indigo"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(session.visitSummary) }}
                  />
                </div>
              ) : session.clinicalNotes ? (
                <div className="mb-4 bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                  <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={16} className="text-amber-600" /> Consultant Notes
                  </h5>
                  <div 
                    className="text-xs text-slate-800 font-medium leading-relaxed prose prose-sm max-w-none prose-amber"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(session.clinicalNotes) }}
                  />
                </div>
              ) : null}

              {/* POST-CONSULTATION CARE MODULE (Voice Note & Takeaway Instructions) */}
              {(session.consultantVoiceNoteUrl || session.consultantFinalNotes) && (
                <div className="mb-4 bg-indigo-900 text-slate-600 rounded-2xl p-5 shadow-lg border border-slate-200">
                  <h5 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles size={16} /> Consultant Care Instructions & Voice Note
                  </h5>
                  
                  {session.consultantVoiceNoteUrl && (
                    <div className="mb-4 bg-white/10 p-3 rounded-xl border border-white/10 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                        <Play size={18} fill="currentColor" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Audio Care Summary</p>
                        <audio src={session.consultantVoiceNoteUrl} controls className="h-8 w-full mt-1 accent-indigo-500" />
                      </div>
                    </div>
                  )}

                  {session.consultantFinalNotes && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Final Care Takeaways</p>
                      <p className="text-sm font-medium leading-relaxed italic text-indigo-50">
                        "{session.consultantFinalNotes}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 24-HOUR FOLLOW-UP WINDOW TRIGGER */}
              {session.status === 'COMPLETED' || session.status === 'CLINICAL_ESCALATION' && session.followUpWindowClosesAt && (
                (() => {
                  const isWindowOpen = new Date(session.followUpWindowClosesAt).getTime() > Date.now();
                  const remaining = session.followUpMessagesRemaining || 0;
                  
                  if (isWindowOpen && remaining > 0) {
                    return (
                      <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <Clock size={20} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-tight">Follow-up Window Active</h4>
                            <p className="text-[11px] text-emerald-800">
                              You have <span className="font-bold">{remaining} clarification questions</span> left. Window closes in {Math.round((new Date(session.followUpWindowClosesAt).getTime() - Date.now()) / (1000 * 60 * 60))} hours.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedTranscriptSession(session)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                        >
                          Ask Clarification
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* Patient Advisory Banner & Action Pathways */}
              <ReferralGuidanceBanner consultation={session} />

              {/* Patient Rating Prompt if not yet rated */}
              {session.status === 'COMPLETED' || session.status === 'CLINICAL_ESCALATION' && !session.patientRating && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Star size={20} fill="currentColor" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-950 uppercase tracking-tight">How was your visit?</h4>
                      <p className="text-xs text-amber-800">Your feedback helps us maintain high clinical quality scores.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => {
                          setLocalRating(star);
                          setShowRatingForm(true);
                          setRatingSessionId(session.sessionId);
                        }}
                        className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Star size={28} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Issued Prescription Box */}
              {rx && (
                <div className="mb-4 p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-950">Official Digital Prescription ({rx.rxId})</p>
                      <p className="text-[11px] text-emerald-700">
                        {rx.medications.map(m => m.drugName).join(', ')}
                      </p>
                    </div>
                  </div>

                  <a
                    href={rx.qrCodeVerificationUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 shrink-0"
                  >
                    <Download size={14} /> Download Prescription QR
                  </a>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedTranscriptSession(session)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 border border-slate-300 cursor-pointer"
                >
                  <MessageSquare size={15} />
                  View Read-Only Conversation Transcript
                </button>

                {session.recordingUrl && (
                  <a
                    href={session.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200"
                  >
                    <Video size={14} className="text-rose-500" />
                    Session Video Recording
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transcript Modal */}
      {selectedTranscriptSession && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full h-[85vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    Conversation Transcript
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    {formatConsultantName(selectedTranscriptSession.consultantName, selectedTranscriptSession.consultantPrefix)} • {new Date(selectedTranscriptSession.scheduledAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTranscriptSession(null)}
                className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-50/50 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-3 bg-white/50">
              <ConsultationChat
                consultationId={selectedTranscriptSession.sessionId}
                currentUserId={user?.uid || ''}
                currentUserRole="patient"
                currentUserName={user?.displayName || 'Patient'}
                isCompleted={true}
                followUpWindowClosesAt={selectedTranscriptSession.followUpWindowClosesAt}
                followUpMessagesRemaining={selectedTranscriptSession.followUpMessagesRemaining}
                className="h-full border-0 shadow-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* RATING FORM MODAL */}
      {showRatingForm && (
        <div className="fixed inset-0 bg-slate-50 backdrop-blur-xs z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Clinical Review</h3>
              <button onClick={() => setShowRatingForm(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-6 text-center">
              How would you rate the quality of care provided during this session?
            </p>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setLocalRating(s)}
                  className={`p-1 transition-all cursor-pointer ${s <= localRating ? 'text-amber-400 scale-110' : 'text-slate-500 hover:text-slate-500'}`}
                >
                  <Star size={36} fill={s <= localRating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>

            <textarea
              value={localFeedback}
              onChange={(e) => setLocalFeedback(e.target.value)}
              placeholder="Brief review or feedback (optional)..."
              className="w-full text-sm p-4 bg-white border border-slate-200 rounded-2xl mb-6 focus:ring-4 focus:ring-emerald-500/20/10 outline-none resize-none h-24"
            />

            <button
              onClick={handleSubmitRating}
              disabled={localRating === 0 || isSubmittingRating}
              className="w-full bg-emerald-600 hover:bg-emerald-600 disabled:bg-slate-50 disabled:text-slate-500 text-slate-600 font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingRating ? <Loader2 className="animate-spin" size={20} /> : 'Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
