'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, Download, RefreshCw, X, ArrowRight, Aperture, ChevronDown } from 'lucide-react';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComposeOpts {
  cols: number;
  rows: number;
  pw: number;
  ph: number;
  gap?: number;
  bgColor?: string;
  customText?: string;
  stickers?: { text: string, xRatio: number, yRatio: number }[];
}

interface PreviewSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  id: string;
  label: string;
  sublabel: string;
  photoCount: number;
  previewW: number;
  previewH: number;
  previewSlots: PreviewSlot[];
  slotAR: [number, number];
  compose: (photos: string[], canvas: HTMLCanvasElement, bgOpts?: { bgColor: string; customText: string; stickers?: { text: string, xRatio: number, yRatio: number }[] }) => Promise<string>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAD = 20, PW = 800, PH = 746;

// ─── composeStrip ─────────────────────────────────────────────────────────────

function composeStrip(
  photos: string[],
  canvas: HTMLCanvasElement,
  opts: ComposeOpts
): Promise<string> {
  return new Promise(resolve => {
    const { cols, rows, pw, ph, gap = PAD, bgColor = '#FFFFFF', customText = 'NUL PHOTOBOOTH', stickers = [] } = opts;
    const HEADER = 64, FOOTER = 52;
    const W = PAD * 2 + pw * cols + gap * (cols - 1);
    const H = PAD + HEADER + (ph + gap) * rows - gap + FOOTER + PAD;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const isDarkBg = bgColor === '#0A0A0A' || bgColor === '#0047FF';
    const mainTextColor = isDarkBg ? '#FFFFFF' : '#0A0A0A';
    const accentTextColor = isDarkBg ? '#FFE500' : '#888';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#FFE500';
    ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 6, W, 3);

    ctx.fillStyle = mainTextColor;
    ctx.font = '900 15px "Archivo Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(customText || 'NUL PHOTOBOOTH', W / 2, PAD + 30);
    ctx.fillStyle = accentTextColor;
    ctx.font = '700 9px "Courier Prime", monospace';
    ctx.fillText('◆ INSTANT MOMENTS ◆', W / 2, PAD + 48);

    ctx.fillStyle = mainTextColor;
    ctx.fillRect(PAD, PAD + HEADER - 6, W - PAD * 2, 2);

    let loaded = 0;
    const drawAll = () => {
      ctx.fillStyle = mainTextColor;
      ctx.fillRect(PAD, H - PAD - FOOTER + 4, W - PAD * 2, 2);
      ctx.fillStyle = accentTextColor;
      ctx.font = '700 8px "Courier Prime", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${new Date().getFullYear()} · ${customText || 'NUL PHOTOBOOTH'}`, W / 2, H - PAD - FOOTER + 22);
      ctx.fillStyle = '#FFE500';
      ctx.fillRect(0, H - 9, W, 6);
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, H - 3, W, 3);

      stickers.forEach(s => {
        ctx.save();
        const sx = s.xRatio * W;
        const sy = s.yRatio * H;
        ctx.translate(sx, sy);
        ctx.rotate(((sx + sy) % 100 - 50) / 200);
        ctx.fillStyle = '#FFE500';
        ctx.font = '900 64px "Archivo Black", sans-serif';
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 6;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(s.text, 0, 0);
        ctx.fillText(s.text, 0, 0);
        ctx.restore();
      });

      resolve(canvas.toDataURL('image/jpeg', 0.96));
    };

    photos.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        const col = i % cols, row = Math.floor(i / cols);
        const slotX = PAD + col * (pw + gap);
        const slotY = PAD + HEADER + row * (ph + gap);
        const iAR = img.width / img.height;
        const cAR = pw / ph;
        let dw: number, dh: number, ox: number, oy: number;
        if (iAR > cAR) {
          dh = ph; dw = dh * iAR;
          ox = (pw - dw) / 2; oy = 0;
        } else {
          dw = pw; dh = dw / iAR;
          ox = 0; oy = (ph - dh) / 2;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(slotX, slotY, pw, ph);
        ctx.clip();
        ctx.drawImage(img, slotX + ox, slotY + oy, dw, dh);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 3;
        ctx.strokeRect(slotX + 1.5, slotY + 1.5, pw - 3, ph - 3);
        ctx.restore();
        loaded++;
        if (loaded === photos.length) drawAll();
      };
      img.src = src;
    });
  });
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

