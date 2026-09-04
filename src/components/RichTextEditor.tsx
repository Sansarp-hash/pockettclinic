import React from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type notes here...',
  minHeight = '150px',
  disabled = false
}: RichTextEditorProps) {
  return (
    <div className="w-full flex flex-col border border-white/20 rounded-2xl bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 focus-within:ring-2 focus-within:ring-lime-300 focus-within:border-slate-300 transition-all">
      <div className="bg-transparent border-b border-white/20 px-3 py-2 flex items-center gap-2 text-xs text-slate-300">
        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Clinical Editor</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ minHeight }}
        className="w-full p-3.5 text-sm bg-transparent text-white outline-none resize-y font-sans leading-relaxed disabled:bg-white/5 disabled:text-slate-400"
      />
    </div>
  );
}
