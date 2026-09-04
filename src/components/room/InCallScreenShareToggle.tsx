import React, { useState } from 'react';
import { Monitor, MonitorOff } from 'lucide-react';
import { useAppContext } from '../../AppContext';

interface InCallScreenShareToggleProps {
  onToggleScreenShare?: (isSharing: boolean) => void;
}

export default function InCallScreenShareToggle({ onToggleScreenShare }: InCallScreenShareToggleProps) {
  const { showToast } = useAppContext();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const handleToggle = () => {
    const nextState = !isScreenSharing;
    setIsScreenSharing(nextState);
    if (onToggleScreenShare) {
      onToggleScreenShare(nextState);
    }
    showToast(nextState ? "Screen sharing started." : "Screen sharing stopped.", "info");
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-3 sm:px-4 sm:py-2.5 min-h-[44px] rounded-2xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md ${
        isScreenSharing
          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
      }`}
      title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
    >
      {isScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
      <span className="hidden sm:inline">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
    </button>
  );
}
