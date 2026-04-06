import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InfoTipProps {
  text: string;
}

const TOOLTIP_W = 208; // w-52 = 13rem

export function InfoTip({ text }: InfoTipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!show || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // fixed positioning is viewport-relative — no scrollX/scrollY offset needed
    const centerX = rect.left + rect.width / 2;
    // Clamp so tooltip never exits the visible viewport on either side
    const clampedLeft = Math.max(8, Math.min(window.innerWidth - TOOLTIP_W - 8, centerX - TOOLTIP_W / 2));
    setPos({
      top: rect.top - 8, // viewport-relative; -translate-y-full renders it above
      left: clampedLeft,
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
          className="fixed z-[9999] px-3 py-2 rounded-xl text-[10px] leading-snug shadow-2xl text-start pointer-events-none whitespace-normal -translate-y-full"
          style={{
            top: pos.top,
            left: pos.left,
            width: TOOLTIP_W,
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
