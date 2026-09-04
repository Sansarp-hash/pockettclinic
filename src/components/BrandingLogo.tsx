import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../AppContext';

interface BrandingLogoProps {
  className?: string;
  logoSize?: string;
  titleSize?: string;
  sloganSize?: string;
  showSlogan?: boolean;
}

export default function BrandingLogo({ 
  className = "", 
  logoSize = "w-10 h-10 sm:w-11 sm:h-11",
  titleSize = "text-sm sm:text-xl",
  sloganSize = "text-[10px] sm:text-[11px]",
  showSlogan = true
}: BrandingLogoProps) {
  const { globalLogoUrl, globalSlogan, globalTitle, user, role } = useAppContext();

  // Super admin check for redirect logic
  const superAdmins = ["missty2k@gmail.com", "pharmabridgeghana@gmail.com"]; 
  const userEmail = (user?.email || '').toLowerCase();
  const isSuperAdmin = userEmail && superAdmins.includes(userEmail);
  const effectiveRole = isSuperAdmin ? 'admin' : (role || '').toLowerCase();

  const getDashboardPath = () => {
    if (!user) return "/";
    if (effectiveRole === 'admin') return "/admin/dashboard";
    if (effectiveRole === 'consultant') return "/consultant/dashboard";
    return "/patient/dashboard";
  };

  return (
    <Link 
      to={getDashboardPath()} 
      className={`flex items-center gap-2.5 hover:opacity-90 transition-opacity min-w-0 flex-shrink ${className}`}
    >
      <img 
        src={globalLogoUrl || '/logo.svg'} 
        alt={`${globalTitle || 'PockettClinic'} Logo`} 
        className={`${logoSize} rounded-full shadow-md shadow-emerald-900/5 flex-shrink-0 object-cover bg-white p-0.5 border border-slate-100`} 
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
      <div className="flex flex-col justify-center min-w-0 overflow-hidden">
        <h1 className={`font-black tracking-tight text-emerald-800 leading-none truncate ${titleSize}`}>
          {globalTitle || 'PockettClinic'}
        </h1>
        {showSlogan && (
          <span className={`text-emerald-600 font-bold leading-tight block mt-1 ${sloganSize} max-w-[180px] sm:max-w-none truncate sm:whitespace-normal line-clamp-1 sm:line-clamp-none`}>
            {globalSlogan || 'Your Digital Hospital Anywhere'}
          </span>
        )}
      </div>
    </Link>
  );
}
