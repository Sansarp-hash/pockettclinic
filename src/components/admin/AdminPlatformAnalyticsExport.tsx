import React, { useState } from 'react';
import { Download, FileText, Calendar, TrendingUp, DollarSign, CheckCircle2, Loader2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';

export default function AdminPlatformAnalyticsExport() {
  const { showToast } = useAppContext();
  const [isExporting, setIsExporting] = useState(false);
  const [exportMonth, setExportMonth] = useState('2026-08');

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const csvHeader = 'Report_Month,Total_Consultations,Gross_Volume_GHS,Platform_Commissions_GHS,GRA_Withholding_Tax_GHS,Active_Consultants\n';
      const csvData = `${exportMonth},1420,113600.00,22720.00,8520.00,64\n`;
      const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PockettClinic_Platform_Report_${exportMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setIsExporting(false);
      showToast(`Exported monthly platform statement for ${exportMonth}`, "success");
    }, 800);
  };

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
          <TrendingUp size={16} />
          <span>Platform Performance & GRA Statements</span>
        </div>
        <h3 className="text-xl font-bold text-white">Monthly Analytics & CSV Financial Exporter</h3>
        <p className="text-xs text-slate-300 mt-1 max-w-lg">
          Generate official monthly platform performance summaries, fee distributions, and GRA tax audit statements.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
        <input
          type="month"
          value={exportMonth}
          onChange={e => setExportMonth(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none min-h-[44px] w-full sm:w-auto"
        />

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="w-full sm:w-auto px-5 py-3 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export Statement CSV
        </button>
      </div>
    </div>
  );
}
