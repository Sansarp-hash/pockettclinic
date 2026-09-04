import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, FileText, Clock, Search, AlertTriangle, Calculator, Star } from 'lucide-react';
import { useAppContext } from '../AppContext';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminCardWrapper } from './admin/AdminCardWrapper';
import PublicConsultantDirectoryView from './public/PublicConsultantDirectoryView';
import HealthCostCalculatorModal from './public/HealthCostCalculatorModal';
import PatientReviewsCarousel from './public/PatientReviewsCarousel';
import BrandingLogo from './BrandingLogo';

export default function LandingPage() {
  const { user, login, allUsers, globalLogoUrl } = useAppContext();
  const navigate = useNavigate();
  const [showCostCalc, setShowCostCalc] = useState(false);
  const [heroContent, setHeroContent] = useState({ 
    title: 'Healthcare, instantly.', 
    description: 'Connect with licensed and certified health consultants in minutes via secure chat or video consultation. No more self-medicating. Get the right assessment from the health official.' 
  });

  useEffect(() => {
    const unsubBranding = onSnapshot(doc(db, 'settings', 'branding'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.heroTitle) setHeroContent(prev => ({ ...prev, title: data.heroTitle }));
        if (data.heroDescription) setHeroContent(prev => ({ ...prev, description: data.heroDescription }));
      }
    }, (err) => {
      console.warn("Branding listener error:", err);
    });
    return () => unsubBranding();
  }, []);

  const handleUpdateHero = async (title: string, description: string) => {
    try {
      await updateDoc(doc(db, 'settings', 'branding'), {
        heroTitle: title,
        heroDescription: description
      });
    } catch (err: any) {
      console.error("Hero update error:", err);
    }
  };

  // Handle clean returnTo redirects if specified
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('login')) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('login');
      window.history.replaceState({}, '', newUrl.pathname + (newUrl.search ? newUrl.search : ''));
    }
  }, []);

  const handleJoinConsultant = () => {
    if (user) {
      navigate('/consultant/onboarding');
    } else {
      // Prepare URL for post-login redirect and trigger login
      const loginUrl = new URL(window.location.origin);
      loginUrl.searchParams.set('returnTo', '/consultant/onboarding');
      window.history.pushState({}, '', loginUrl.pathname + loginUrl.search);
      login().catch((err) => {
        console.info("Landing page Google sign-in handled:", err?.message || err);
      });
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center">
      {/* Emergency Disclaimer Banner */}
      <div className="sticky top-0 z-[100] w-full bg-amber-50 border-b border-amber-200 py-2.5 px-4 sm:px-8 shadow-sm backdrop-blur-md bg-amber-50/90">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={16} />
          <p className="text-[12px] sm:text-[13px] text-amber-900 leading-tight font-medium">
            <span className="font-bold uppercase tracking-wider text-[10px] mr-1">Notice:</span> PockettClinic is a platform for non-emergency virtual consultations. If you are experiencing a medical emergency, call <span className="font-bold underline">112</span> or visit the nearest hospital immediately.
          </p>
        </div>
      </div>

      <div 
        className="w-full relative bg-cover bg-center py-24 px-4 overflow-hidden"
        style={{ backgroundImage: `url(${globalLogoUrl || '/logo.svg'})` }}
      >
        {/* Solid dark theme overlay layer */}
        <div className="absolute inset-0 bg-[#0f172a] opacity-95"></div>

        {/* Content container */}
        <div className="relative z-10 max-w-4xl mx-auto text-center text-white space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium border border-indigo-500/30 backdrop-blur-md shadow-sm">
             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
             Available Nationwide
          </div>
          
          <AdminCardWrapper
            cardId="landing_hero"
            defaultTitle={heroContent.title}
            defaultDescription={heroContent.description}
            onUpdate={(_, { title, description }) => handleUpdateHero(title, description || '')}
          >
            {({ title, description }) => (
              <>
                <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-white drop-shadow-sm">
                  {title}
                </h1>
                <p className="text-slate-200 text-lg max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
                  {description}
                </p>
              </>
            )}
          </AdminCardWrapper>

          <div className="pt-2 flex flex-col items-center gap-4">
            {!user && (
              <div className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold text-indigo-200 uppercase tracking-widest mb-2 border border-white/10 backdrop-blur-sm">
                Guest Mode Enabled
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/find-care" className="px-8 py-4 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold text-white transition-colors shadow-lg shadow-indigo-500/30 flex items-center gap-2">
                <Search size={20} />
                Find Care Now
              </Link>
              <button 
                onClick={() => setShowCostCalc(true)}
                className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold text-slate-950 transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Calculator size={20} />
                Cost Savings Calculator
              </button>
              <button 
                onClick={handleJoinConsultant}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-white transition-colors border border-white/10 cursor-pointer"
              >
                Join as a Consultant
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-16">
        {/* Patient Reviews Carousel */}
        <PatientReviewsCarousel />

        {/* Public Consultant Directory */}
        <PublicConsultantDirectoryView
          consultants={(allUsers || []).filter(u => u.role === 'consultant')}
          onBookConsultant={(c) => navigate(`/booking/${c.id || c.uid}`)}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          <AdminCardWrapper 
            cardId="landing_virtual_consults"
            defaultTitle="Virtual Consults"
            defaultDescription="Secure end-to-end encrypted video and audio calls with consultants."
          >
            {({ title, description }) => (
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center flex flex-col items-center gap-4 h-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Video size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                <p className="text-slate-500">{description}</p>
              </div>
            )}
          </AdminCardWrapper>

          <AdminCardWrapper 
            cardId="landing_digital_rx"
            defaultTitle="Digital Prescriptions"
            defaultDescription="Tamper-proof Rx with Council PIN verification accepted at any pharmacy."
          >
            {({ title, description }) => (
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center flex flex-col items-center gap-4 h-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FileText size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                <p className="text-slate-500">{description}</p>
              </div>
            )}
          </AdminCardWrapper>

          <AdminCardWrapper 
            cardId="landing_on_demand"
            defaultTitle="On-Demand"
            defaultDescription="Book in advance or join an instant queue for immediate medical attention."
          >
            {({ title, description }) => (
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center flex flex-col items-center gap-4 h-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Clock size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                <p className="text-slate-500">{description}</p>
              </div>
            )}
          </AdminCardWrapper>
        </div>
      </div>

      <footer className="w-full bg-white border-t border-slate-200 py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <BrandingLogo />
          
          <div className="max-w-md text-center md:text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 mb-3">
              <AlertTriangle size={14} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Emergency Notice</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              PockettClinic is a platform for non-emergency virtual consultations. If you are experiencing a medical emergency, call <span className="font-bold text-slate-900">112</span> or visit the nearest hospital immediately.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} PockettClinic Platform. Your Digital Hospital Anywhere. All rights reserved.
          </p>
        </div>
      </footer>

      <HealthCostCalculatorModal
        isOpen={showCostCalc}
        onClose={() => setShowCostCalc(false)}
      />
    </div>
  );
}