const LAYOUTS: Layout[] = [
  {
    id: '2-landscape', label: '2 Foto', sublabel: '2 landscape',
    photoCount: 2, previewW: 80, previewH: 54,
    slotAR: [560, 374],
    previewSlots: [{ x: 2, y: 4, w: 35, h: 46 }, { x: 43, y: 4, w: 35, h: 46 }],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 2, rows: 1, pw: 560, ph: 374, gap: PAD, ...bg }),
  },
  {
    id: '2-portrait', label: '2 Foto', sublabel: '2 portrait',
    photoCount: 2, previewW: 44, previewH: 88,
    slotAR: [PW, PH],
    previewSlots: [{ x: 3, y: 3, w: 38, h: 36 }, { x: 3, y: 48, w: 38, h: 36 }],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 1, rows: 2, pw: PW, ph: PH, gap: PAD, ...bg }),
  },
  {
    id: '3-portrait', label: '3 Foto', sublabel: '3 portrait',
    photoCount: 3, previewW: 44, previewH: 110,
    slotAR: [PW, PH],
    previewSlots: [{ x: 3, y: 3, w: 38, h: 28 }, { x: 3, y: 39, w: 38, h: 28 }, { x: 3, y: 75, w: 38, h: 28 }],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 1, rows: 3, pw: PW, ph: PH, gap: PAD, ...bg }),
  },
  {
    id: '3-horizontal', label: '3 Foto', sublabel: '3 horizontal',
    photoCount: 3, previewW: 88, previewH: 50,
    slotAR: [380, PH],
    previewSlots: [{ x: 2, y: 3, w: 24, h: 44 }, { x: 32, y: 3, w: 24, h: 44 }, { x: 62, y: 3, w: 24, h: 44 }],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 3, rows: 1, pw: 380, ph: PH, gap: PAD, ...bg }),
  },
  {
    id: '4-portrait', label: '4 Foto', sublabel: '4 strip',
    photoCount: 4, previewW: 44, previewH: 128,
    slotAR: [PW, PH],
    previewSlots: [
      { x: 3, y: 3, w: 38, h: 24 }, { x: 3, y: 34, w: 38, h: 24 },
      { x: 3, y: 65, w: 38, h: 24 }, { x: 3, y: 96, w: 38, h: 24 },
    ],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 1, rows: 4, pw: PW, ph: PH, gap: PAD, ...bg }),
  },
  {
    id: '4-2x2', label: '4 Foto', sublabel: '2 × 2 grid',
    photoCount: 4, previewW: 80, previewH: 80,
    slotAR: [560, 420],
    previewSlots: [
      { x: 3, y: 3, w: 33, h: 33 }, { x: 44, y: 3, w: 33, h: 33 },
      { x: 3, y: 44, w: 33, h: 33 }, { x: 44, y: 44, w: 33, h: 33 },
    ],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 2, rows: 2, pw: 560, ph: 420, gap: PAD, ...bg }),
  },
  {
    id: '6-2x3', label: '6 Foto', sublabel: '2 × 3 grid',
    photoCount: 6, previewW: 80, previewH: 110,
    slotAR: [560, 420],
    previewSlots: [
      { x: 3, y: 3, w: 33, h: 26 }, { x: 44, y: 3, w: 33, h: 26 },
      { x: 3, y: 37, w: 33, h: 26 }, { x: 44, y: 37, w: 33, h: 26 },
      { x: 3, y: 71, w: 33, h: 26 }, { x: 44, y: 71, w: 33, h: 26 },
    ],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 2, rows: 3, pw: 560, ph: 420, gap: 14, ...bg }),
  },
  {
    id: '9-3x3', label: '9 Foto', sublabel: '3 × 3 grid',
    photoCount: 9, previewW: 90, previewH: 90,
    slotAR: [380, 380],
    previewSlots: [
      { x: 2, y: 2, w: 24, h: 24 }, { x: 33, y: 2, w: 24, h: 24 }, { x: 64, y: 2, w: 24, h: 24 },
      { x: 2, y: 33, w: 24, h: 24 }, { x: 33, y: 33, w: 24, h: 24 }, { x: 64, y: 33, w: 24, h: 24 },
      { x: 2, y: 64, w: 24, h: 24 }, { x: 33, y: 64, w: 24, h: 24 }, { x: 64, y: 64, w: 24, h: 24 },
    ],
    compose: (p, c, bg) => composeStrip(p, c, { cols: 3, rows: 3, pw: 380, ph: 380, gap: 10, ...bg }),
  },
];

const FILTERS = [
  { id: 'normal', label: 'Normal', css: 'none' },
  { id: 'bw', label: 'B & W', css: 'grayscale(100%) contrast(120%)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(100%) contrast(110%)' },
  { id: 'high-contrast', label: 'Contrast', css: 'contrast(150%) saturate(120%)' },
];

const BG_COLORS = [
  { id: '#FFFFFF', label: 'Putih' },
  { id: '#0A0A0A', label: 'Hitam' },
  { id: '#FFE500', label: 'Kuning' },
  { id: '#FF3CAC', label: 'Pink' },
  { id: '#0047FF', label: 'Biru' },
];

const STICKERS = ['★', '♥', 'WOW', '!!!', 'X', 'O', ':)'];

// ─── SVG Layout Preview ───────────────────────────────────────────────────────

