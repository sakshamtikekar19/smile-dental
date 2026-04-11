import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, CheckCircle2, Info, RefreshCw } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

// ── Fixed braces pipeline (replaces old multi-file braces system) ──
import { applyBracesOverlayFixed } from "../utils/bracesOverlayFixed";

// ── Whitening helpers (unchanged) ──
import { TEETH_WHITEN_MASK_INDICES } from "../utils/teethWhitenMaskIndices";
import { getTightenedWhiteningMaskPoints } from "../utils/teethWhitenMaskPath";

const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

function WhiteningIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="medicalWhite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#bae6fd" />
        </linearGradient>
      </defs>
      {/* Sparkles / Medical Cross */}
      <path d="M48 10v10M43 15h10" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 18v6M9 21h6" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Precise Tooth */}
      <path
        d="M28 8c6 0 10 4 11 10 1 8 0 18-2 24-2 6-6 14-11 14s-9-8-11-14c-2-6-3-16-2-24 1-6 5-10 11-10z"
        fill="url(#medicalWhite)"
        stroke="#0284c7"
        strokeWidth="2.5"
      />
      {/* Sleek reflection */}
      <path d="M22 14c2-2 6-2 10 0" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function AlignmentIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="alignTooth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="silverLevel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="35%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="65%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <rect x="26.5" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <rect x="43" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <line x1="6" y1="29" x2="58" y2="29" stroke="url(#silverLevel)" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="6" y1="29" x2="58" y2="29" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function BracesIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="bracketChrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="38%" stopColor="#cbd5e1" />
          <stop offset="70%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="44" height="44" rx="14" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="19" y="19" width="26" height="26" rx="6.5" fill="url(#bracketChrome)" stroke="#64748b" strokeWidth="2" />
      <path d="M24 32h16M32 24v16" stroke="#334155" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M8 34c12-7 36-7 48 0" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 22h22" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.3" />
    </svg>
  );
}

function FullSmileIcon() {
  const cx = [12, 18, 24, 30, 36, 42, 48, 54];
  const teeth = cx.map((c, i) => (
    <g key={i}>
      <ellipse cx={c} cy="38" rx="4.5" ry="10.5" fill="#fafafa" stroke="#d4d4d8" strokeWidth="1.1" />
      <ellipse cx={c - 1} cy="32" rx="1.4" ry="2.3" fill="#ffffff" opacity="0.55" />
    </g>
  ));
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="fullSmileShimmer" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="35%" stopColor="#fef9c3" stopOpacity="1" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="65%" stopColor="#fef9c3" stopOpacity="1" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0.85" />
        </linearGradient>
        <filter id="archGlowFs" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M7 42c11 9 39 9 50 0" fill="none" stroke="#e4e4e7" strokeWidth="1.5" />
      <path d="M8 40 Q32 26 56 40" fill="rgba(250,250,250,0.5)" stroke="#d4d4d8" strokeWidth="1" />
      {teeth}
      <line x1="10" y1="38" x2="54" y2="38" stroke="url(#fullSmileShimmer)" strokeWidth="2.8" strokeLinecap="round" filter="url(#archGlowFs)" />
    </svg>
  );
}

const TREATMENTS = [
  { id: "whitening",      label: "Whitening",   icon: WhiteningIcon,   desc: "Blue-white enamel sheen enhancement." },
  { id: "alignment",      label: "Alignment",   icon: AlignmentIcon,   desc: "Gap closure and crooked-tooth rectification preview." },
  { id: "braces",         label: "Braces",      icon: BracesIcon,      desc: "Precision metallic bracket preview." },
  { id: "transformation", label: "Full Smile",  icon: FullSmileIcon,   desc: "Hollywood-style mirrored arch reconstruction." },
];

const TREATMENT_THEME = {
  whitening: {
    glow: "0 0 28px rgba(34,211,238,0.55)",
    ring: "rgba(34,211,238,0.9)",
    tint: "from-cyan-300/20 to-cyan-500/25",
    benefit: "Clinically tuned ivory brightening for enamel-safe simulation.",
  },
  alignment: {
    glow: "0 0 28px rgba(129,140,248,0.52)",
    ring: "rgba(129,140,248,0.9)",
    tint: "from-indigo-300/20 to-indigo-500/25",
    benefit: "Predictive tooth-axis balancing for symmetry-forward smile design.",
  },
  braces: {
    glow: "0 0 28px rgba(203,213,225,0.58)",
    ring: "rgba(226,232,240,0.92)",
    tint: "from-slate-200/20 to-slate-400/25",
    benefit: "Precision metallic alignment simulation from molar to molar.",
  },
  transformation: {
    glow: "0 0 28px rgba(250,204,21,0.5)",
    ring: "rgba(250,204,21,0.9)",
    tint: "from-amber-300/20 to-yellow-500/25",
    benefit: "Comprehensive whitening plus alignment in one premium preview.",
  },
};

