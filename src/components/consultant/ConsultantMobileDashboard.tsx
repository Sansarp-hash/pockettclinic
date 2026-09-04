import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { normalizeCadre, CADRE_CONFIGS } from '../../config/consultantCadreConfig';
import { acceptConsultation } from '../../lib/consultationDispatch';
import { NetworkSyncIndicator } from '../NetworkSyncIndicator';
import { db } from '../../firebase';
import { collection, query, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { 
  Home, 
  Users, 
  CalendarDays, 
  Wallet, 
  Menu, 
  Bell, 
  FileText, 
  ShieldAlert,
  ShieldCheck, 
  Share2, 
  BookOpen, 
  Star, 
  Settings, 
  Trash2, 
  Clock, 
  MessageSquare, 
  Activity, 
  User, 
  AlertCircle,
  LogOut,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Video,
  PhoneCall
} from 'lucide-react';

interface ConsultantMobileDashboardProps {
  effectiveUser: any;
  effectiveConsultations: any[];
  patientsSeen: number;
  consultant70Earnings: number;
  averageRating: string;
  isPendingReview: boolean;
  setActiveDashboardTab: (tab: string) => void;
  activeDashboardTab: string;
  isOnline: boolean;
  renderActiveTabContent: () => React.ReactNode;
  globalLogoUrl?: string | null;
  onOpenSettings: () => void;
  onOpenDeletion: () => void;
}

export default function ConsultantMobileDashboard({
  effectiveUser,
  effectiveConsultations,
  patientsSeen,
  consultant70Earnings,
  averageRating,
  isPendingReview,
  setActiveDashboardTab,
  activeDashboardTab,
  isOnline,
  renderActiveTabContent,
  globalLogoUrl,
  onOpenSettings,
  onOpenDeletion
}: ConsultantMobileDashboardProps) {
  const navigate = useNavigate();
  const { globalSlogan, globalTitle, globalLogoUrl: contextLogo, logout } = useAppContext();
  
  const consultantId = effectiveUser?.uid || effectiveUser?.id;
  // Use prop if provided, otherwise context
  const effectiveLogo = globalLogoUrl || contextLogo;
  
  // Real-time notifications tracking state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoadingNotifs(false);
      return;
    }

    const userUid = effectiveUser?.uid || effectiveUser?.id;
    if (!userUid) {
      setNotifications([]);
      setLoadingNotifs(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'user_notifications', userUid, 'items'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        setNotifications(fetched);
        setLoadingNotifs(false);
      }, (err) => {
        console.warn('Notification stream warning in mobile:', err);
        setLoadingNotifs(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error starting notifications stream:', err);
      setLoadingNotifs(false);
    }
  }, [effectiveUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Compute initials helper
  const getInitials = (fullName: string) => {
    if (!fullName) return 'PC';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  const name = effectiveUser?.fullName || effectiveUser?.displayName || 'Consultant';
  const initials = getInitials(name);
  const cadre = normalizeCadre(effectiveUser?.cadre);
  
  // Format PIN / ID line
  const pin = effectiveUser?.councilPin || effectiveUser?.mdcPin || effectiveUser?.licenseNo || 'Pending Verification';
  const cadreConfig = CADRE_CONFIGS[cadre] || { label: cadre.replace('_', ' ') };
  const roleLine = `${cadre === 'UNASSIGNED' ? 'UNASSIGNED CONSULTANT' : cadreConfig.label.toUpperCase()} · PIN: ${pin}`;

  // Badge text
  const badgeText = isPendingReview ? "PENDING VERIFICATION" : "VERIFIED CONSULTANT";

  // Determine dynamic statistics
  const currentMonthEarningsStr = `GHS ${(consultant70Earnings).toFixed(2)}`;

  // Icon Resolvers to render fully Vectorized modern icons like Premium Apps (X, TikTok, Twitch)
  const getQuickIconComponent = (id: string) => {
    switch(id) {
      case 'soap':
        return <FileText size={18} className="text-violet-600 stroke-[1.8]" />;
      case 'drug-safety':
        return <ShieldAlert size={18} className="text-amber-600 stroke-[1.8]" />;
      case 'referrals':
        return <Share2 size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'stg-reference':
        return <BookOpen size={18} className="text-blue-600 stroke-[1.8]" />;
      case 'follow-ups':
        return <CalendarDays size={18} className="text-fuchsia-600 stroke-[1.8]" />;
      case 'chat':
        return <MessageSquare size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'queue':
        return <Users size={18} className="text-emerald-600 stroke-[1.8]" />;
      default:
        return <Activity size={18} className="text-slate-600 stroke-[1.8]" />;
    }
  };

  const getStatIconComponent = (id: string) => {
    switch(id) {
      case 'users':
        return <Users size={16} className="text-emerald-600 stroke-[1.8]" />;
      case 'wallet':
        return <Wallet size={16} className="text-blue-600 stroke-[1.8]" />;
      case 'star':
        return <Star size={16} className="text-amber-500 fill-amber-500/10 stroke-[1.8]" />;
      case 'clock':
        return <Clock size={16} className="text-violet-600 stroke-[1.8]" />;
      default:
        return <Activity size={16} className="text-slate-600 stroke-[1.8]" />;
    }
  };

  const getMoreIconComponent = (id: string) => {
    switch(id) {
      case 'portfolio':
        return <User size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'soap':
        return <FileText size={18} className="text-violet-600 stroke-[1.8]" />;
      case 'drug-safety':
        return <ShieldAlert size={18} className="text-amber-600 stroke-[1.8]" />;
      case 'referrals':
        return <Share2 size={18} className="text-blue-600 stroke-[1.8]" />;
      case 'stg-reference':
        return <BookOpen size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'chat':
        return <MessageSquare size={18} className="text-violet-600 stroke-[1.8]" />;
      case 'follow-ups':
        return <CalendarDays size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'payout-hub':
        return <Wallet size={18} className="text-blue-600 stroke-[1.8]" />;
      case 'feedback':
        return <Star size={18} className="text-amber-500 stroke-[1.8] fill-amber-500/10" />;
      case 'subscription':
        return <ShieldCheck size={18} className="text-emerald-600 stroke-[1.8]" />;
      case 'settings':
        return <Settings size={18} className="text-slate-600 stroke-[1.8]" />;
      case 'delete':
        return <Trash2 size={18} className="text-rose-600 stroke-[1.8]" />;
      case 'logout':
        return <LogOut size={18} className="text-red-600 stroke-[1.8]" />;
      default:
        return <HelpCircle size={18} className="text-slate-600 stroke-[1.8]" />;
    }
  };

  const getActivityIconComponent = (id: string) => {
    switch(id) {
      case 'rx':
        return <FileText size={15} className="text-emerald-600 stroke-[1.8]" />;
      case 'soap':
        return <FileText size={15} className="text-violet-600 stroke-[1.8]" />;
      case 'triage':
        return <Activity size={15} className="text-amber-600 stroke-[1.8]" />;
      default:
        return <Users size={15} className="text-emerald-600 stroke-[1.8]" />;
    }
  };

  // Construct cadre configurations
  let roleConfig: any = {};

  if (cadre === 'PHARMACIST') {
    roleConfig = {
      name,
      initials,
      role: `${cadreConfig.label} · PIN: ${pin}`,
      badge: badgeText,
      brandIcon: "💊",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "SOAP AI Notes", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Safety Checker", "drug-safety"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Reference", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Counseling & Follow-ups", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Patient Chats", "chat"],
        ["queue", "var(--accent-green-light)", "Verify Rx Queue", "queue"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", patientsSeen, "Reviewed Rx"],
        ["wallet", "var(--blue-light)", `GHS ${(consultant70Earnings).toFixed(0)}`, "Consultant Earnings"],
        ["star", "var(--amber-light)", averageRating, "Patient Trust"],
        ["clock", "var(--purple-light)", "2 min", "Avg Verify Time"]
      ],
      schedTime: "09:00 - 13:00",
      schedSub: "Pharma Consults & Rx Verifications",
      schedPatient: "Kojo Mensah",
      schedTag: "MEDICATION VERIFICATION",
      activity: [["rx", "Verified prescription GHS-9182", "11:30 AM · Antibiotics Check", "Completed"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  } else if (cadre === 'PHYSICIAN_ASSISTANT') {
    roleConfig = {
      name,
      initials,
      role: `${cadreConfig.label} · PIN: ${pin}`,
      badge: badgeText,
      brandIcon: "🩹",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "SOAP AI Notes", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Safety & Contra.", "drug-safety"],
        ["referrals", "var(--accent-green-light)", "Specialist Referrals", "referrals"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Guidelines", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Follow-up Reminders", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Patient Chats", "chat"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", patientsSeen, "Patients Triaged"],
        ["wallet", "var(--blue-light)", `GHS ${(consultant70Earnings).toFixed(0)}`, "Consultant Earnings"],
        ["star", "var(--amber-light)", averageRating, "Patient Trust"],
        ["clock", "var(--purple-light)", "8 min", "Avg Consultation"]
      ],
      schedTime: "10:30 - 11:15",
      schedSub: "Primary Care Triage & Diagnostics",
      schedPatient: "Amma Serwaa",
      schedTag: "DIAGNOSIS & RECOMMEND",
      activity: [["soap", "Drafted SOAP report for Amma S.", "12:05 PM · Voice Guided", "Sent"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  } else if (cadre === 'PHARM_TECH') {
    roleConfig = {
      name,
      initials,
      role: `${cadreConfig.label} · PIN: ${pin}`,
      badge: badgeText,
      brandIcon: "🩹",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "Dispensation Logs", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Safety & Contra.", "drug-safety"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Reference", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Follow-up Reminders", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Patient Chats", "chat"],
        ["queue", "var(--accent-green-light)", "Dispensation Queue", "queue"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", patientsSeen, "Orders Processed"],
        ["wallet", "var(--blue-light)", `GHS ${(consultant70Earnings).toFixed(0)}`, "Consultant Earnings"],
        ["star", "var(--amber-light)", averageRating, "Consultant Rating"],
        ["clock", "var(--purple-light)", "3 min", "Dispense Speed"]
      ],
      schedTime: "08:30 - 17:30",
      schedSub: "OTC Counseling & Refill Processing",
      schedPatient: "Michael Darko",
      schedTag: "REFILL CONFIRMATION",
      activity: [["triage", "Processed OTC Allergy Meds", "10:45 AM · Triage Assist", "Completed"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  } else if (cadre === 'SPECIALIST') {
    roleConfig = {
      name,
      initials,
      role: `${cadreConfig.label} · PIN: ${pin}`,
      badge: badgeText,
      brandIcon: "⚕️",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "Clinical SOAP Notes", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Interaction Checker", "drug-safety"],
        ["referrals", "var(--accent-green-light)", "Specialist Network", "referrals"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Guidelines", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Patient Follow-ups", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Expert Chats", "chat"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", patientsSeen, "Complex Cases"],
        ["wallet", "var(--blue-light)", currentMonthEarningsStr, "Consultant Earnings"],
        ["star", "var(--amber-light)", averageRating, "Patient Trust"],
        ["clock", "var(--purple-light)", "5 min", "Consult Time"]
      ],
      schedTime: "11:00 - 11:30",
      schedSub: "Expert Specialist Consultation",
      schedPatient: "Abena Mansah",
      schedTag: "SPECIALIST REVIEW",
      activity: [["queue", "New patient added to queue", "10:15 AM · Kofi Agyeman", "High Priority"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  } else if (cadre === 'UNASSIGNED') {
    roleConfig = {
      name,
      initials,
      role: `Unassigned Consultant · PIN: ${pin}`,
      badge: badgeText,
      brandIcon: "⏳",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "SOAP AI Notes", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Safety Checker", "drug-safety"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Reference", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Follow-up Reminders", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Patient Chats", "chat"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", 0, "Patients Triaged"],
        ["wallet", "var(--blue-light)", "GHS 0.00", "MoMo Payout"],
        ["star", "var(--amber-light)", averageRating, "Rating"],
        ["clock", "var(--purple-light)", "N/A", "Status"]
      ],
      schedTime: "Pending Selection",
      schedSub: "Complete Registration & Verification",
      schedPatient: "None",
      schedTag: "CADRE PENDING",
      activity: [["queue", "Profile created. Awaiting cadre selection & admin review.", "Just now", "Pending"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  } else {
    // Default or Doctor Configuration
    roleConfig = {
      name,
      initials,
      role: roleLine,
      badge: badgeText,
      brandIcon: "⚕️",
      tag: globalSlogan || "Your Digital Hospital Anywhere",
      quick: [
        ["soap", "var(--purple-light)", "SOAP AI Notes", "soap"],
        ["drug-safety", "var(--amber-light)", "Drug Safety & Contra.", "drug-safety"],
        ["referrals", "var(--accent-green-light)", "Specialist Referrals", "referrals"],
        ["stg-reference", "var(--blue-light)", "Ghana STG Guidelines", "stg-reference"],
        ["follow-ups", "var(--purple-light)", "Follow-up Reminders", "follow-ups"],
        ["chat", "var(--accent-green-light)", "Patient Chats", "chat"]
      ],
      stats: [
        ["users", "var(--accent-green-light)", patientsSeen, "Patients Seen"],
        ["wallet", "var(--blue-light)", currentMonthEarningsStr, "Consultant Earnings"],
        ["star", "var(--amber-light)", averageRating, "Patient Trust"],
        ["clock", "var(--purple-light)", "5 min", "Response Time"]
      ],
      schedTime: "11:00 - 11:30",
      schedSub: "Virtual Clinical Telehealth",
      schedPatient: "Abena Mansah",
      schedTag: "VIDEO CALL SCHEDULED",
      activity: [["queue", "New patient added to queue", "10:15 AM · Kofi Agyeman", "High Priority"]],
      nav: ["Dashboard", "Patients", "Schedule", "MoMo Payout", "More"]
    };
  }

  // Handle bottom navigation actions
  const handleNavClick = (idx: number) => {
    if (idx === 0) setActiveDashboardTab('appointments');
    else if (idx === 1) setActiveDashboardTab('queue');
    else if (idx === 2) setActiveDashboardTab('schedule');
    else if (idx === 3) setActiveDashboardTab('payout-hub');
    else if (idx === 4) {
      const isAlreadyInMore = ['more', 'portfolio', 'soap', 'drug-safety', 'referrals', 'stg-reference', 'feedback', 'follow-ups', 'chat', 'payout-hub', 'subscription'].includes(activeDashboardTab);
      if (isAlreadyInMore) {
        setActiveDashboardTab('appointments');
      } else {
        setActiveDashboardTab('more');
      }
    }
  };

  const getActiveIndex = () => {
    switch (activeDashboardTab) {
      case 'appointments': return 0;
      case 'queue': return 1;
      case 'schedule': return 2;
      case 'payout-hub':
      case 'ledger': return 3;
      case 'more': return 4;
      default: return 4;
    }
  };
  const activeIndex = getActiveIndex();

  return (
    <div className="pm-shell-wrapper">
      <style>{`
        .pm-shell-wrapper {
          --deep-green: #0A3B24;
          --deep-green-2: #0F4A2E;
          --accent-green: #16A34A;
          --accent-green-light: #DCFCE7;
          --amber: #F59E0B;
          --amber-light: #FEF3C7;
          --purple: #8B5CF6;
          --purple-light: #EDE9FE;
          --blue: #2563EB;
          --blue-light: #DBEAFE;
          --ink: #0F172A;
          --sub: #64748B;
          --line: #E6EBE8;
          --bg: #F6F8F7;
          --card: #FFFFFF;
          --radius: 16px;
          
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: var(--ink);
          width: 100%;
        }

        .pm-phone {
          background: var(--card);
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* Desktop Breakpoint Mock Frame */
        @media (min-width: 768px) {
          .pm-phone {
            width: 390px;
            height: 844px;
            margin: 20px auto;
            border: 10px solid #111;
            border-radius: 44px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.4);
          }
          .pm-notch {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            width: 150px; height: 26px; background: #111; border-radius: 0 0 16px 16px; z-index: 30;
          }
          .pm-statusbar {
            display: flex; justify-content: space-between; align-items: center;
            padding: 14px 22px 2px; font-size: 14px; font-weight: 600;
            background: var(--deep-green); color: #fff;
            height: 40px;
            z-index: 25;
          }
          .pm-scroll {
            flex: 1;
            overflow-y: auto;
            background: var(--bg);
          }
          .pm-bottom-nav {
            position: absolute;
          }
        }

        /* Mobile Breakpoint Fluid View */
        @media (max-width: 767px) {
          .pm-phone {
            width: 100%;
            height: 100dvh;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
          }
          .pm-notch {
            display: none;
          }
          .pm-statusbar {
            display: none;
          }
          .pm-scroll {
            width: 100%;
            flex: 1;
            background: var(--bg);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .pm-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding-bottom: max(22px, env(safe-area-inset-bottom));
          }
        }

        .pm-scroll::-webkit-scrollbar { width: 0; }

        .pm-header {
          background: linear-gradient(160deg, var(--deep-green), var(--deep-green-2));
          padding: 14px 20px 22px; display: flex; align-items: center;
          justify-content: space-between; color: #fff;
        }
        .pm-brand { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .pm-brand-icon {
          width: 42px; height: 42px; background: var(--accent-green); border-radius: 12px;
          display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
        }
        .pm-brand-name { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-brand-tag { font-size: 10.5px; color: #C9E6D4; margin-top: 1px; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .pm-header-icons { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
        .pm-icon-btn { position: relative; cursor: pointer; }
        .pm-dot-badge {
          position: absolute; top: 1px; right: 1px; width: 7px; height: 7px;
          background: #ef4444; border: 1.5px solid var(--deep-green); border-radius: 50%;
        }

        .pm-content { padding: 0 16px; margin-top: -14px; }
        .pm-profile-card {
          background: var(--card); border-radius: var(--radius); padding: 14px 16px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 8px 20px rgba(10,59,36,0.10);
        }
        .pm-profile-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .pm-avatar {
          width: 46px; height: 46px; border-radius: 50%; background: var(--accent-green-light);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; font-weight: 700; color: var(--deep-green); flex-shrink: 0;
        }
        .pm-profile-name { font-size: 15px; font-weight: 800; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-profile-role { font-size: 11.5px; color: var(--sub); margin-top: 2px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-badge {
          font-size: 9.5px; font-weight: 800; padding: 5px 9px; border-radius: 20px;
          white-space: nowrap; letter-spacing: 0.3px; flex-shrink: 0;
        }

        .pm-status-row {
          margin-top: 10px; background: var(--card); border-radius: var(--radius); padding: 12px 16px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 4px 12px rgba(10,59,36,0.06); font-size: 12.5px; font-weight: 600;
        }
        .pm-status-online { display: flex; align-items: center; gap: 6px; color: var(--ink); }
        .pm-status-online .pm-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); }
        .pm-status-date { color: var(--sub); display: flex; align-items: center; gap: 5px; }

        .pm-section { margin-top: 22px; }
        .pm-section-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px; padding: 0 2px;
        }
        .pm-section-title { font-size: 15px; font-weight: 800; color: var(--ink); }
        .pm-section-link { font-size: 12px; font-weight: 700; color: var(--accent-green); cursor: pointer; }

        .pm-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pm-quick-item {
          background: var(--card); border-radius: 14px; padding: 14px 6px; text-align: center;
          box-shadow: 0 4px 10px rgba(10,59,36,0.05); border: 1px solid var(--line);
          cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
        }
        .pm-quick-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(10,59,36,0.08);
        }
        .pm-quick-icon {
          width: 38px; height: 38px; border-radius: 10px; display: flex;
          align-items: center; justify-content: center; margin: 0 auto 8px;
        }
        .pm-quick-label { font-size: 11px; font-weight: 700; color: var(--ink); line-height: 1.25; }

        .pm-overview-card { background: var(--card); border-radius: var(--radius); padding: 16px; box-shadow: 0 6px 16px rgba(10,59,36,0.06); }
        .pm-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 4px; }
        .pm-stat { text-align: center; }
        .pm-stat-icon {
          width: 36px; height: 36px; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; margin: 0 auto 6px;
        }
        .pm-stat-num { font-size: 18px; font-weight: 800; color: var(--ink); }
        .pm-stat-label { font-size: 9px; color: var(--sub); font-weight: 600; margin-top: 1px; line-height: 1.2; }

        .pm-schedule-card {
          background: var(--accent-green-light); border: 1px solid #BBF0CE; border-radius: var(--radius);
          padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;
          cursor: pointer;
        }
        .pm-schedule-left { display: flex; align-items: center; gap: 12px; }
        .pm-schedule-clock {
          width: 40px; height: 40px; border-radius: 50%; background: #fff;
          display: flex; align-items: center; justify-content: center; color: var(--deep-green);
        }
        .pm-schedule-time { font-size: 15px; font-weight: 800; color: var(--deep-green); }
        .pm-schedule-sub { font-size: 10.5px; color: #2F6B4A; font-weight: 600; }
        .pm-schedule-right { text-align: right; }
        .pm-schedule-patient { font-size: 12.5px; font-weight: 700; color: var(--ink); }
        .pm-schedule-tag {
          display: inline-block; margin-top: 3px; font-size: 9px; font-weight: 800;
          background: var(--deep-green); color: #fff; padding: 2px 7px; border-radius: 20px;
        }

        .pm-hub-grid { display: flex; flex-direction: column; gap: 10px; }
        .pm-hub-card {
          background: var(--card); border-radius: 14px; padding: 14px; display: flex;
          align-items: center; gap: 12px; box-shadow: 0 4px 10px rgba(10,59,36,0.05); border: 1px solid var(--line);
          cursor: pointer; transition: background-color 0.1s;
        }
        .pm-hub-card:hover {
          background-color: var(--bg);
        }
        .pm-hub-icon {
          width: 40px; height: 40px; border-radius: 10px; display: flex;
          align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pm-hub-title { font-size: 13px; font-weight: 800; color: var(--ink); }
        .pm-hub-sub { font-size: 10.5px; color: var(--sub); margin-top: 1px; }
        .pm-hub-arrow { margin-left: auto; color: var(--sub); display: flex; align-items: center; }

        .pm-activity-card {
          background: var(--card); border-radius: 14px; padding: 13px 14px; display: flex;
          align-items: center; gap: 12px; box-shadow: 0 4px 10px rgba(10,59,36,0.05);
          border: 1px solid var(--line); margin-bottom: 8px;
        }
        .pm-activity-icon {
          width: 34px; height: 34px; border-radius: 50%; background: var(--accent-green-light);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pm-activity-text { font-size: 12px; font-weight: 700; color: var(--ink); }
        .pm-activity-meta { font-size: 10px; color: var(--sub); margin-top: 1px; }
        .pm-activity-priority {
          margin-left: auto; font-size: 9px; font-weight: 800; background: #FEE2E2; color: #B91C1C;
          padding: 3px 8px; border-radius: 20px; white-space: nowrap;
        }

        .pm-back-bar {
          background: #fff;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          color: var(--deep-green);
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          border: 1px solid var(--line);
          margin-bottom: 16px;
          box-shadow: 0 4px 10px rgba(10,59,36,0.04);
        }
        .pm-back-bar:hover {
          background-color: var(--bg);
        }
        .pm-subview-container {
          margin-top: 14px;
        }

        .pm-bottom-space { height: 90px; }
        .pm-bottom-nav {
          position: absolute; bottom: 0; left: 0; right: 0; background: #fff;
          border-top: 1px solid var(--line); display: flex; justify-content: space-around; padding: 10px 6px 22px;
          z-index: 20;
        }
        .pm-nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 9.5px; font-weight: 700; color: var(--sub); cursor: pointer; }
        .pm-nav-item.active { color: var(--deep-green); }
        .pm-nav-icon { display: flex; align-items: center; justify-content: center; }

        .pm-caption { color: #888; font-size: 12px; text-align: center; margin-top: 16px; width: 100%; display: block; }
      `}</style>

      <div className="pm-phone">
        <div className="pm-notch"></div>
        <div className="pm-statusbar">
          <span>9:41</span>
          <span>●●● 📶 🔋</span>
        </div>
        <div className="pm-scroll">
          <div className="pm-header">
            <div className="pm-brand">
              {effectiveLogo ? (
                <img 
                  src={effectiveLogo} 
                  alt={globalTitle || "PockettClinic"} 
                  className="w-[42px] h-[42px] rounded-xl object-cover bg-white p-0.5 shrink-0 border border-slate-200/50 shadow-sm" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-[42px] h-[42px] rounded-xl bg-[#C8E6C9] p-1 flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                  <img src="/logo.svg" alt="PockettClinic Logo" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="min-w-0 overflow-hidden">
                <div className="pm-brand-name">{globalTitle || "PockettClinic"}</div>
                <div className="pm-brand-tag">{globalSlogan || "Your Digital Hospital Anywhere"}</div>
              </div>
            </div>
            <div className="pm-header-icons">
              <NetworkSyncIndicator compact={true} />
              <div 
                className="pm-icon-btn relative w-[36px] h-[36px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200" 
                onClick={() => {
                  if (activeDashboardTab === 'notifications') {
                    setActiveDashboardTab('appointments');
                  } else {
                    setActiveDashboardTab('notifications');
                  }
                }}
              >
                <Bell size={18} className="stroke-[1.8] text-white hover:scale-105 transition-transform" />
                {unreadCount > 0 && <div className="pm-dot-badge"></div>}
              </div>
              <div 
                className="pm-icon-btn w-[36px] h-[36px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200" 
                onClick={() => {
                  if (activeDashboardTab === 'more') {
                    setActiveDashboardTab('appointments');
                  } else {
                    setActiveDashboardTab('more');
                  }
                }}
              >
                <Menu size={18} className="stroke-[1.8] text-white hover:scale-105 transition-transform" />
              </div>
            </div>
          </div>

          <div className="pm-content">
            <div className="pm-profile-card">
              <div className="pm-profile-left">
                <div className="pm-avatar">{roleConfig.initials}</div>
                <div>
                  <div className="pm-profile-name">{roleConfig.name}</div>
                  <div className="pm-profile-role">{roleConfig.role}</div>
                </div>
              </div>
              <div 
                className="pm-badge"
                style={{
                  background: isPendingReview ? 'var(--amber-light)' : 'var(--accent-green-light)',
                  color: isPendingReview ? '#92620A' : '#166534'
                }}
              >
                {roleConfig.badge}
              </div>
            </div>

            <div className="pm-status-row">
              <div className="pm-status-online">
                <span className="pm-pulse"></span> {isOnline ? 'Online & Ready' : 'On-Shift'}
              </div>
              <div className="pm-status-date">📅 Today: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>

            {activeDashboardTab !== 'appointments' ? (
              <div className="pm-subview-container animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div 
                  className="pm-back-bar" 
                  onClick={() => {
                    if (['portfolio', 'soap', 'drug-safety', 'referrals', 'stg-reference', 'feedback', 'follow-ups', 'chat', 'payout-hub', 'subscription'].includes(activeDashboardTab)) {
                      setActiveDashboardTab('more');
                    } else {
                      setActiveDashboardTab('appointments');
                    }
                  }}
                >
                  <ArrowLeft size={14} className="stroke-[2]" />
                  <span>{['portfolio', 'soap', 'drug-safety', 'referrals', 'stg-reference', 'feedback', 'follow-ups', 'chat', 'payout-hub', 'subscription'].includes(activeDashboardTab) ? 'Back to Utilities Menu' : 'Back to Dashboard'}</span>
                </div>
                
                {activeDashboardTab === 'more' ? (
                  <div className="pm-more-menu-container">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 px-1" style={{ letterSpacing: '0.05em' }}>CLINIC UTILITIES & SETTINGS</h3>
                    <div className="pm-hub-grid">
                      {[
                        { id: 'portfolio', title: 'Professional Profile & Bio', sub: 'MDC License pin, education, work, credentials', bg: 'var(--accent-green-light)' },
                        { id: 'soap', title: 'SOAP Notes Clinical Assistant', sub: 'Draft structured clinical reports with voice assistant support', bg: 'var(--purple-light)' },
                        { id: 'drug-safety', title: 'Drug Interaction & Safety Checker', sub: 'Check safety warnings, contraindications, STGs', bg: 'var(--amber-light)' },
                        { id: 'referrals', title: 'Specialist Referral Registry', sub: 'Request and process referrals across networks', bg: 'var(--blue-light)' },
                        { id: 'stg-reference', title: 'Clinical Treatment Guidelines', sub: 'Ghana Authorized Standard Treatment Guidelines', bg: 'var(--accent-green-light)' },
                        { id: 'follow-ups', title: 'Follow-up Scheduler', sub: 'Schedule patient follow-ups and reviews', bg: 'var(--purple-light)' },
                        { id: 'chat', title: 'Follow-up Chat', sub: 'Secure text communication with patients', bg: 'var(--amber-light)' },
                        { id: 'payout-hub', title: 'Earnings & MoMo Payout', sub: 'Mobile Money (MTN, Telecel) withdrawals', bg: 'var(--blue-light)' },
                        { id: 'feedback', title: 'Patient Feedback & Ratings', sub: 'Check historical patient reviews and stats', bg: 'var(--amber-light)' },
                        { id: 'subscription', title: 'Subscription & Plan', sub: 'View and manage your active partner tier', bg: 'var(--purple-light)' },
                        { id: 'settings', title: 'Settings & Preferences', sub: 'Configure notifications, alerts, and user settings', bg: 'var(--blue-light)', action: 'settings' },
                        { id: 'logout', title: 'Sign Out & End Session', sub: 'Securely end your current consultant session', bg: '#FEE2E2', action: 'logout' }
                      ].map((item) => (
                        <div 
                          key={item.id}
                          className="pm-hub-card animate-in fade-in slide-in-from-bottom-2 duration-150"
                          onClick={() => {
                            if (item.action === 'settings') {
                              onOpenSettings();
                            } else if (item.action === 'delete') {
                              onOpenDeletion();
                            } else if (item.action === 'logout') {
                              if (confirm("Are you sure you want to sign out?")) {
                                logout().then(() => {
                                  window.location.href = '/';
                                });
                              }
                            } else {
                              setActiveDashboardTab(item.id);
                            }
                          }}
                        >
                          <div className="pm-hub-icon" style={{ background: item.bg }}>
                            {getMoreIconComponent(item.id)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="pm-hub-title" style={{ color: item.id === 'delete' ? '#B91C1C' : undefined }}>{item.title}</div>
                            <div className="pm-hub-sub">{item.sub}</div>
                          </div>
                          <div className="pm-hub-arrow">
                            <ChevronRight size={16} className="text-slate-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : activeDashboardTab === 'notifications' ? (
                  <div className="pm-notifications-view bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <h3 className="font-extrabold text-sm text-slate-800">NOTIFICATIONS CENTER</h3>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <button
                          onClick={async () => {
                            const userUid = effectiveUser?.uid || effectiveUser?.id;
                            if (!userUid) return;
                            const unread = notifications.filter(n => !n.read);
                            for (const item of unread) {
                              await updateDoc(doc(db, 'user_notifications', userUid, 'items', item.id), { read: true });
                            }
                          }}
                          className="text-[10px] text-emerald-700 font-extrabold hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                      {loadingNotifs ? (
                        <div className="p-8 text-center text-xs text-slate-400 font-medium">Loading alerts...</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-10 text-center space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 mb-2">
                            <Bell size={20} className="stroke-[1.6]" />
                          </div>
                          <p className="text-xs font-bold text-slate-500">No new notifications</p>
                          <p className="text-[10px] text-slate-400">All caught up! Real-time alerts will appear here.</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={async () => {
                              const userUid = effectiveUser?.uid || effectiveUser?.id;
                              if (!n.read && userUid) {
                                await updateDoc(doc(db, 'user_notifications', userUid, 'items', n.id), { read: true });
                              }
                              const lowerTitle = (n.title || '').toLowerCase();
                              const lowerMsg = (n.message || '').toLowerCase();
                              if (lowerTitle.includes('feedback') || lowerTitle.includes('rating') || lowerTitle.includes('review') || lowerMsg.includes('feedback') || lowerMsg.includes('rating') || lowerMsg.includes('review')) {
                                setActiveDashboardTab('feedback');
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                              n.read
                                ? 'bg-white border-slate-100 text-slate-500'
                                : 'bg-emerald-50/40 border-emerald-100 text-slate-800 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-extrabold text-slate-800 leading-snug">{n.title}</p>
                              {!n.read && <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full shrink-0 mt-1" />}
                            </div>
                            {n.message && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{n.message}</p>}
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {n.createdAt ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  renderActiveTabContent()
                )}
              </div>
            ) : (
              <>
                {/* Incoming Ringing Calls Banner on Mobile Home */}
                {effectiveConsultations && effectiveConsultations.filter(c => {
                  const s = (c.status || '').toUpperCase();
                  const d = (c.dispatchStatus || '').toUpperCase();
                  const isRinging = (d === 'RINGING' || d === 'RE-ROUTING' || d === 'ESCALATED' || d === 'DIRECT' || s === 'PAID' || s === 'PENDING') && d !== 'ACCEPTED' && d !== 'CANCELLED' && !s.startsWith('CANCEL') && s !== 'COMPLETED';
                  const isForMe = !c.assignedConsultantId || c.assignedConsultantId === 'unassigned' || c.assignedConsultantId === consultantId || c.consultantId === consultantId;
                  const notDeclined = !(c.declinedBy || []).includes(consultantId);
                  return isRinging && isForMe && notDeclined;
                }).length > 0 && (
                  <div className="pm-section animate-in fade-in slide-in-from-top-2">
                    <div className="pm-section-head">
                      <div className="pm-section-title text-amber-600 flex items-center gap-2 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                        Incoming Consultation Request
                      </div>
                    </div>
                    <div className="space-y-3">
                      {effectiveConsultations
                        .filter(c => {
                          const s = (c.status || '').toUpperCase();
                          const d = (c.dispatchStatus || '').toUpperCase();
                          const isRinging = (d === 'RINGING' || d === 'RE-ROUTING' || d === 'ESCALATED' || d === 'DIRECT' || s === 'PAID' || s === 'PENDING') && d !== 'ACCEPTED' && d !== 'CANCELLED' && !s.startsWith('CANCEL') && s !== 'COMPLETED';
                          const isForMe = !c.assignedConsultantId || c.assignedConsultantId === 'unassigned' || c.assignedConsultantId === consultantId || c.consultantId === consultantId;
                          const notDeclined = !(c.declinedBy || []).includes(consultantId);
                          return isRinging && isForMe && notDeclined;
                        })
                        .map((c: any) => (
                          <div key={c.sessionId} className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-2xl p-4 border-2 border-amber-400 shadow-lg space-y-3 animate-pulse">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                                  <PhoneCall size={18} className="animate-bounce" />
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-900">{c.patientName || 'Incoming Patient'}</h4>
                                  <p className="text-[10px] text-amber-700 font-bold uppercase">{c.sessionType || 'TELEMEDICINE'} • Ringing Now</p>
                                </div>
                              </div>
                              <span className="text-[9px] bg-amber-500 text-white font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                                Incoming
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await acceptConsultation(c.sessionId, consultantId, effectiveUser.name || 'Consultant');
                                  navigate(`/consultation/${c.sessionId}`);
                                } catch (err) {
                                  console.error("Failed to accept consultation:", err);
                                  navigate(`/consultation/${c.sessionId}`);
                                }
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer min-h-[44px]"
                            >
                              <PhoneCall size={16} />
                              <span>Accept Consultation & Connect</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Active Patient Consultations Queue on Mobile Home */}
                {effectiveConsultations && effectiveConsultations.filter(c => c.status && (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE') && c.dispatchStatus === 'accepted' && (c.assignedConsultantId === consultantId || c.consultantId === consultantId)).length > 0 && (
                  <div className="pm-section">
                    <div className="pm-section-head">
                      <div className="pm-section-title text-emerald-900 flex items-center gap-2 font-extrabold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Consultation Queue
                      </div>
                      <div className="pm-section-link" onClick={() => setActiveDashboardTab('queue')}>View Queue ›</div>
                    </div>
                    <div className="space-y-3">
                      {effectiveConsultations
                        .filter(c => c.status && (c.status === 'IN_PROGRESS' || c.status === 'ACTIVE') && c.dispatchStatus === 'accepted' && (c.assignedConsultantId === consultantId || c.consultantId === consultantId))
                        .map((c: any) => (
                          <div key={c.sessionId} className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-sm">
                                  {c.patientName ? c.patientName.slice(0, 2).toUpperCase() : 'PT'}
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-sm text-slate-800">{c.patientName || 'Anonymous Patient'}</h4>
                                  <p className="text-[10px] text-slate-500 font-bold uppercase">{c.sessionType || 'CONSULTATION'} • {c.status === 'IN_PROGRESS' ? 'Session In Progress' : 'Pending'}</p>
                                </div>
                              </div>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                Active
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/consultation/${c.sessionId}`);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                            >
                              <Video size={16} />
                              <span>Join Room</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div className="pm-section">
                  <div className="pm-section-head">
                    <div className="pm-section-title">Quick Actions</div>
                    <div className="pm-section-link" onClick={() => setActiveDashboardTab('queue')}>View All ›</div>
                  </div>
                  <div className="pm-quick-grid">
                    {roleConfig.quick.map(([iconId, bg, label, tabId]: any, i: number) => (
                      <div 
                        key={i} 
                        className="pm-quick-item"
                        onClick={() => setActiveDashboardTab(tabId)}
                      >
                        <div className="pm-quick-icon" style={{ background: bg }}>
                          {getQuickIconComponent(iconId)}
                        </div>
                        <div className="pm-quick-label">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pm-section">
                  <div className="pm-section-head">
                    <div className="pm-section-title">Today's Overview</div>
                    <div className="pm-section-link" onClick={() => setActiveDashboardTab('schedule')}>View Details ›</div>
                  </div>
                  <div className="pm-overview-card">
                    <div className="pm-stat-grid">
                      {roleConfig.stats.map(([iconId, bg, num, label]: any, i: number) => (
                        <div key={i} className="pm-stat">
                          <div className="pm-stat-icon" style={{ background: bg }}>
                            {getStatIconComponent(iconId)}
                          </div>
                          <div className="pm-stat-num">{num}</div>
                          <div className="pm-stat-label">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pm-section">
                  <div className="pm-section-head">
                    <div className="pm-section-title">My Schedule</div>
                    <div className="pm-section-link" onClick={() => setActiveDashboardTab('schedule')}>View Calendar ›</div>
                  </div>
                  <div className="pm-schedule-card" onClick={() => setActiveDashboardTab('schedule')}>
                    <div className="pm-schedule-left">
                      <div className="pm-schedule-clock">
                        <CalendarDays size={20} className="stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="pm-schedule-time">{roleConfig.schedTime}</div>
                        <div className="pm-schedule-sub">{roleConfig.schedSub}</div>
                      </div>
                    </div>
                    <div className="pm-schedule-right">
                      <div className="pm-schedule-patient">{roleConfig.schedPatient}</div>
                      <div className="pm-schedule-tag">{roleConfig.schedTag}</div>
                    </div>
                  </div>
                </div>

                <div className="pm-section">
                  <div className="pm-section-head">
                    <div className="pm-section-title">Recent Activity</div>
                    <div className="pm-section-link" onClick={() => setActiveDashboardTab('queue')}>View All ›</div>
                  </div>
                  <div>
                    {roleConfig.activity.map(([iconId, text, meta, tag]: any, i: number) => (
                      <div key={i} className="pm-activity-card">
                        <div className="pm-activity-icon">
                          {getActivityIconComponent(iconId)}
                        </div>
                        <div>
                          <div className="pm-activity-text">{text}</div>
                          <div className="pm-activity-meta">{meta}</div>
                        </div>
                        <div className="pm-activity-priority">{tag}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="pm-bottom-space"></div>
          </div>
        </div>

        <div className="pm-bottom-nav">
          {roleConfig.nav.map((item: string, i: number) => {
            const isActive = i === activeIndex;
            return (
              <div 
                key={i} 
                className={`pm-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(i)}
              >
                <span className="pm-nav-icon">
                  {i === 0 && <Home size={18} className={isActive ? 'text-emerald-700 stroke-[2.2]' : 'text-slate-400 stroke-[1.6]'} />}
                  {i === 1 && <Users size={18} className={isActive ? 'text-emerald-700 stroke-[2.2]' : 'text-slate-400 stroke-[1.6]'} />}
                  {i === 2 && <CalendarDays size={18} className={isActive ? 'text-emerald-700 stroke-[2.2]' : 'text-slate-400 stroke-[1.6]'} />}
                  {i === 3 && <Wallet size={18} className={isActive ? 'text-emerald-700 stroke-[2.2]' : 'text-slate-400 stroke-[1.6]'} />}
                  {i === 4 && <Menu size={18} className={isActive ? 'text-emerald-700 stroke-[2.2]' : 'text-slate-400 stroke-[1.6]'} />}
                </span>
                <span style={{ color: isActive ? '#0A3B24' : '#64748B' }}>{item.toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