function LayoutSVG({ layout, active }: { layout: Layout; active: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${layout.previewW} ${layout.previewH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      <rect
        x="0" y="0" width={layout.previewW} height={layout.previewH}
        fill={active ? '#0A0A0A' : '#F2EFE7'}
        stroke="#0A0A0A" strokeWidth="1.5"
      />
      {layout.previewSlots.map((s, i) => (
        <rect
          key={i} x={s.x} y={s.y} width={s.w} height={s.h}
          fill={active ? '#FFE500' : '#D4D0C8'}
          stroke="#0A0A0A" strokeWidth="1"
        />
      ))}
    </svg>
  );
}

// ─── Layout Modal ─────────────────────────────────────────────────────────────

function LayoutModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-[#F2EFE7] border-[3px] border-[#0A0A0A] border-b-0 md:border-b-[3px] shadow-[0_-6px_0_#0A0A0A] md:shadow-[10px_10px_0_#0A0A0A] w-full md:w-[420px] max-h-[82dvh] md:max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-3.5 bg-[#0A0A0A] border-b-[3px] border-[#0A0A0A] sticky top-0 z-10">
          <span className="font-['Archivo_Black'] text-base md:text-lg text-[#FFE500] uppercase tracking-[0.04em]">
            Pilih Layout
          </span>
          <button
            className="bg-[#FFE500] border-2 border-[#FFE500] w-[34px] h-[34px] flex items-center justify-center cursor-pointer text-[#0A0A0A] hover:bg-[#FF3CAC] hover:text-white hover:border-[#FF3CAC] transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="h-2 bg-[repeating-linear-gradient(90deg,#0A0A0A_0,#0A0A0A_10px,#FF3CAC_10px,#FF3CAC_20px)]" />

        <div className="p-4 md:p-5">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 gap-2.5 md:gap-3">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                onClick={() => { onSelect(l.id); onClose(); }}
                className={[
                  'flex flex-col items-center gap-1.5 py-2.5 px-1.5 border-[3px] border-[#0A0A0A] cursor-pointer transition-all duration-100 shadow-[3px_3px_0_#0A0A0A]',
                  selected === l.id
                    ? 'bg-[#0A0A0A] -translate-x-0.5 -translate-y-0.5 shadow-[5px_5px_0_#FFE500]'
                    : 'bg-white hover:bg-[#FFE500] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0A0A0A]',
                ].join(' ')}
              >
                <div
                  className="w-full flex items-center justify-center"
                  style={{ aspectRatio: `${l.previewW}/${l.previewH}`, maxHeight: 70 }}
                >
                  <LayoutSVG layout={l} active={selected === l.id} />
                </div>
                <span className={[
                  "font-['Courier_Prime'] text-[8px] font-bold tracking-[0.12em] uppercase",
                  selected === l.id ? 'text-[#FFE500]' : 'text-[#0A0A0A]',
                ].join(' ')}>
                  {l.sublabel}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-0">
      <span className="font-['Archivo_Black'] text-[22px] md:text-[28px] leading-none text-[#0A0A0A] bg-[#FFE500] px-2.5 py-1 border-[3px] border-[#0A0A0A] shadow-[3px_3px_0_#0A0A0A] inline-block">
        NUL
      </span>
      <span className="hidden sm:inline-block font-['Courier_Prime'] text-[10px] sm:text-[11px] font-bold text-[#0A0A0A] tracking-[0.2em] uppercase ml-2.5 border-[3px] border-[#0A0A0A] px-1.5 sm:px-2 py-1 bg-white">
        photobooth
      </span>
    </div>
  );
}

// ─── Welcome Page ─────────────────────────────────────────────────────────────

function WelcomePage({ onStart }: { onStart: () => void }) {
  const tickerWords = ['PORTRAIT', 'STRIP', 'GRID', 'MOMENT', 'MEMORY', 'FILM', 'CAPTURE', 'FRAME'];
  const tickerItems = Array.from({ length: 4 }, () => tickerWords).flat();

  return (
    <div className="min-h-dvh bg-[#F2EFE7] grid grid-rows-[auto_1fr_auto] relative overflow-hidden">
      <div className="absolute -top-[60px] -right-[60px] w-[240px] h-[240px] md:w-[340px] md:h-[340px] bg-[#FFE500] border-[3px] border-[#0A0A0A] z-0 rotate-12" />
      <div className="absolute bottom-20 -left-10 w-[150px] h-[150px] md:w-[200px] md:h-[200px] bg-[#FF3CAC] border-[3px] border-[#0A0A0A] z-0 -rotate-[8deg]" />

      <header className="relative z-10 px-5 md:px-8 py-4 md:py-6 border-b-[3px] border-[#0A0A0A] bg-white flex items-center justify-between flex-wrap gap-2">
        <Logo />
        <div className="inline-flex items-center gap-[5px] bg-[#00C853] border-2 border-[#0A0A0A] px-2.5 py-1 md:px-3 md:py-1 font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold text-[#0A0A0A] tracking-[0.14em] uppercase">
          <span className="w-1.5 h-1.5 bg-[#0A0A0A] rounded-full animate-pulse flex-shrink-0" />
          ig : catranolanhkm
        </div>
      </header>

      <section className="relative z-[5] flex flex-col items-start justify-center px-6 md:px-12 pt-9 pb-12 md:py-[60px] gap-0 max-w-[700px]">
        <p className="font-['Courier_Prime'] text-[11px] md:text-[13px] font-bold tracking-[0.2em] uppercase bg-[#0047FF] text-white px-3 md:px-3.5 py-1 md:py-[5px] border-[3px] border-[#0A0A0A] mb-5 md:mb-7 inline-block">
          ★ instant moments ★
        </p>
        <h1 className="font-['Archivo_Black'] text-[clamp(52px,18vw,110px)] leading-[0.88] tracking-[-0.02em] text-[#0A0A0A] mb-6 md:mb-9">
          <span className="block">NUL</span>
          <span className="inline-block bg-[#FFE500] px-2 border-[3px] border-[#0A0A0A] -rotate-[1.5deg] my-1">PHOTO</span>
          <span className="block">
            <span className="inline-block bg-[#FF3CAC] text-white px-2 border-[3px] border-[#0A0A0A]">BOOTH</span>
          </span>
        </h1>
        <p className="text-[15px] md:text-[17px] leading-[1.6] text-[#0A0A0A] max-w-[400px] mb-9 md:mb-12 bg-white px-4 py-3.5 md:px-5 md:py-4 border-[3px] border-[#0A0A0A] shadow-[3px_3px_0_#0A0A0A] font-['Space_Grotesk']">
          Pilih layout, ambil foto, dan download strip-mu — semuanya langsung dari browser. Tanpa install. Tanpa ribet.
        </p>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-3 bg-[#0A0A0A] text-[#FFE500] border-[3px] border-[#0A0A0A] px-7 md:px-9 py-4 md:py-[18px] font-['Archivo_Black'] text-[15px] md:text-[17px] cursor-pointer tracking-[0.04em] uppercase shadow-[8px_8px_0_#0A0A0A] transition-all duration-100 min-h-[56px] hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[11px_11px_0_#0A0A0A] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[3px_3px_0_#0A0A0A]"
        >
          MULAI SESI
          <ArrowRight size={18} />
        </button>
      </section>

      <footer className="relative z-10 px-5 md:px-8 py-3 md:py-4 border-t-[3px] border-[#0A0A0A] bg-[#0A0A0A] flex items-center justify-between gap-3">
        <span className="font-['Courier_Prime'] text-[11px] text-[#FFE500] font-bold tracking-[0.1em] whitespace-nowrap">
          © 2026 NUL
        </span>
        <div className="overflow-hidden flex-1 min-w-0 border-2 border-[#FFE500]/30 py-1">
          <div className="flex animate-[ticker_14s_linear_infinite] whitespace-nowrap">
            {tickerItems.map((t, i) => (
              <span key={i} className="font-['Courier_Prime'] text-[10px] text-[#FFE500] tracking-[0.18em] uppercase font-bold px-3.5">
                ▶ {t}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function PhotoboothApp({ onBack }: { onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [sessionDone, setSessionDone] = useState(false);
  const [stripDataUrl, setStripDataUrl] = useState<string | null>(null);
  const [selectedLayout, setSelectedLayout] = useState('4-portrait');
  const [showModal, setShowModal] = useState(false);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [customText, setCustomText] = useState('');
  const [activeFilter, setActiveFilter] = useState('normal');
  const [generatingGIF, setGeneratingGIF] = useState(false);
  const [activeSticker, setActiveSticker] = useState<string | null>(null);
  const [stripStickers, setStripStickers] = useState<{ text: string, xRatio: number, yRatio: number }[]>([]);

  const currentLayout = LAYOUTS.find(l => l.id === selectedLayout)!;

  useEffect(() => {
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Browser tidak mendukung akses kamera.');
          return;
        }
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = ms;
        setStream(ms);
        if (videoRef.current) videoRef.current.srcObject = ms;
      } catch (err) {
        const error = err as DOMException;
        if (error.name === 'NotAllowedError') setCameraError('Akses kamera ditolak. Izinkan kamera di browser kamu.');
        else if (error.name === 'NotFoundError') setCameraError('Kamera tidak ditemukan di perangkat ini.');
        else setCameraError(`Error: ${error.message}`);
      }
    })();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 180);
    const v = videoRef.current, cv = canvasRef.current;
    const ctx = cv.getContext('2d')!;
    const W = v.videoWidth || 1280, H = v.videoHeight || 720;
    cv.width = W; cv.height = H;
    ctx.save();

    const filterObj = FILTERS.find(f => f.id === activeFilter);
    if (filterObj && filterObj.css !== 'none') {
      ctx.filter = filterObj.css;
    }

    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, W, H);
    ctx.restore();
    return cv.toDataURL('image/jpeg', 0.95);
  }, [activeFilter]);

  const startSession = async () => {
    setCapturing(true);
    setCapturedPhotos([]);
    setStripDataUrl(null);
    setCurrentPhotoIndex(0);
    setSessionDone(false);
    const photos: string[] = [];
    const count = currentLayout.photoCount;
    for (let i = 0; i < count; i++) {
      setCurrentPhotoIndex(i + 1);
      for (let s = timerSeconds; s > 0; s--) {
        setCountdown(s);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(0);
      const url = captureFrame();
      if (url) { photos.push(url); setCapturedPhotos([...photos]); }
      if (i < count - 1) await new Promise(r => setTimeout(r, 400));
    }
    setCapturing(false);
    setCurrentPhotoIndex(0);
    setStripStickers([]);
    if (photos.length > 0 && canvasRef.current) {
      const off = document.createElement('canvas');
      const strip = await currentLayout.compose(photos, off, { bgColor, customText, stickers: [] });
      setStripDataUrl(strip);
    }
    setSessionDone(true);
  };

  const downloadStrip = () => {
    if (!stripDataUrl) return;
    const b = atob(stripDataUrl.split(',')[1]);
    const ab = new ArrayBuffer(b.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < b.length; i++) ia[i] = b.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/jpeg' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nul-photobooth-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 200);
  };

  const downloadGIF = async () => {
    if (!capturedPhotos.length) return;
    setGeneratingGIF(true);
    try {
      const img = new Image();
      img.src = capturedPhotos[0];
      await new Promise(r => img.onload = r);

      const width = img.width;
      const height = img.height;
      const scale = Math.min(1, 400 / width);
      const gw = Math.floor(width * scale);
      const gh = Math.floor(height * scale);

      const gif = GIFEncoder();
      const canvas = document.createElement('canvas');
      canvas.width = gw;
      canvas.height = gh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      for (const src of capturedPhotos) {
        const frameImg = new Image();
        frameImg.src = src;
        await new Promise(r => frameImg.onload = r);

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, gw, gh);

        ctx.drawImage(frameImg, 0, 0, gw, gh);

        ctx.fillStyle = '#0A0A0A';
        ctx.font = '900 14px "Archivo Black", sans-serif';
        ctx.fillText('NUL', 10, 20);

        const imageData = ctx.getImageData(0, 0, gw, gh);
        const data = imageData.data;
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);

        gif.writeFrame(index, gw, gh, { palette, delay: 500 });
      }
      gif.finish();
      const buffer = gif.bytes();
      const blob = new Blob([buffer], { type: 'image/gif' });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nul-photobooth-anim-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 200);
    } catch (err) {
      console.error(err);
      alert('Gagal membuat GIF');
    }
    setGeneratingGIF(false);
  };

  const reset = () => {
    setCapturedPhotos([]);
    setStripDataUrl(null);
    setSessionDone(false);
    setCurrentPhotoIndex(0);
    setStripStickers([]);
  };

  const handleStripClick = async (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeSticker || !sessionDone) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const newStickers = [...stripStickers, { text: activeSticker, xRatio, yRatio }];
    setStripStickers(newStickers);

    if (canvasRef.current && capturedPhotos.length > 0) {
      const off = document.createElement('canvas');
      const strip = await currentLayout.compose(capturedPhotos, off, { bgColor, customText, stickers: newStickers });
      setStripDataUrl(strip);
    }
  };

  const retakePhoto = async (index: number) => {
    setCapturing(true);
    setSessionDone(false);
    setStripDataUrl(null);
    setCurrentPhotoIndex(index + 1);

    for (let s = timerSeconds; s > 0; s--) {
      setCountdown(s);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(0);

    const url = captureFrame();
    if (url) {
      const newPhotos = [...capturedPhotos];
      newPhotos[index] = url;
      setCapturedPhotos(newPhotos);

      if (canvasRef.current) {
        const off = document.createElement('canvas');
        const strip = await currentLayout.compose(newPhotos, off, { bgColor, customText, stickers: stripStickers });
        setStripDataUrl(strip);
      }
    }

    setCapturing(false);
    setCurrentPhotoIndex(0);
    setSessionDone(true);
  };

  return (
    <div className="min-h-dvh grid grid-rows-[auto_auto_1fr] bg-[#F2EFE7]">
      {showModal && (
        <LayoutModal
          selected={selectedLayout}
          onSelect={id => { setSelectedLayout(id); reset(); }}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="h-[10px] bg-[repeating-linear-gradient(90deg,#0A0A0A_0,#0A0A0A_16px,#FFE500_16px,#FFE500_32px)] border-t-2 border-b-2 border-[#0A0A0A]" />

      <header className="px-4 md:px-7 py-3 md:py-3.5 border-b-[3px] border-[#0A0A0A] bg-white flex items-center justify-between sticky top-0 z-50">
        <Logo />
        <button
          onClick={onBack}
          className="bg-white border-[3px] border-[#0A0A0A] px-3.5 py-1.5 cursor-pointer font-['Courier_Prime'] text-[11px] md:text-[12px] font-bold text-[#0A0A0A] tracking-[0.1em] uppercase shadow-[3px_3px_0_#0A0A0A] transition-all hover:bg-[#FFE500] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0A0A0A] min-h-[40px]"
        >
          ← KEMBALI
        </button>
      </header>

      <main className="w-full md:grid md:grid-cols-[1fr_288px] md:gap-6 md:items-start md:max-w-[1080px] md:mx-auto md:px-6 md:py-7">
        {/* Left col */}
        <div className="w-full">
          {cameraError ? (
            <div className="px-6 py-10 md:p-[60px] text-center flex flex-col items-center gap-4 bg-[#FF2B2B] border-t-[3px] border-b-[3px] md:border-[3px] border-[#0A0A0A]">
              <Aperture size={44} className="text-white" />
              <h2 className="font-['Archivo_Black'] text-[22px] text-white uppercase">KAMERA ERROR</h2>
              <p className="font-['Courier_Prime'] text-[14px] text-white max-w-[300px] leading-[1.6]">{cameraError}</p>
              <button
                onClick={() => window.location.reload()}
                className="max-w-[220px] flex items-center justify-center gap-2.5 bg-[#0A0A0A] text-[#FFE500] border-[3px] border-[#0A0A0A] px-3 py-4 font-['Archivo_Black'] text-[14px] cursor-pointer shadow-[5px_5px_0_#0A0A0A] uppercase tracking-[0.04em] hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-[8px_8px_0_#0A0A0A]"
              >
                MUAT ULANG
              </button>
            </div>
          ) : (
            <>
              {/* Camera panel */}
              <div className="bg-white border-t-[3px] border-b-[3px] md:border-[3px] border-[#0A0A0A] md:shadow-[5px_5px_0_#0A0A0A] overflow-hidden -mb-[3px] md:mb-0">
                <div className="px-4 py-2 border-b-[3px] border-[#0A0A0A] bg-[#0A0A0A] flex items-center gap-2">
                  <span className="font-['Courier_Prime'] text-[10px] font-bold tracking-[0.18em] uppercase text-[#FFE500]">
                    ▶ LIVE PREVIEW
                  </span>
                  {capturing && currentPhotoIndex > 0 && (
                    <span className="ml-auto bg-[#FF3CAC] border-2 border-[#0A0A0A] px-2.5 py-1 font-['Courier_Prime'] text-[9px] text-white font-bold tracking-[0.1em] uppercase">
                      FOTO {currentPhotoIndex}/{currentLayout.photoCount}
                    </span>
                  )}
                </div>
                <div className="max-w-[480px] mx-auto">
                  <div
                    className="relative w-full bg-[#111] overflow-hidden"
                    style={{ aspectRatio: `${currentLayout.slotAR[0]} / ${currentLayout.slotAR[1]}` }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                      style={{ filter: FILTERS.find(f => f.id === activeFilter)?.css }}
                    />
                    {countdown > 0 && (
                      <div className="absolute inset-0 bg-black/65 z-20 flex items-center justify-center">
                        <span className="font-['Archivo_Black'] text-[clamp(72px,20vw,120px)] text-[#FFE500] leading-none tracking-[-0.04em] [text-shadow:6px_6px_0_#0A0A0A]">
                          {countdown}
                        </span>
                      </div>
                    )}
                    {showFlash && <div className="absolute inset-0 bg-white z-30 pointer-events-none" />}
                    <span className="absolute bottom-2.5 left-2.5 z-[15] bg-[#FFE500] border-2 border-[#0A0A0A] px-2.5 py-[3px] font-['Courier_Prime'] text-[9px] text-[#0A0A0A] font-bold tracking-[0.14em] uppercase">
                      NUL PHOTOBOOTH
                    </span>
                  </div>
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Strip result */}
              {stripDataUrl && (
                <div className="bg-white border-t-[3px] border-b-[3px] md:border-[3px] border-[#0A0A0A] md:shadow-[5px_5px_0_#0A0A0A] overflow-hidden mt-0 md:mt-5">
                  <div className="px-4 py-2 border-b-[3px] border-[#0A0A0A] bg-[#0A0A0A]">
                    <span className="font-['Courier_Prime'] text-[10px] font-bold tracking-[0.18em] uppercase text-[#FFE500]">★ HASIL STRIP</span>
                  </div>
                  <div className="p-3 md:p-4">
                    <img
                      src={stripDataUrl}
                      alt="Photo Strip"
                      className={`w-full block border-[3px] border-[#0A0A0A] ${activeSticker ? 'cursor-crosshair' : ''}`}
                      onClick={handleStripClick}
                    />
                  </div>
                </div>
              )}

              {/* Photos in-progress grid */}
              {capturedPhotos.length > 0 && (
                <div className="bg-white border-t-[3px] border-b-[3px] md:border-[3px] border-[#0A0A0A] md:shadow-[5px_5px_0_#0A0A0A] overflow-hidden mt-0 md:mt-5">
                  <div className="px-4 py-2 border-b-[3px] border-[#0A0A0A] bg-[#0A0A0A]">
                    <span className="font-['Courier_Prime'] text-[10px] font-bold tracking-[0.18em] uppercase text-[#FFE500]">
                      FOTO ({capturedPhotos.length}/{currentLayout.photoCount})
                    </span>
                  </div>
                  <div
                    className="p-3 md:p-3.5 grid gap-2 md:gap-2.5"
                    style={{ gridTemplateColumns: `repeat(${Math.min(capturedPhotos.length, 4)}, 1fr)` }}
                  >
                    {capturedPhotos.map((p, i) => (
                      <div key={i} className="overflow-hidden border-[3px] border-[#0A0A0A] relative group">
                        <img src={p} alt={`Foto ${i + 1}`} className="w-full aspect-[3/4] object-cover block" />
                        <div className={`absolute bottom-0 left-0 right-0 p-1 bg-[#0A0A0A] flex items-center ${sessionDone && !capturing ? 'justify-between pl-2' : 'justify-center'}`}>
                          <span className="font-['Courier_Prime'] text-[9px] font-bold text-[#FFE500] tracking-[0.1em]">
                            #{i + 1}
                          </span>
                          {sessionDone && !capturing && (
                            <button
                              onClick={() => retakePhoto(i)}
                              className="bg-white text-[#0A0A0A] p-1 border-2 border-[#0A0A0A] cursor-pointer hover:bg-[#FFE500] transition-colors flex items-center justify-center"
                              title="Retake foto ini"
                            >
                              <RefreshCw size={10} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right col */}
        <div className="flex flex-row overflow-x-auto overflow-y-visible border-t-[3px] border-[#0A0A0A] bg-[#F2EFE7] scrollbar-none md:flex-col md:gap-[18px] md:overflow-visible md:bg-transparent md:border-t-0">

          {/* Layout section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[160px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ■ LAYOUT
            </div>
            <div className="p-2.5 md:p-3">
              <button
                onClick={() => setShowModal(true)}
                disabled={capturing}
                className="w-full flex items-center gap-2.5 bg-[#FFE500] border-[3px] border-[#0A0A0A] px-3 py-2.5 cursor-pointer shadow-[3px_3px_0_#0A0A0A] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#0A0A0A] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0_#0A0A0A]"
              >
                <div className="w-9 h-11 flex-shrink-0">
                  <LayoutSVG layout={currentLayout} active={true} />
                </div>
                <div className="text-left flex-1">
                  <div className="font-['Archivo_Black'] text-[13px] text-[#0A0A0A]">{currentLayout.label}</div>
                  <div className="font-['Courier_Prime'] text-[9px] font-bold text-[#0A0A0A] tracking-[0.08em] uppercase mt-0.5 opacity-65">{currentLayout.sublabel}</div>
                </div>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Timer section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[210px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ◉ TIMER
            </div>
            <div className="px-3.5 py-2.5">
              <span className="block font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase text-[#0A0A0A] mb-2">
                Jeda Timer
              </span>
              <div className="flex gap-1.5">
                {[0, 3, 5, 10].map(s => (
                  <button
                    key={s}
                    onClick={() => setTimerSeconds(s)}
                    disabled={capturing}
                    className={[
                      "flex-1 py-2.5 font-['Courier_Prime'] text-[13px] font-bold border-[3px] border-[#0A0A0A] cursor-pointer transition-all duration-100 tracking-[0.04em] min-h-[44px]",
                      timerSeconds === s
                        ? 'bg-[#0047FF] text-white -translate-x-0.5 -translate-y-0.5 shadow-[5px_5px_0_#0A0A0A]'
                        : 'bg-white text-[#0A0A0A] shadow-[3px_3px_0_#0A0A0A] hover:bg-[#FFE500] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#0A0A0A]',
                    ].join(' ')}
                  >
                    {s === 0 ? '—' : `${s}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Text section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[180px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ✎ TEKS
            </div>
            <div className="px-3.5 py-2.5">
              <span className="block font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase text-[#0A0A0A] mb-2">
                Watermark
              </span>
              <input
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                maxLength={20}
                placeholder="NUL PHOTOBOOTH"
                disabled={capturing}
                className="w-full bg-[#F2EFE7] border-[3px] border-[#0A0A0A] px-2 py-2 font-['Archivo_Black'] text-[11px] uppercase outline-none focus:border-[#FF3CAC] focus:bg-white transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          {/* Color section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[160px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ■ WARNA
            </div>
            <div className="px-3.5 py-2.5">
              <span className="block font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase text-[#0A0A0A] mb-2">
                Background
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {BG_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setBgColor(c.id)}
                    disabled={capturing}
                    className={[
                      "w-7 h-7 border-[3px] border-[#0A0A0A] cursor-pointer transition-all duration-100",
                      bgColor === c.id
                        ? '-translate-x-0.5 -translate-y-0.5 shadow-[3px_3px_0_#0A0A0A]'
                        : 'shadow-[1px_1px_0_#0A0A0A] hover:-translate-x-px hover:-translate-y-px hover:shadow-[2px_2px_0_#0A0A0A]',
                    ].join(' ')}
                    style={{ backgroundColor: c.id }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Filter section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[180px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ★ FILTER
            </div>
            <div className="px-3.5 py-2.5">
              <span className="block font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase text-[#0A0A0A] mb-2">
                Efek Kamera
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    disabled={capturing}
                    className={[
                      "py-1.5 font-['Courier_Prime'] text-[9px] font-bold border-[3px] border-[#0A0A0A] cursor-pointer transition-all duration-100 tracking-[0.04em]",
                      activeFilter === f.id
                        ? 'bg-[#00C853] text-[#0A0A0A] -translate-x-0.5 -translate-y-0.5 shadow-[3px_3px_0_#0A0A0A]'
                        : 'bg-white text-[#0A0A0A] shadow-[2px_2px_0_#0A0A0A] hover:bg-[#FFE500] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_#0A0A0A]',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sticker section */}
          <div className="flex-shrink-0 border-r-[3px] border-[#0A0A0A] bg-white last:border-r-0 md:flex-shrink-[unset] md:border-r-0 min-w-[180px]">
            <div className="px-2.5 py-1.5 border-b-2 border-[#0A0A0A] bg-[#0A0A0A] font-['Courier_Prime'] text-[8px] font-bold tracking-[0.18em] uppercase text-[#FFE500] whitespace-nowrap md:hidden">
              ☻ STIKER
            </div>
            <div className="px-3.5 py-2.5">
              <span className="block font-['Courier_Prime'] text-[9px] md:text-[10px] font-bold tracking-[0.18em] uppercase text-[#0A0A0A] mb-2">
                Pilih & Klik di Strip
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {STICKERS.map(s => (
                  <button
                    key={s}
                    onClick={() => setActiveSticker(activeSticker === s ? null : s)}
                    disabled={capturing || !sessionDone}
                    className={[
                      "w-8 h-8 font-['Archivo_Black'] text-[12px] border-[3px] border-[#0A0A0A] cursor-pointer transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed",
                      activeSticker === s
                        ? 'bg-[#FF3CAC] text-white -translate-x-0.5 -translate-y-0.5 shadow-[3px_3px_0_#0A0A0A]'
                        : 'bg-white text-[#0A0A0A] shadow-[1px_1px_0_#0A0A0A] hover:enabled:-translate-x-px hover:enabled:-translate-y-px hover:enabled:shadow-[2px_2px_0_#0A0A0A]',
                    ].join(' ')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop action panel */}
          <div className="hidden md:block">
            <div className="bg-white border-[3px] border-[#0A0A0A] shadow-[5px_5px_0_#0A0A0A]">
              <div className="p-4">
                {!sessionDone ? (
                  <button
                    onClick={startSession}
                    disabled={capturing || !stream}
                    className="w-full flex items-center justify-center gap-3 bg-[#0A0A0A] text-[#FFE500] border-[3px] border-[#0A0A0A] py-5 font-['Archivo_Black'] text-[16px] cursor-pointer uppercase tracking-[0.04em] shadow-[5px_5px_0_#0A0A0A] transition-all hover:enabled:-translate-x-[3px] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[8px_8px_0_#0A0A0A] hover:enabled:bg-[#0047FF] active:enabled:translate-x-0.5 active:enabled:translate-y-0.5 active:enabled:shadow-[3px_3px_0_#0A0A0A] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Camera size={20} />
                    {capturing
                      ? `MENGAMBIL ${currentPhotoIndex}/${currentLayout.photoCount}…`
                      : !stream ? 'MEMUAT KAMERA…' : 'AMBIL FOTO'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={downloadStrip}
                      disabled={!stripDataUrl}
                      className="w-full flex items-center justify-center gap-3 bg-[#00C853] text-[#0A0A0A] border-[3px] border-[#0A0A0A] py-[18px] font-['Archivo_Black'] text-[15px] cursor-pointer uppercase tracking-[0.04em] shadow-[5px_5px_0_#0A0A0A] transition-all hover:enabled:-translate-x-[3px] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[8px_8px_0_#0A0A0A] active:enabled:translate-x-0.5 active:enabled:translate-y-0.5 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <Download size={18} /> DOWNLOAD STRIP
                    </button>
                    <button
                      onClick={downloadGIF}
                      disabled={generatingGIF || capturedPhotos.length === 0}
                      className="w-full flex items-center justify-center gap-3 bg-[#FFE500] text-[#0A0A0A] border-[3px] border-[#0A0A0A] py-3.5 font-['Archivo_Black'] text-[14px] cursor-pointer uppercase tracking-[0.04em] shadow-[3px_3px_0_#0A0A0A] transition-all hover:enabled:bg-[#FF3CAC] hover:enabled:text-white hover:enabled:-translate-x-0.5 hover:enabled:-translate-y-0.5 hover:enabled:shadow-[5px_5px_0_#0A0A0A] disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {generatingGIF ? 'MEMBUAT GIF...' : 'DOWNLOAD GIF'}
                    </button>
                    <button
                      onClick={reset}
                      className="w-full flex items-center justify-center gap-2.5 bg-white text-[#0A0A0A] border-[3px] border-[#0A0A0A] py-3.5 font-['Archivo_Black'] text-[14px] cursor-pointer uppercase tracking-[0.04em] shadow-[3px_3px_0_#0A0A0A] transition-all hover:bg-[#0A0A0A] hover:text-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0A0A0A]"
                    >
                      <RefreshCw size={15} /> AMBIL ULANG
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="font-['Courier_Prime'] text-[10px] font-bold text-[#0A0A0A] text-center tracking-[0.12em] uppercase py-1.5 border-[3px] border-[#0A0A0A] bg-[#FFE500]">
              © 2026 NUL PHOTOBOOTH
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky bottom action bar */}
      <div className="md:hidden sticky bottom-0 z-40 bg-white border-t-[3px] border-[#0A0A0A] px-4 py-3 flex gap-2.5">
        {!sessionDone ? (
          <button
            onClick={startSession}
            disabled={capturing || !stream}
            className="flex-1 flex items-center justify-center gap-2.5 bg-[#0A0A0A] text-[#FFE500] border-[3px] border-[#0A0A0A] py-4 font-['Archivo_Black'] text-[14px] cursor-pointer uppercase tracking-[0.04em] shadow-[5px_5px_0_#0A0A0A] min-h-[52px] transition-all hover:enabled:-translate-x-[3px] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[8px_8px_0_#0A0A0A] hover:enabled:bg-[#0047FF] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Camera size={18} />
            {capturing
              ? `${currentPhotoIndex}/${currentLayout.photoCount}…`
              : !stream ? 'MEMUAT…' : 'AMBIL FOTO'}
          </button>
        ) : (
          <>
            <button
              onClick={downloadStrip}
              disabled={!stripDataUrl}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00C853] text-[#0A0A0A] border-[3px] border-[#0A0A0A] py-4 font-['Archivo_Black'] text-[13px] cursor-pointer uppercase tracking-[0.04em] shadow-[5px_5px_0_#0A0A0A] min-h-[52px] transition-all hover:enabled:-translate-x-[3px] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[8px_8px_0_#0A0A0A] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Download size={16} /> JPG
            </button>
            <button
              onClick={downloadGIF}
              disabled={generatingGIF || capturedPhotos.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#FFE500] text-[#0A0A0A] border-[3px] border-[#0A0A0A] py-4 font-['Archivo_Black'] text-[13px] cursor-pointer uppercase tracking-[0.04em] shadow-[5px_5px_0_#0A0A0A] min-h-[52px] transition-all hover:enabled:-translate-x-[3px] hover:enabled:-translate-y-[3px] hover:enabled:shadow-[8px_8px_0_#0A0A0A] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
            >
              GIF
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center bg-white text-[#0A0A0A] border-[3px] border-[#0A0A0A] w-[52px] flex-shrink-0 shadow-[3px_3px_0_#0A0A0A] min-h-[52px] transition-all hover:bg-[#0A0A0A] hover:text-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0A0A0A]"
              title="Ambil Ulang"
            >
              <RefreshCw size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function NulPhotobooth() {
  const [page, setPage] = useState<'welcome' | 'app'>('welcome');

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Archivo+Black&family=Courier+Prime:wght@400;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { scrollbar-width: none; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);

  if (page === 'welcome') return <WelcomePage onStart={() => setPage('app')} />;
  return <PhotoboothApp onBack={() => setPage('welcome')} />;
}