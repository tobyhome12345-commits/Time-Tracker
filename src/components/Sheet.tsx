import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { pushBack } from '../native/back';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Accent for the header strip (e.g. inside/outside colour). */
  tint?: string;
  labelledBy?: string;
}

/** Bottom sheet with scrim, slide animation, Android back-button support and focus handling. */
export function Sheet({ title, onClose, children, footer, tint }: Props) {
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => closeRef.current(), 200);
  }, []);

  useEffect(() => pushBack(close), [close]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [close]);

  return createPortal(
    <>
      <div className={`sheet-scrim${closing ? ' closing' : ''}`} onClick={close} />
      <div
        className={`sheet${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={ref}
        style={tint ? ({ '--sheet-tint': tint } as React.CSSProperties) : undefined}
      >
        <div className="sheet-grab" />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" style={{ boxShadow: 'none' }} onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

/** Lets a child request the sheet to animate closed. */
export function useSheetClose(onClose: () => void) {
  return onClose;
}
