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
        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 w-52 px-3 py-2 rounded-xl text-[10px] leading-snug shadow-2xl text-center pointer-events-none whitespace-normal" style={{ backgroundColor: 'var(--color-tooltip-bg)', color: 'var(--color-tooltip-text)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-tooltip-border)' }}>
          {text}
        </span>
      )}
    </span>
  );
}
