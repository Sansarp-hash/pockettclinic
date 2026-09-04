import React from 'react';
import { MapPin, Users, Activity, Stethoscope, Compass } from 'lucide-react';

export interface AdminGeographicHeatmapProps {
  consultations: any[];
  consultants: any[];
}

export default function AdminGeographicHeatmap({
  consultations,
  consultants
}: AdminGeographicHeatmapProps) {
  interface RegionData {
    name: string;
    activeConsultants: number;
    consultationsToday: number;
    color: string;
  }

  // Aggregate real data from the database
  const regionStats = consultants.reduce((acc: Record<string, RegionData>, c) => {
    const region = c.region || 'Unassigned';
    if (!acc[region]) acc[region] = { name: region, activeConsultants: 0, consultationsToday: 0, color: 'bg-emerald-600' };
    acc[region].activeConsultants++;
    return acc;
  }, {});

  // Add consultation counts
  consultations.forEach(c => {
    const region = c.patientRegion || c.consultantRegion || 'Unassigned';
    if (regionStats[region]) regionStats[region].consultationsToday++;
  });

  const regions: RegionData[] = Object.values(regionStats).length > 0 
    ? Object.values(regionStats) as RegionData[]
    : [{ name: 'Greater Accra', activeConsultants: 0, consultationsToday: 0, color: 'bg-emerald-600' }];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden space-y-0">
        <div className="p-6 md:p-8 bg-white text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <MapPin className="text-rose-400" size={24} />
              <h3 className="text-xl font-bold">Ghana Regional Telehealth Heatmap</h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Geographic distribution of active consultants and patient consultation demand.
            </p>
          </div>

          <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <Compass size={14} className="text-slate-600" /> 16 Administrative Regions
          </span>
        </div>

        {/* Region Breakdown Cards */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {regions.map((r) => (
            <div key={r.name} className="p-5 rounded-2xl border border-slate-200 bg-white/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">{r.name}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Licensed Consultants:</span>
                  <span className="font-bold text-slate-800">{r.activeConsultants}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">Sessions Today:</span>
                  <span className="font-bold text-slate-600">{r.consultationsToday}</span>
                </div>
              </div>

              <div className="w-full bg-slate-50 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full ${r.color}`}
                  style={{ width: `${Math.min(100, (r.consultationsToday / 45) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
