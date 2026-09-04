import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { DashboardSkeleton, SidebarDashboardSkeleton } from './Skeleton';
import { Role, isConsultantRole } from '../types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

const SUPER_ADMINS = ['missty2k@gmail.com', 'pockettclinic@gmail.com', 'pharmabridgeghana@gmail.com'];

/**
 * RoleGuard strictly prevents unauthorized access based on the user's Firestore role.
 * If the user is unauthenticated, they are redirected to the Landing Page.
 * If the user has a mismatching role, they are redirected to their appropriate dashboard.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles = [] }) => {
  const { user, role, isLoading } = useAppContext();
  const location = useLocation();
  const safeAllowed = Array.isArray(allowedRoles) ? allowedRoles : [];

  if (isLoading) {
    // Show appropriate skeleton based on expected role for smoother perceived performance
    if (safeAllowed.includes('admin') || safeAllowed.includes('consultant')) {
      return (
        <div className="min-h-screen bg-white">
          <SidebarDashboardSkeleton />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white">
        <DashboardSkeleton />
      </div>
    );
  }

  // 1. Allow public access if route permits public
  if (!user && safeAllowed.includes('public')) {
    return <>{children}</>;
  }

  // 2. Strict Auth Check for protected routes
  if (!user) {
    return <Navigate to={`/?returnTo=${encodeURIComponent(location?.pathname || '/')}`} replace />;
  }

  // 3. Super Admin & Admin bypass for administrative access & live dashboard previews
  const userEmail = (user.email || '').toLowerCase();
  const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);
  if (role === 'admin' || role === 'super_admin' || isSuperAdmin) {
    return <>{children}</>;
  }

    if (!safeAllowed.includes(role)) {
      // Redirect unauthorized users to their natural "home"
      if (isConsultantRole(role)) return <Navigate to="/consultant/dashboard" replace />;
      if (role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    
    // Default fallback for corrupted roles
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Role Mismatch Error</h2>
          <p className="text-sm text-slate-600 mb-6">
            Your account role (&quot;{role}&quot;) is not authorized for this area, or your session is corrupted.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl cursor-pointer"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * PublicOnlyGuard prevents logged-in users from seeing the landing page or login screens.
 */
export const PublicOnlyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isLoading } = useAppContext();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <DashboardSkeleton />
      </div>
    );
  }

  if (user) {
    const userEmail = (user.email || '').toLowerCase();
    const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);

    if (role === 'admin' || role === 'super_admin' || isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isConsultantRole(role)) return <Navigate to="/consultant/dashboard" replace />;
    if (role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    
    // Authenticated users whose role defaults to fallback: route them to patient dashboard
    return <Navigate to="/patient/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
