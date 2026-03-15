import { useState } from 'react';

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ms-1">
      <button
        type="button"
        className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[8px] font-bold flex items-center justify-center hover:bg-yellow-500/35 transition-colors leading-none shrink-0"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={(e) => { e.stopPropagation(); setShow(v => !v); }}
        aria-label="More info"
      >
        i
      </button>
      {show && (
        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 w-52 px-3 py-2 rounded-xl bg-[#1c1c2e] border border-yellow-500/20 text-yellow-200/85 text-[10px] leading-snug shadow-2xl text-center pointer-events-none whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}
