import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-50 rounded ${className || ''}`} />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-8 w-full rounded-xl" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-12 w-48 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-200">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="p-8 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SidebarDashboardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] w-full">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-200 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <nav className="p-4 space-y-2 flex-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="w-full h-12 rounded-xl" />
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 md:p-8 space-y-8 bg-white/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
             <Skeleton className="h-10 w-32 rounded-xl" />
             <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
             <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200">
               <Skeleton className="h-3 w-24 mb-4" />
               <Skeleton className="h-8 w-16" />
             </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
             <Skeleton className="h-6 w-48" />
          </div>
          <div className="p-6 space-y-4">
             {[1, 2, 3, 4].map((i) => (
               <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
               </div>
             ))}
          </div>
        </div>
      </main>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5 }) => {
  return (
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-50">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
};

export const StatSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 flex flex-col gap-4">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
};
