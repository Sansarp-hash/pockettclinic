import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkConnectionQualityIndicator() {
  const [quality, setQuality] = useState<'EXCELLENT' | 'GOOD' | 'POOR'>('EXCELLENT');
  const [latencyMs, setLatencyMs] = useState<number>(32);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate mild real-world network fluctuations
      const rand = Math.random();
      if (rand > 0.9) {
        setQuality('POOR');
        setLatencyMs(185);
      } else if (rand > 0.6) {
        setQuality('GOOD');
        setLatencyMs(65);
      } else {
        setQuality('EXCELLENT');
        setLatencyMs(28);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full text-[10px] font-bold">
      <Wifi
        size={14}
        className={
          quality === 'EXCELLENT'
            ? 'text-emerald-400 animate-pulse'
            : quality === 'GOOD'
            ? 'text-amber-400'
            : 'text-rose-400'
        }
      />
      <span className="text-slate-300 uppercase tracking-wider">
        {quality === 'EXCELLENT' ? 'HD Signal' : quality === 'GOOD' ? 'Good' : 'Weak Signal'}
      </span>
      <span className="text-slate-500 font-mono">({latencyMs}ms)</span>
    </div>
  );
}