function TreatmentDockButton({ treatment, active, disabled, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [mag, setMag] = useState({ x: 0, y: 0 });
  const Icon = treatment.icon;
  const theme = TREATMENT_THEME[treatment.id] ?? TREATMENT_THEME.whitening;

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist <= 40) {
      setMag({ x: (dx / 40) * 8, y: (dy / 40) * 8 });
    } else {
      setMag({ x: 0, y: 0 });
    }
  };

  const resetMag = () => setMag({ x: 0, y: 0 });

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        resetMag();
      }}
      disabled={disabled}
      className="relative h-[74px] w-[74px] rounded-full border border-white/10 bg-white/5 backdrop-blur-xl"
      style={{ borderColor: active ? theme.ring : "rgba(255,255,255,0.1)" }}
      animate={{
        x: mag.x,
        y: mag.y,
        scale: active ? [1, 1.05, 1] : 1,
        boxShadow: active ? theme.glow : "0 0 0 rgba(0,0,0,0)",
      }}
      whileHover={{
        scale: 1.15,
        boxShadow: theme.glow,
      }}
      transition={{
        scale: { duration: 1.8, repeat: active ? Infinity : 0, ease: "easeInOut" },
        x: { type: "spring", stiffness: 220, damping: 14 },
        y: { type: "spring", stiffness: 220, damping: 14 },
      }}
      aria-label={treatment.label}
    >
      <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br", theme.tint)} />
      <span className="relative z-10 flex h-full w-full items-center justify-center">
        <Icon />
      </span>
      {active && (
        <motion.span
          className="absolute -bottom-2 left-1/2 h-[3px] w-9 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: theme.ring, boxShadow: theme.glow }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <AnimatePresence>
        {hovered && !disabled && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="pointer-events-none absolute -top-24 left-1/2 z-20 w-64 -translate-x-1/2 rounded-2xl border border-white/15 bg-black/45 p-3 text-left shadow-2xl backdrop-blur-xl"
          >
            <p style={{ fontFamily: "'Playfair Display', serif" }} className="text-sm text-zinc-100">
              {treatment.label}
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="mt-1 text-xs text-zinc-300">
              {treatment.desc || theme.benefit}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

const MOUTH_PERIMETER_INDICES   = [61, 291, 17, 13, 14, 78, 308, 181];
const MOUTH_FALLBACK_INDICES    = [61, 291, 13, 14, 78, 308];
const EYE_SANITY_INDICES        = [33, 133, 362, 263];
const OVAL_FEATHER_PX           = 16;
const MASK_CLIP_FEATHER_PX      = 5;
const GUM_CLEARANCE_PX          = 5;
const LOWER_GUM_CLEARANCE_PX    = 8;
const INTERDENTAL_SHADOW_LUM_MAX = 45;
const WHITEN_MASK_LIP_INSET_PX  = 5;
const WHITEN_MASK_LIP_INSET_CORNER_PX = 6;
const LIP_GUM_LANDMARK_GUARD_PX = 5;
const ENAMEL_LUM_MIN  = 15;
const ENAMEL_LUM_MAX  = 252;
const ENAMEL_SAT_MAX  = 0.58;
/** Enamel-only whitening: linear luminance must exceed this (0–1) inside teeth hull. */
const WHITEN_LUMINANCE_GATE = 0.15; // lowered aggressively so shadowed back teeth get whitened
/** Extra shrink of teeth hull for whitening clip + composite (lips/gums stay untouched). */
const WHITEN_HULL_EXTRA_INSET_PX = 3;
/** Additional inset for Full Smile: infill/warp only inside this stricter enamel core (anti lip/gum bleed). */
const ALIGN_STRICT_ENAMEL_INSET_PX = 6;
/** Min distance (px) from lip / mouth rim landmarks — pixels closer never get whitening adjustments. */
const WHITEN_LIP_CLEARANCE_MIN_PX = 10;
const WHITEN_LIP_CLEARANCE_SCALE = 0.018;
const LIP_COLOR_GUARD_INDICES = [
  ...new Set([
    ...MOUTH_PERIMETER_INDICES,
    12, 15, 16, 17, 78, 308, 312, 314, 315, 316, 317, 318, 324, 402, 415, 310,
  ]),
];
/** Max longest edge for Replicate inpainting input (smaller = faster API, ~512 is a good speed/quality balance). */
const API_MOUTH_MAX_EDGE        = 512;
const NOSE_MIDLINE_IDX          = 4;
const CHIN_MIDLINE_IDX          = 152;
const COMMISSURE_LEFT_IDX       = 61;
const COMMISSURE_RIGHT_IDX      = 291;
const ENAMEL_SPECULAR_INDICES   = [82, 81, 311];
const MOUTH_FIRST_INDICES       = [0, 13, 14, 17, 37, 267];
const MINIMAL_MOUTH_HULL_INDICES = [78, 308, 13, 14, 61, 291, 17];
const MOUTH_GUIDE_OVAL_NORM     = { cx: 0.5, cy: 0.56, rx: 0.24, ry: 0.144 };
const FACE_LANDMARKER_INIT_TIMEOUT_MS = 22_000;
const FACE_MESH_INIT_TIMEOUT_MS      = 22_000;
/** Background AI polish only (preview shows first); keep bounded so UI does not hang forever. */
const AI_SMILE_FETCH_TIMEOUT_MS      = 75_000;

let faceLandmarkerInstance;
let faceLandmarkerLoadFailed = false;

const initFaceLandmarker = async () => {
  if (faceLandmarkerLoadFailed) return null;
  if (faceLandmarkerInstance) return faceLandmarkerInstance;
  try {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );
    faceLandmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
      minFaceDetectionConfidence: 0.2,
      minFacePresenceConfidence: 0.2,
    });
    return faceLandmarkerInstance;
  } catch {
    faceLandmarkerLoadFailed = true;
    return null;
  }
};

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("upload");
  const [selectedTreatment, setSelectedTreatment] = useState("whitening");
  const [activeTreatment, setActiveTreatment] = useState("whitening");
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [processingLog, setProcessingLog] = useState("");

  const fileInputRef = useRef(null);
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  /** Phase 6: Singleton Engine Canvas to prevent Buffer Fragmentation */
  const engineCanvasRef = useRef(null);
  const engineCanvasSecondaryRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Invalidates in-flight background AI polish when user starts a new run. */
  const pipelineGenerationRef = useRef(0);

  // ── Utilities ──────────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        resolve(img);
        // Hint browser to free URL reference if it was a blob
        if (typeof src === "string" && src.startsWith("blob:")) {
          // We don't revoke here because other functions might need the image object
          // but we can at least help GC with the string.
        }
      };
      img.onerror = () => reject(new Error("Image Load Failed"));
      img.src = src;
    });
  };
  const loadBitmap = async (src, maxWidth = 720) => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      
      if (window.createImageBitmap) {
        // Get dimensions without full RGB decode (still some cost, but better than full decode)
        const meta = await loadImage(src);
        const { width: w, height: h } = meta;
        const scale = Math.min(1, maxWidth / Math.max(w, h, 1));
        const nw = Math.round(w * scale), nh = Math.round(h * scale);
        
        try {
          const bitmap = await window.createImageBitmap(blob, {
            resizeWidth: nw,
            resizeHeight: nh,
            resizeQuality: "low"
          });
          return bitmap;
        } catch (e) {
          return await loadImage(src);
        }
      }
      return await loadImage(src);
    } catch {
      return await loadImage(src);
    }
  };

  const normalizeImage = async (imageSrc, maxWidth = 512) => {
    // Phase 6: Logic for singleton canvas
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    
    setProcessingLog("Decoding hardware pixels...");
    const img = await loadBitmap(imageSrc, maxWidth);
    const width = img.width, height = img.height;
    
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    
    if (img.close) img.close();
    
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, "image/jpeg", 0.9);
    });
  };

  const yieldMainThread = () => new Promise(resolve => setTimeout(resolve, 10)); // Increased yield for GC

  const safeRevoke = (url) => {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  // ── Mouth detection ─────────────────────────────────────────────────
  const buildMouthAnalysis = (landmarks, iw, ih, indices) => {
    for (const i of indices) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    indices.forEach(i => {
      const p = landmarks[i];
      const x = p.x * iw, y = p.y * ih;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });
    if (!(maxX > minX && maxY > minY)) return null;
    const padX = (maxX - minX) * 0.14 + 6;
    const padY = (maxY - minY) * 0.18 + 8;
    let x = clamp(Math.floor(minX - padX), 0, iw - 1);
    let y = clamp(Math.floor(minY - padY), 0, ih - 1);
    let width  = clamp(Math.ceil(maxX - minX + padX * 2), 24, iw - x);
    let height = clamp(Math.ceil(maxY - minY + padY * 2), 24, ih - y);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const rx = Math.max((maxX - minX) / 2 * 1.08, 12);
    const ry = Math.max((maxY - minY) / 2 * 1.12, 10);
    const mouthWidthNorm = Math.abs(landmarks[291].x - landmarks[61].x);
    const mouthCenterY   = (landmarks[13].y + landmarks[14].y) / 2;
    const lipSep         = Math.abs(landmarks[14].y - landmarks[13].y);
    const eyeYs  = EYE_SANITY_INDICES.map(ei => landmarks[ei]?.y).filter(v => typeof v === "number");
    const avgEyeY = eyeYs.length ? eyeYs.reduce((a, b) => a + b, 0) / eyeYs.length : 0.35;
    let eyeFactor = 1;
    if (avgEyeY >= mouthCenterY + 0.04) eyeFactor = 0.45;
    else if (avgEyeY >= mouthCenterY - 0.005) eyeFactor = 0.88;
    const wScore = mouthWidthNorm > 0.08 && mouthWidthNorm < 0.58 ? 1 : Math.max(0.15, 1 - Math.abs(mouthWidthNorm - 0.28) * 4);
    const yScore = mouthCenterY > 0.3 && mouthCenterY < 0.94 ? 1 : 0.45;
    const hScore = lipSep > 0.002 ? 1 : 0.78;
    const posScore = cy / ih > 0.3 && cy / ih < 0.92 ? 1 : 0.5;
    const confidence = clamp((0.32*wScore + 0.28*yScore + 0.22*hScore + 0.18*posScore) * eyeFactor, 0, 1);
    return { confidence, bounds: { x, y, width, height }, oval: { cx, cy, rx, ry } };
  };

  const analyzeMouthFromLandmarks = (landmarks, iw, ih) =>
    buildMouthAnalysis(landmarks, iw, ih, MOUTH_PERIMETER_INDICES) ||
    buildMouthAnalysis(landmarks, iw, ih, MOUTH_FALLBACK_INDICES);

  const buildAnalysisFromMinimalMouthHull = (landmarks, iw, ih) => {
    for (const i of MINIMAL_MOUTH_HULL_INDICES) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    MINIMAL_MOUTH_HULL_INDICES.forEach(i => {
      const p = landmarks[i];
      const x = p.x * iw, y = p.y * ih;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });
    if (!(maxX > minX && maxY > minY)) return null;
    const padX = (maxX - minX) * 0.2 + 8;
    const padY = (maxY - minY) * 0.24 + 10;
    let x = clamp(Math.floor(minX - padX), 0, iw - 1);
    let y = clamp(Math.floor(minY - padY), 0, ih - 1);
    let width  = clamp(Math.ceil(maxX - minX + padX * 2), 24, iw - x);
    let height = clamp(Math.ceil(maxY - minY + padY * 2), 24, ih - y);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const rx = Math.max((maxX - minX) / 2 * 1.1, 12);
    const ry = Math.max((maxY - minY) / 2 * 1.15, 10);
    return { confidence: 0.42, bounds: { x, y, width, height }, oval: { cx, cy, rx, ry } };
  };

  const heuristicMouthRegion = (iw, ih) => {
    const cx = iw * 0.5, cy = ih * 0.63;
    const rx = Math.max(iw * 0.19, 14), ry = Math.max(ih * 0.1, 10);
    const width  = clamp(Math.ceil(rx * 2.45), 48, iw);
    const height = clamp(Math.ceil(ry * 2.35), 40, ih);
    const x = clamp(Math.floor(cx - width / 2), 0, iw - width);
    const y = clamp(Math.floor(cy - height / 2), Math.floor(ih * 0.45), Math.max(0, ih - height));
    return { confidence: 0.35, bounds: { x, y, width, height }, oval: { cx, cy, rx, ry } };
  };

  const boostMouthGuideRegion = (ctx, iw, ih) => {
    const o = MOUTH_GUIDE_OVAL_NORM;
    const px = o.cx * iw, py = o.cy * ih, prx = o.rx * iw, pry = o.ry * ih, pad = 1.1;
    const x0 = clamp(Math.floor(px - prx * pad), 0, iw - 1);
    const y0 = clamp(Math.floor(py - pry * pad), 0, ih - 1);
    const x1 = clamp(Math.ceil(px + prx * pad),  0, iw);
    const y1 = clamp(Math.ceil(py + pry * pad),  0, ih);
    const rw = x1 - x0, rh = y1 - y0;
    if (rw < 8 || rh < 8) return;
    const imageData = ctx.getImageData(x0, y0, rw, rh);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i+1], b = d[i+2];
      r = (r - 128) * 1.1 + 128 + 18;
      g = (g - 128) * 1.1 + 128 + 18;
      b = (b - 128) * 1.1 + 128 + 18;
      d[i]   = clamp(Math.round(r), 0, 255);
      d[i+1] = clamp(Math.round(g), 0, 255);
      d[i+2] = clamp(Math.round(b), 0, 255);
    }
    ctx.putImageData(imageData, x0, y0);
  };

  const tryFaceLandmarker = async (canvas) => {
    const landmarker = await Promise.race([
      initFaceLandmarker(),
      new Promise(r => setTimeout(() => r(null), FACE_LANDMARKER_INIT_TIMEOUT_MS)),
    ]);
    if (!landmarker) return null;
    let result;
    try { result = landmarker.detect(canvas); } catch { return null; }
    const faceLm = result?.faceLandmarks?.[0];
    if (!faceLm || faceLm.length < 50) return null;
    const analysis = analyzeMouthFromLandmarks(faceLm, canvas.width, canvas.height) ||
                     buildAnalysisFromMinimalMouthHull(faceLm, canvas.width, canvas.height);
    if (!analysis) return null;
    return { ...analysis, landmarks: faceLm };
  };

  const detectMouth = async (imageSrc) => {
    setProcessingLog("Locating anatomical landmarks...");
    const img = await loadImage(imageSrc);
    const iw = img.width, ih = img.height;
    
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = iw; canvas.height = ih;
    const detCtx = canvas.getContext("2d");
    detCtx.drawImage(img, 0, 0);
    
    let lm = null;
    try { lm = await tryFaceLandmarker(canvas); } catch {}
    if (lm) return { ok: true, ...lm };

    const h = heuristicMouthRegion(iw, ih);
    return { ok: true, ...h, landmarks: null };
  };

  const squareCropRect = (iw, ih, oval) => {
    const maxSide = Math.min(iw, ih);
    let side = clamp(Math.ceil(2.35 * Math.max(oval.rx, oval.ry)), 120, maxSide);
    let x0 = clamp(Math.round(oval.cx - side / 2), 0, iw - side);
    let y0 = clamp(Math.round(oval.cy - side / 2), 0, ih - side);
    return { x: x0, y: y0, width: side, height: side };
  };

  const cropImageToDataUrl = async (imageSrc, rect) => {
    const img = await loadImage(imageSrc);
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = rect.width; canvas.height = rect.height;
    canvas.getContext("2d").drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // ── Whitening ────────────────────────────────────────────────────────
  const generateTeethMask = (landmarks, ctx, iw, ih) => {
    const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih, WHITEN_HULL_EXTRA_INSET_PX);
    if (!pts || pts.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();
    return true;
  };

  // Mandate 1: Restore Soft-Light composite blending
  const applyLuminosityWhiteningPass = async (ctx, iw, ih, strength = 0.38, landmarks = null, generation = 0) => {
    const pristineData = ctx.getImageData(0, 0, iw, ih).data;

    // Create a layer for the white overlay
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = iw; overlayCanvas.height = ih;
    const oCtx = overlayCanvas.getContext("2d", { willReadFrequently: true });
    
    // Build a pixel-accurate mask based on luminance and red-gate
    const overlayImg = oCtx.createImageData(iw, ih);
    const d = overlayImg.data;
    
    let maskPoly = null;
    if (landmarks) {
      const mp = getTightenedWhiteningMaskPoints(landmarks, iw, ih, 0);
      if (mp && mp.length >= 3) maskPoly = mp;
    }

    // --- Performance Optimization: Pre-render Mask to Bitmap ---
    // This avoids calling pointInPoly (expensive) for every single pixel.
    const maskBitmap = maskPoly ? await createBitmapMask(maskPoly, iw, ih, generation) : null;
    
    // Bounding box for optimization
    let minX = 0, maxX = iw, minY = 0, maxY = ih;
    if (maskPoly && maskPoly.length > 0) {
      const xs = maskPoly.map(p => p.x);
      const ys = maskPoly.map(p => p.y);
      minX = Math.max(0, Math.floor(Math.min(...xs)) - 15);
      maxX = Math.min(iw, Math.ceil(Math.max(...xs)) + 15);
      minY = Math.max(0, Math.floor(Math.min(...ys)) - 15);
      maxY = Math.min(ih, Math.ceil(Math.max(...ys)) + 15);
    }

    let _pixelSafe = 0;
    for (let py = minY; py < maxY; py++) {
      if (generation !== pipelineGenerationRef.current) throw "CANCELLED";
      if (py % 16 === 0) await yieldMainThread();

      for (let px = minX; px < maxX; px++) {
        if (++_pixelSafe > 1_500_000) break;

        const i = (py * iw + px) * 4;
        
        // Fast lookup instead of pointInPoly
        if (maskBitmap && !maskBitmap[py * iw + px]) continue;

        const r = pristineData[i], g = pristineData[i+1], b = pristineData[i+2];
        
        // --- Mandate 1: Red-Channel Suppression Gate (Tighter) ---
        const redExcess = r / Math.max(g, 1);
        const redExcessB = r / Math.max(b, 1);
        if (r > 105 && (redExcess > 1.18 || redExcessB > 1.22)) continue;

        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (lum < 0.04) continue;

        d[i]   = 255;
        d[i+1] = 255;
        d[i+2] = 250;
        const lumFactor = Math.pow(1 - lum, 0.5);
        d[i+3] = Math.min(255, Math.round(strength * 255 * (0.85 + 0.4 * lumFactor)));
      }
    }

    oCtx.putImageData(overlayImg, 0, 0);

    // --- Safe-Mode: Simple Feathered Mask instead of Gaussian Blur ---
    if (maskPoly) {
      oCtx.globalCompositeOperation = "destination-in";
      oCtx.beginPath();
      oCtx.moveTo(maskPoly[0].x, maskPoly[0].y);
      for (let i = 1; i < maskPoly.length; i++) oCtx.lineTo(maskPoly[i].x, maskPoly[i].y);
      oCtx.closePath();
      oCtx.fill();
    }

    // Apply composite back to main layer using soft-light
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.restore();
  };

  const applyEnamelGlossAndGumOcclusion = (ctx, iw, ih, landmarks) => {
    if (!landmarks) return;
    const topPts = [13, 312, 311, 310, 415, 308].map(i => landmarks[i]).filter(Boolean);
    if (topPts.length === 0) return;
    const avgY = topPts.reduce((s, p) => s + p.y * ih, 0) / topPts.length;
    
    const mp = getTightenedWhiteningMaskPoints(landmarks, iw, ih, 0);

    ctx.save();
    if (mp && mp.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(mp[0].x, mp[0].y);
      for (let i = 1; i < mp.length; i++) ctx.lineTo(mp[i].x, mp[i].y);
      ctx.closePath();
      ctx.clip();
    }
    
    ctx.globalCompositeOperation = "multiply";
    const grad = ctx.createLinearGradient(0, avgY - 5, 0, avgY + 20);
    // Increase slight darkness to restore physical 3D curvature
    grad.addColorStop(0, "rgba(0,0,0,0.30)"); 
    grad.addColorStop(1, "rgba(0,0,0,0)");
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, iw, ih);
    ctx.restore();
  };



  const applyTeethWhitening = async (imageSrc, oval, landmarks, bounds, generation = 0) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const w = img.width, h = img.height;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0);
        ctx.save();
        if (!landmarks) { ctx.beginPath(); ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2); ctx.clip(); }
        applyLuminosityWhiteningPass(ctx, w, h, 0.38, landmarks, generation).then(() => {
          applyEnamelGlossAndGumOcclusion(ctx, w, h, landmarks);
          ctx.restore();
          canvas.toBlob(blob => {
            resolve(URL.createObjectURL(blob));
          }, "image/jpeg", 0.95);
        }).catch(reject);
      };
      img.onerror = () => reject(new Error("Could not load image for whitening"));
      img.src = imageSrc;
    });
  };

  const pointInPoly = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  };

  /**
   * --- Mandate 5: Performance Recovery ---
   * Creates a fast-lookup boolean bitmap for a polygon to avoid per-pixel math.
   */
  const createBitmapMask = async (poly, iw, ih, generation = 0) => {
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = iw; canvas.height = ih;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, iw, ih);
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    
    const imageData = ctx.getImageData(0, 0, iw, ih);
    const data = imageData.data;
    const bitmap = new Uint8Array(iw * ih);
    
    let _maskSafe = 0;
    for (let i = 0; i < iw * ih; i++) {
      if (i % 60000 === 0) {
        if (generation && generation !== pipelineGenerationRef.current) throw "CANCELLED";
        await yieldMainThread();
      }
      bitmap[i] = data[i * 4] > 128 ? 1 : 0;
    }
    
    return bitmap;
  };

  const sampleRGBA = (src, sw, sh, x, y) => {
    const px = clamp(x, 0, sw - 1);
    const py = clamp(y, 0, sh - 1);
    const x0 = Math.floor(px), y0 = Math.floor(py);
    const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const tx = px - x0, ty = py - y0;
    const i00 = (y0 * sw + x0) * 4;
    const i10 = (y0 * sw + x1) * 4;
    const i01 = (y1 * sw + x0) * 4;
    const i11 = (y1 * sw + x1) * 4;
    const out = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const a = src[i00 + k] * (1 - tx) + src[i10 + k] * tx;
      const b = src[i01 + k] * (1 - tx) + src[i11 + k] * tx;
      out[k] = a * (1 - ty) + b * ty;
    }
    return out;
  };

  const applyAlignmentWarp = async (imageSrc, bounds, landmarks, oval, treatment = "alignment", generation = 0) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (!landmarks || !oval) {
          resolve(canvas.toDataURL("image/jpeg", 0.95));
          return;
        }

        const maskPts = getTightenedWhiteningMaskPoints(landmarks, canvas.width, canvas.height);
        if (!maskPts || maskPts.length < 3) {
          resolve(canvas.toDataURL("image/jpeg", 0.95));
          return;
        }

        const { x, y, width, height } = bounds;
        const srcImg = ctx.getImageData(x, y, width, height);
        const src = srcImg.data;
        const outImg = ctx.getImageData(x, y, width, height);
        const out = outImg.data;

        const localPoly = maskPts.map((p) => ({ x: p.x - x, y: p.y - y }));
        const maskBitmap = await createBitmapMask(localPoly, width, height, generation);

        const lipU = landmarks[13], lipL = landmarks[14];
        const midY = lipU && lipL ? ((lipU.y + lipL.y) * 0.5 * canvas.height - y) : height * 0.5;
        /** Only warp / inpaint / sharpen above this row — below is lip/lower arch (must stay original pixels). */
        const upperCap = Math.floor(clamp(midY - 2, 0, height - 1));

        const copyPixel = (dst, di, srcBuf, si) => {
          dst[di] = srcBuf[si];
          dst[di + 1] = srcBuf[si + 1];
          dst[di + 2] = srcBuf[si + 2];
          dst[di + 3] = srcBuf[si + 3];
        };

        const topEdge = new Float32Array(width).fill(1e9);
        const valid = new Uint8Array(width);
        let _warpSafe1 = 0;
        for (let cx = 0; cx < width; cx++) {
          if (generation !== pipelineGenerationRef.current) throw "CANCELLED";
          if (cx % 32 === 0) await yieldMainThread();
          for (let cy = 0; cy <= upperCap; cy++) {
            if (++_warpSafe1 > 1_500_000) break;
            if (!maskBitmap[cy * width + cx]) continue;
            const i = (cy * width + cx) * 4;
            const r = src[i], g = src[i + 1], b = src[i + 2];
            const maxc = Math.max(r, g, b), minc = Math.min(r, g, b);
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
            if (lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX) {
              topEdge[cx] = cy;
              valid[cx] = 1;
              break;
            }
          }
        }

        // Smooth top edge (median) for stable per-tooth alignment
        const smoothTop = new Float32Array(width).fill(0);
        for (let cx = 0; cx < width; cx++) {
          const vals = [];
          for (let k = -3; k <= 3; k++) {
            const ix = clamp(cx + k, 0, width - 1);
            if (!valid[ix]) continue;
            vals.push(topEdge[ix]);
          }
          if (vals.length) {
            vals.sort((a, b) => a - b);
            smoothTop[cx] = vals[Math.floor(vals.length / 2)];
          } else smoothTop[cx] = upperCap * 0.62;
        }

        const midX = width * 0.5;
        const frontL = Math.floor(width * 0.34);
        const frontR = Math.ceil(width * 0.66);
        let targetY = 0;
        let targetN = 0;
        for (let cx = frontL; cx <= frontR; cx++) {
          if (!valid[cx]) continue;
          targetY += smoothTop[cx];
          targetN++;
        }
        targetY = targetN ? targetY / targetN : upperCap * 0.6;

        const archAmp = clamp((treatment === "transformation" ? 0.09 : 0.03) * width, 2, 14);
        const dyCol = new Float32Array(width).fill(0);
        const dxCol = new Float32Array(width).fill(0);

        // Symmetry lock by side span balancing
        let leftSpan = 0, leftN = 0, rightSpan = 0, rightN = 0;
        for (let cx = 0; cx < width; cx++) {
          if (!valid[cx]) continue;
          const d = Math.abs(cx - midX);
          if (cx < midX) {
            leftSpan += d;
            leftN++;
          } else {
            rightSpan += d;
            rightN++;
          }
        }
        const leftAvg = leftN ? leftSpan / leftN : 0;
        const rightAvg = rightN ? rightSpan / rightN : 0;
        const spanDelta = rightAvg - leftAvg;

        for (let cx = 0; cx < width; cx++) {
          const u = (cx - midX) / Math.max(width * 0.5, 1);
          const idealArchY = targetY + archAmp * u * u;
          const top = smoothTop[cx];
          dyCol[cx] = (idealArchY - top) * 0.85;
          const slope = (smoothTop[clamp(cx + 1, 0, width - 1)] - smoothTop[clamp(cx - 1, 0, width - 1)]) * 0.5;
          // Rotate twisted crowns toward vertical by opposite lateral shift
          dxCol[cx] = clamp(-slope * 0.14, -1.2, 1.2);
          if (spanDelta > 1.2 && cx < midX) dxCol[cx] += clamp(spanDelta * 0.03, 0, 0.9);
          if (spanDelta < -1.2 && cx > midX) dxCol[cx] -= clamp(Math.abs(spanDelta) * 0.03, 0, 0.9);
        }

        const smoothFloat1D = (arr, rad) => {
          const o = new Float32Array(arr.length);
          for (let i = 0; i < arr.length; i++) {
            let s = 0;
            let n = 0;
            for (let k = -rad; k <= rad; k++) {
              const j = clamp(i + k, 0, arr.length - 1);
              s += arr[j];
              n++;
            }
            o[i] = s / n;
          }
          return o;
        };
        const dySm = smoothFloat1D(dyCol, 3);
        const dxSm = smoothFloat1D(dxCol, 3);
        for (let cx = 0; cx < width; cx++) {
          dyCol[cx] = dyCol[cx] * 0.35 + dySm[cx] * 0.65;
          dxCol[cx] = dxCol[cx] * 0.3 + dxSm[cx] * 0.7;
          dyCol[cx] = clamp(dyCol[cx], -6.5, 6.5);
          dxCol[cx] = clamp(dxCol[cx], -1.1, 1.1);
        }

        const slopeAt = (cxCol) => {
          const i0 = clamp(cxCol - 1, 0, width - 1);
          const i1 = clamp(cxCol + 1, 0, width - 1);
          return (smoothTop[i1] - smoothTop[i0]) * 0.5;
        };

        // Texture-preserving inverse warp: local rotation (column pivot) + translation = homography-style enamel move.
        let _warpSafe2 = 0;
        for (let cy = 0; cy < height; cy++) {
          if (generation !== pipelineGenerationRef.current) throw "CANCELLED";
          if (cy % 16 === 0) await yieldMainThread();
          for (let cx = 0; cx < width; cx++) {
            if (++_warpSafe2 > 2_000_000) break;
            const oi = (cy * width + cx) * 4;
            if (!maskBitmap[cy * width + cx]) continue;
            if (cy > upperCap) {
              copyPixel(out, oi, src, oi);
              continue;
            }
            const top = smoothTop[cx];
            const depth = clamp((cy - top) / Math.max(upperCap - top + 1, 1), 0, 1);
            const warpW = 1 - depth;
            const lateralScale = treatment === "alignment" ? 0.3 : 1;
            const tdx = dxCol[cx] * lateralScale * (0.2 + 0.8 * warpW);
            const tdy = dyCol[cx] * (0.28 + 0.72 * warpW);
            const slope = slopeAt(cx);
            const thetaBase = treatment === "alignment" ? 0.16 : 0.32;
            const theta = -Math.atan(slope) * (1 - depth) * thetaBase;
            const vx = -tdx;
            const vy = cy - top - tdy;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const srx = vx * cosT + vy * sinT;
            const sry = -vx * sinT + vy * cosT;
            const sx = Math.round(cx + srx);
            const sy = Math.round(top + sry);
            const smp = (sx >= 0 && sx < width && sy >= 0 && sy < height && maskBitmap[sy * width + sx])
              ? sampleRGBA(src, width, height, sx, sy)
              : sampleRGBA(src, width, height, cx, cy);
            
            const sr = smp[0], sg = smp[1], sb = smp[2];
            const isGum = sr > 140 && (sr / Math.max(sg, 1) > 1.25) && (sr / Math.max(sb, 1) > 1.25);
            
            if (isGum) {
              const orig = sampleRGBA(src, width, height, cx, cy);
              out[oi] = orig[0];
              out[oi + 1] = orig[1];
              out[oi + 2] = orig[2];
              out[oi + 3] = orig[3];
            } else {
              out[oi] = smp[0];
              out[oi + 1] = smp[1];
              out[oi + 2] = smp[2];
              out[oi + 3] = smp[3];
            }
          }
        }

        // Pure physical geometry retained. No artificial pixel cloning or laplacian convolutions.


        // Hard composite: anything outside teeth hull or below lip line stays identical to source (fixes jagged halos / lip tint).
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            if (cy <= upperCap && maskBitmap[cy * width + cx]) continue;
            const oi = (cy * width + cx) * 4;
            copyPixel(out, oi, src, oi);
          }
        }

        ctx.putImageData(outImg, x, y);
        canvas.toBlob(blob => {
          resolve(URL.createObjectURL(blob));
        }, "image/jpeg", 0.95);
      };
      img.onerror = () => reject(new Error("Could not load image for alignment"));
      img.src = imageSrc;
    });
  };

  const cropMouthRegion = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = bounds.width; canvas.height = bounds.height;
    canvas.getContext("2d").drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const scaleMouthAndMaskForApi = async (mouthDataUrl, maskDataUrl, maxEdge) => {
    const mouthImg = await loadImage(mouthDataUrl);
    const w = mouthImg.width, h = mouthImg.height;
    const longest = Math.max(w, h);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    if (scale >= 1) return { mouth: mouthDataUrl, mask: maskDataUrl };
    const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
    
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    
    canvas.width = nw; canvas.height = nh;
    canvas.getContext("2d").drawImage(mouthImg, 0, 0, nw, nh);
    const mouthRes = canvas.toDataURL("image/jpeg", 0.88);
    
    const maskImg = await loadImage(maskDataUrl);
    canvas.getContext("2d").drawImage(maskImg, 0, 0, nw, nh);
    const maskRes = canvas.toDataURL("image/png");

    return { mouth: mouthRes, mask: maskRes };
  };

  const createTeethMaskForCrop = async (mouthImageSrc, cw, ch, ovalInCrop, generation = 0) => {
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, cw, ch);
    
    // We need a secondary canvas momentarily for the source pixels if we want to avoid multiple canvases,
    // but the source image is already loaded. We can use the singleton if we cache the ImageData.
    const img = await loadImage(mouthImageSrc);
    ctx.drawImage(img, 0, 0, cw, ch);
    const frame = ctx.getImageData(0, 0, cw, ch).data;
    
    // Now clear and build mask
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, cw, ch);
    const out = ctx.getImageData(0, 0, cw, ch);
    const od = out.data;
    
    const { cx, cy, rx, ry } = ovalInCrop;
    let _maskSafe = 0;
    for (let y = 0; y < ch; y++) {
      if (y % 16 === 0) {
        if (generation && generation !== pipelineGenerationRef.current) throw "CANCELLED";
        await yieldMainThread();
      }
      for (let x = 0; x < cw; x++) {
        if (++_maskSafe > 1_500_000) break;
        const nx = (x - cx) / Math.max(rx, 1), ny = (y - cy) / Math.max(ry, 1);
        if (nx * nx + ny * ny > 1.06) continue;
        const i = (y * cw + x) * 4;
        const r = frame[i], g = frame[i+1], b = frame[i+2];
        const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
        if (lum < ENAMEL_LUM_MIN || lum > ENAMEL_LUM_MAX || sat > ENAMEL_SAT_MAX) continue;
        od[i] = od[i+1] = od[i+2] = 255;
        od[i+3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    const result = canvas.toDataURL("image/png");
    return result;
  };

  const getFacialMidlineXNorm = (landmarks) => {
    const n = landmarks?.[NOSE_MIDLINE_IDX], c = landmarks?.[CHIN_MIDLINE_IDX];
    if (!n || !c || typeof n.x !== "number" || typeof c.x !== "number") return null;
    return (n.x + c.x) / 2;
  };

  const enhanceWithAI = async (mouthImage, mask, treatment, midlineXNorm = null) => {
    if (!AI_SMILE_API) throw new Error("Backend API is not configured.");
    const payload = { image: mouthImage, mask, treatment };
    if (midlineXNorm != null && Number.isFinite(midlineXNorm)) payload.midlineX = midlineXNorm;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), AI_SMILE_FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(AI_SMILE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === "AbortError") throw new Error("AI enhancement timed out.");
      throw new Error(e?.message || "Network error");
    } finally { clearTimeout(abortTimer); }
    let data;
    try { data = await response.json(); } catch { throw new Error("Invalid response from smile API."); }
    if (!response.ok) throw new Error(data.error || "AI polish failed");
    return data.outputDataUrl || data.output || null;
  };

  const ellipseFeatherWeight = (px, py, oval, featherPx) => {
    const { cx, cy, rx, ry } = oval;
    if (rx <= 0 || ry <= 0) return 0;
    const nx = (px - cx) / rx, ny = (py - cy) / ry;
    const dist = Math.sqrt(nx*nx + ny*ny);
    const outer = 1 + featherPx / Math.max(rx, ry);
    if (dist <= 1) return 1;
    if (dist >= outer) return 0;
    const t = (outer - dist) / (outer - 1);
    return t * t * (3 - 2 * t);
  };

  /** Outside core enamel hull, keep mostly original pixels so AI polish does not recolor lips/gums. */
  const MERGE_OUTSIDE_ENAMEL_WEIGHT = 0; // Prevent AI artifacts from leaking onto skin/lips

  const mergeFinalImage = async (originalSrc, mouthEnhancedSrc, bounds, oval, landmarks = null, generation = 0) => {
    const [original, mouth] = await Promise.all([loadImage(originalSrc), loadImage(mouthEnhancedSrc)]);
    
    if (!engineCanvasRef.current) engineCanvasRef.current = document.createElement("canvas");
    const canvas = engineCanvasRef.current;
    canvas.width = original.width; canvas.height = original.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(original, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = imageData.data;
    
    let enamelCore = null;
    if (landmarks) {
      const pts = getTightenedWhiteningMaskPoints(landmarks, canvas.width, canvas.height, WHITEN_HULL_EXTRA_INSET_PX);
      if (pts && pts.length >= 3) enamelCore = pts;
    }
    
    // Phase 6: Use secondary singleton for localized sampling
    if (!engineCanvasSecondaryRef.current) engineCanvasSecondaryRef.current = document.createElement("canvas");
    const tmp = engineCanvasSecondaryRef.current;
    tmp.width = bounds.width; tmp.height = bounds.height;
    tmp.getContext("2d").drawImage(mouth, 0, 0, mouth.width, mouth.height, 0, 0, bounds.width, bounds.height);
    const mouthPixels = tmp.getContext("2d").getImageData(0, 0, bounds.width, bounds.height).data;
    const maskBitmap = enamelCore ? await createBitmapMask(enamelCore, original.width, original.height, generation) : null;

    let _mergeSafe = 0;
    for (let py = bounds.y; py < bounds.y + bounds.height; py++) {
      if (generation && generation !== pipelineGenerationRef.current) throw "CANCELLED";
      if (py % 24 === 0) await yieldMainThread();
      for (let px = bounds.x; px < bounds.x + bounds.width; px++) {
        if (++_mergeSafe > 1_500_000) break;
        const w0 = ellipseFeatherWeight(px, py, oval, OVAL_FEATHER_PX);
        if (w0 <= 0) continue;
        const wEnamel = (!maskBitmap || maskBitmap[py * original.width + px])
          ? 1
          : MERGE_OUTSIDE_ENAMEL_WEIGHT;
        const w = w0 * wEnamel;
        if (w <= 0) continue;
        const oi = (py * canvas.width + px) * 4;
        const mi = ((py - bounds.y) * bounds.width + (px - bounds.x)) * 4;
        out[oi]   = Math.round(out[oi]   * (1-w) + mouthPixels[mi]   * w);
        out[oi+1] = Math.round(out[oi+1] * (1-w) + mouthPixels[mi+1] * w);
        out[oi+2] = Math.round(out[oi+2] * (1-w) + mouthPixels[mi+2] * w);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(URL.createObjectURL(blob));
      }, "image/jpeg", 0.95);
    });
  };

  // ── FIXED: Braces overlay now uses clean fixed pipeline ──────────────
  const applyBracesOverlay = async (imageSrc, iw, ih) => {
    return applyBracesOverlayFixed(imageSrc, iw, ih);
  };

  // ── Camera ───────────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError(null); setCameraError(null); setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("Could not access camera. Allow permission or upload a photo.");
      setStep("upload");
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;
    const maxWidth = 1024, scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const outW = Math.round(video.videoWidth * scale), outH = Math.round(video.videoHeight * scale);
    const canvas = canvasRef.current;
    canvas.width = outW; canvas.height = outH;
    canvas.getContext("2d").drawImage(video, 0, 0, outW, outH);
    stopCamera();
    canvas.toBlob(blob => {
      const captured = URL.createObjectURL(blob);
      processWithAI(captured).catch(err => { 
        setError(err?.message || "Could not process this photo."); 
        setStep("upload"); 
      });
    }, "image/jpeg", 0.9);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Lockdown Phase 3: Zero-Copy ingestion via ObjectURL (No FileReader strings)
    const fileUrl = URL.createObjectURL(file);
    processWithAI(fileUrl).catch(err => {
      setError(err?.message || "Could not process this image.");
      setStep("upload");
      safeRevoke(fileUrl);
    });
  };


  // ── Main AI pipeline ─────────────────────────────────────────────────
  const processWithAI = async (baseImage, options = {}) => {
    if (isProcessing) return;
    const { alreadyNormalized = false } = options;
    const generation = ++pipelineGenerationRef.current;

    setIsProcessing(true);
    setStep("processing");
    setError(null);
    setActiveTreatment(selectedTreatment);
    setProcessingLog("Analyzing facial features...");
    
    // Phase 5 Liberation: Wait for React to paint the "Designing..." screen
    // BEFORE starting heavy math, preventing the "Freeze" feel.
    await new Promise(r => setTimeout(r, 100));

    try {
      const normalized = alreadyNormalized ? baseImage : await normalizeImage(baseImage, 512);
      
      // Phase 3: Immediate revocation of high-res original after normalization
      if (!alreadyNormalized) safeRevoke(baseImage);

      setProcessingLog("Detecting mouth region...");
      const mouth = await detectMouth(normalized);

      if (!mouth.bounds || !mouth.oval) {
        safeRevoke(normalized);
        setError("Keep your mouth slightly open so we can see your teeth clearly, then try again.");
        setStep("upload");
        return;
      }

      const { bounds, oval, landmarks } = mouth;
      setProcessingLog("Applying clinical whitening...");
      const fullFrame = await loadImage(normalized);
      let currentStepUrl = normalized;

      // Whitening pass
      if (["whitening", "transformation", "braces"].includes(selectedTreatment)) {
        const next = await applyTeethWhitening(currentStepUrl, oval, landmarks, bounds, generation);
        if (currentStepUrl !== normalized) safeRevoke(currentStepUrl);
        currentStepUrl = next;
      }
      
      // Alignment pass
      if (["alignment", "transformation"].includes(selectedTreatment)) {
        setProcessingLog("Realigning tooth geometry...");
        const next = await applyAlignmentWarp(currentStepUrl, bounds, landmarks, oval, selectedTreatment, generation);
        if (currentStepUrl !== normalized) safeRevoke(currentStepUrl);
        currentStepUrl = next;
      }

      setProcessingLog("Finalizing simulation...");
      const mouthCrop = await cropMouthRegion(currentStepUrl, bounds);
      const previewRect = squareCropRect(fullFrame.width, fullFrame.height, oval);
      const beforeSquare = await cropImageToDataUrl(normalized, previewRect);

      const finalizeAndShow = async (mouthUrl) => {
        const mergedUrl = await mergeFinalImage(normalized, mouthUrl, bounds, oval, landmarks, generation);
        let finalUrl = mergedUrl;
        if (selectedTreatment === "braces") {
          finalUrl = await applyBracesOverlay(mergedUrl, fullFrame.width, fullFrame.height);
          safeRevoke(mergedUrl);
        }
        const afterSquare = await cropImageToDataUrl(finalUrl, previewRect);
        
        // Final state cleanup
        setBeforeImage(beforeSquare);
        setAfterImage(afterSquare);
        setStep("result");
        
        // Keep finalUrl and beforeSquare in state, but we'll revoke others
        safeRevoke(mouthUrl);
        if (currentStepUrl !== normalized) safeRevoke(currentStepUrl);
        safeRevoke(normalized);
        setIsProcessing(false);
      };

      await finalizeAndShow(mouthCrop);
      if (generation !== pipelineGenerationRef.current) return;

      const useReplicatePolish = selectedTreatment !== "braces";
      if (useReplicatePolish && AI_SMILE_API) {
        const replicateTreatment = selectedTreatment === "transformation" ? "transformation" : selectedTreatment;
        const midlineXNorm = getFacialMidlineXNorm(landmarks);
        const ovalInCrop = { cx: oval.cx - bounds.x, cy: oval.cy - bounds.y, rx: oval.rx, ry: oval.ry };

        (async () => {
          try {
            const mask = await createTeethMaskForCrop(mouthCrop, bounds.width, bounds.height, ovalInCrop, generation);
            const { mouth: apiMouth, mask: apiMask } = await scaleMouthAndMaskForApi(mouthCrop, mask, API_MOUTH_MAX_EDGE);
            const aiPolishedCrop = await enhanceWithAI(apiMouth, apiMask, replicateTreatment, midlineXNorm);
            if (!aiPolishedCrop || generation !== pipelineGenerationRef.current) {
              safeRevoke(mask); safeRevoke(apiMouth); safeRevoke(apiMask);
              return;
            }
            const merged = await mergeFinalImage(normalized, aiPolishedCrop, bounds, oval, landmarks, generation);
            const afterSquare = await cropImageToDataUrl(merged, previewRect);
            setAfterImage(afterSquare);
            safeRevoke(merged); safeRevoke(mask); safeRevoke(apiMouth); safeRevoke(apiMask);
          } catch {
            /* keep client preview */
          }
        })();
      }
    } catch (err) {
      setIsProcessing(false);
      if (err === "CANCELLED") return;
      setError(err?.message || "Simulation failed.");
      setStep("upload");
    }
  };

  useEffect(() => {
    // Phase 6: Pre-Heat AI on mount
    initFaceLandmarker().catch(() => {});
    return () => {
      pipelineGenerationRef.current += 1;
      if (engineCanvasRef.current) {
        engineCanvasRef.current.width = 0;
        engineCanvasRef.current.height = 0;
        engineCanvasRef.current = null;
      }
      if (engineCanvasSecondaryRef.current) {
        engineCanvasSecondaryRef.current.width = 0;
        engineCanvasSecondaryRef.current.height = 0;
        engineCanvasSecondaryRef.current = null;
      }
    };
  }, []);

  const reset = () => {
    pipelineGenerationRef.current += 1;
    stopCamera();
    setStep("upload");
    if (beforeImage) safeRevoke(beforeImage);
    if (afterImage) safeRevoke(afterImage);
    setBeforeImage(null);
    setAfterImage(null);
    setError(null);
    setCameraError(null);
    setActiveTreatment(selectedTreatment);
  };

  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (step !== "camera" || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [step]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section id="simulation" className="py-24 bg-[#F9F9F7] scroll-mt-28">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-16">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-4xl md:text-5xl text-zinc-900 mb-6">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Upload a photo or take one live — AI whitening, alignment, and precise bracket placement in seconds.
          </p>
        </AnimatedSection>

        {/* Floating luxury treatment dock */}
        <AnimatedSection className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex justify-center w-full max-w-lg">
          <div className="inline-flex items-center justify-center gap-4 rounded-full border border-[rgba(255,255,255,0.1)] bg-zinc-950/70 px-5 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            {TREATMENTS.map((t) => (
              <TreatmentDockButton
                key={t.id}
                treatment={t}
                active={(step === "processing" || step === "result") ? activeTreatment === t.id : selectedTreatment === t.id}
                disabled={step === "processing" || step === "result"}
                onSelect={() => setSelectedTreatment(t.id)}
              />
            ))}
          </div>
        </AnimatedSection>

        {/* Main panel */}
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white p-12 rounded-3xl border border-zinc-100 shadow-xl text-center">
                <div className="mb-10 flex justify-center">
                  <div className="w-20 h-20 bg-brand-blue/30 rounded-full flex items-center justify-center text-zinc-600">
                    <Upload size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-serif mb-4">Upload or Capture Smile</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">
                  Face forward with your mouth open slightly so teeth are visible.
                </p>
                {error && <div className="mb-8 p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}
                {cameraError && !error && <div className="mb-8 p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">{cameraError}</div>}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <PremiumButton onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2">
                    <Upload size={18} /> Choose File
                  </PremiumButton>
                  <PremiumButton variant="secondary" onClick={startCamera} className="flex items-center justify-center gap-2">
                    <Camera size={18} /> Take Photo
                  </PremiumButton>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                <div className="mt-12 flex items-start gap-3 text-left p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <Info size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    AI-generated preview — may not reflect exact medical results. Consult a specialist for a personalised treatment plan.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="relative aspect-video overflow-hidden rounded-3xl bg-black shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative flex items-center justify-center">
                    <span
                      style={{ fontFamily: "'Inter', sans-serif" }}
                      className="absolute -top-10 rounded-full border border-white/25 bg-black/45 px-4 py-1 text-[11px] font-semibold tracking-[0.12em] text-white/95"
                    >
                      ALIGN TEETH IN CENTER
                    </span>
                    <div className="h-[7.2rem] w-[18rem] max-w-[92%] rounded-[999px] border-2 border-dashed border-white/80 bg-white/5" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 p-6">
                  <button type="button" onClick={reset} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"><X size={22} /></button>
                  <button type="button" onClick={takePhoto} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white">
                    <span className="h-12 w-12 rounded-full bg-zinc-900" />
                  </button>
                  <button type="button" onClick={() => { stopCamera(); startCamera(); }} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"><RefreshCw size={20} /></button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-white p-20 rounded-3xl border border-zinc-100 shadow-xl text-center">
                <div className="w-16 h-16 border-4 border-zinc-100 border-t-brand-gold rounded-full animate-spin mx-auto mb-8" />
                <p className="text-lg font-serif text-zinc-800">Designing your future smile…</p>
                <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-8 overflow-hidden">
                  <div className="bg-brand-gold h-full animate-[loading_20s_ease-in-out_infinite]" style={{ width: "30%" }} />
                </div>
                <div className="mt-6">
                  <p className="text-[10px] text-brand-gold font-bold uppercase tracking-[0.2em] animate-pulse">{processingLog || "Preparing..."}</p>
                </div>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <motion.div
                  className="relative rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-white/20 bg-black w-full max-w-lg mx-auto aspect-square max-h-[min(92vw,560px)] origin-center"
                  initial={{ scale: 1.08, y: 6 }} animate={{ scale: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ReactCompareImage
                    key={afterImage || "compare"}
                    leftImage={beforeImage} rightImage={afterImage}
                    aspectRatio="taller" sliderPositionPercentage={0.5}
                    sliderLineWidth={2} sliderLineColor="#D4AF37" handleSize={44}
                    leftImageCss={{ objectFit: "cover", objectPosition: "center center" }}
                    rightImageCss={{ objectFit: "cover", objectPosition: "center center" }}
                  />
                  
                  {/* Premium Slider Labels */}
                  <div className="absolute top-6 left-6 pointer-events-none">
                    <span className="glass px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-900 shadow-sm">
                      Original
                    </span>
                  </div>
                  <div className="absolute top-6 right-6 pointer-events-none">
                    <span className="glass px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-brand-gold shadow-sm">
                      Simulation
                    </span>
                  </div>
                </motion.div>
                <p className="text-center text-xs text-zinc-500 md:hidden">Drag the gold line to compare</p>

                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <motion.div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center"
                      animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3 }}>
                      <CheckCircle2 size={24} />
                    </motion.div>
                    <div>
                      <h4 className="font-serif text-xl">Simulation Complete</h4>
                      <p className="text-zinc-400 text-sm capitalize">{activeTreatment} preview ready</p>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap justify-center">
                    <PremiumButton variant="outline" onClick={reset}>Try Another</PremiumButton>
                    <motion.div animate={{ boxShadow: ["0 0 0 0 rgba(212,175,55,0)", "0 0 22px 6px rgba(212,175,55,0.35)", "0 0 0 0 rgba(212,175,55,0)"] }}
                      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }} className="rounded-xl">
                      <PremiumButton style={{ background: "linear-gradient(135deg,#D4AF37,#F5E6C5)", color: "#000" }}>Book Consultation</PremiumButton>
                    </motion.div>
                  </div>
                </div>
                <p className="text-center text-xs text-zinc-400 italic">&ldquo;AI-generated preview — not a substitute for professional dental advice.&rdquo;</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
