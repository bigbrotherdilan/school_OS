import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PreviewFullscreenModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  fit?: 'contain' | 'width';
  maxScale?: number;
  controls?: ReactNode;
  children: ReactNode;
}

export default function PreviewFullscreenModal({
  open,
  onClose,
  title = 'Preview',
  fit = 'contain',
  maxScale = 6,
  controls,
  children,
}: PreviewFullscreenModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (open) setZoom(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNative(null);
    setScale(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0 && h > 0) setNative({ w, h });
  }, [open, children]);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => setTick(t => t + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  useEffect(() => {
    if (!open || !native) {
      setScale(0);
      return;
    }
    const pad = 96;
    const availW = Math.max(1, window.innerWidth - pad);
    const availH = Math.max(1, window.innerHeight - pad);
    let s = fit === 'contain'
      ? Math.min(availW / native.w, availH / native.h, maxScale)
      : Math.min(availW / native.w, maxScale);
    s = Math.max(0.05, s) * zoom;
    setScale(s);
  }, [native, zoom, fit, maxScale, open, tick]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(2, 6, 23, 0.88)',
    display: 'flex',
    flexDirection: 'column',
  };

  const scrollerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    justifyContent: 'safe center',
    alignItems: 'safe center',
    padding: '72px 48px 64px',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 z-10"
        style={{ background: 'rgba(2, 6, 23, 0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-white">
          <span className="material-symbols-outlined text-lg opacity-80">visibility</span>
          <span className="text-sm font-semibold tracking-wide">{title}</span>
          <span className="text-xs opacity-50 ml-1">
            {scale > 0 ? `${Math.round(scale * 100)}%` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            title="Zoom out"
          >
            <span className="material-symbols-outlined text-lg">zoom_out</span>
          </button>
          <button
            onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            title="Zoom in"
          >
            <span className="material-symbols-outlined text-lg">zoom_in</span>
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            title="Close (Esc)"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={scrollerStyle}>
        <div
          style={{
            width: native ? Math.round(native.w * scale) : undefined,
            height: native ? Math.round(native.h * scale) : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            ref={contentRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              opacity: native ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      {controls && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-5 py-4 z-10"
          style={{ background: 'rgba(2, 6, 23, 0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {controls}
        </div>
      )}
    </div>
  );
}
