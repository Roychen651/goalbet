import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Compute position on show so tooltip renders at the right place in the portal
  useEffect(() => {
    if (!show || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 8,   // 8px gap above button
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [show]);

  return (
    <span className="relative inline-flex items-center ms-1">
      <button
        ref={btnRef}
        type="button"
        className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[8px] font-bold flex items-center justify-center hover:bg-yellow-500/35 transition-colors leading-none shrink-0"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={(e) => { e.stopPropagation(); setShow(v => !v); }}
        aria-label="More info"
      >
        i
      </button>
      {show && createPortal(
        <span
          className="fixed z-[9999] w-52 px-3 py-2 rounded-xl text-[10px] leading-snug shadow-2xl text-center pointer-events-none whitespace-normal -translate-x-1/2 -translate-y-full"
          style={{
            top: pos.top,
            left: pos.left,
            backgroundColor: 'var(--color-tooltip-bg)',
            color: 'var(--color-tooltip-text)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--color-tooltip-border)',
          }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}
