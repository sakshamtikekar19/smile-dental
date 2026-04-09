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
        <radialGradient id="whitenTooth" cx="45%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="68%" stopColor="#e0f7fa" />
          <stop offset="100%" stopColor="#bae6fd" />
        </radialGradient>
        <linearGradient id="chromeHi" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f8fafc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M16 14c2-4 8-6 16-6s14 2 16 6c3 6-1 16-3 21-3 8-4 18-13 18S22 43 19 35c-2-5-6-15-3-21z" fill="url(#whitenTooth)" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M20 18 L38 8 L42 12 L24 22 Z" fill="url(#chromeHi)" />
      <path d="M22 20 L34 13" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function AlignmentIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <g opacity="0.55">
        <rect x="9" y="18" width="12" height="26" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
        <rect x="23" y="16" width="12" height="28" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
        <rect x="37" y="18" width="12" height="26" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      </g>
      <rect x="11" y="15" width="12" height="28" rx="5" fill="#f8fafc" stroke="#3b82f6" strokeWidth="2" />
      <rect x="25" y="13" width="12" height="30" rx="5" fill="#f8fafc" stroke="#3b82f6" strokeWidth="2" />
      <rect x="39" y="15" width="12" height="28" rx="5" fill="#f8fafc" stroke="#3b82f6" strokeWidth="2" />
      <path d="M14 30c6-4 30-4 36 0" fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3 2" />
      <path d="M10 32h44" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 32l6-5v10zM56 32l-6-5v10z" fill="#2563eb" />
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
  const teeth = [12, 18, 24, 30, 36, 42, 48, 54].map((cx, i) => (
    <g key={i}>
      <ellipse cx={cx} cy="34" rx="4.8" ry="11" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
      <ellipse cx={cx - 1.2} cy="29" rx="1.6" ry="2.6" fill="#ffffff" opacity="0.55" />
    </g>
  ));
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <filter id="archGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d="M6 38c10 10 42 10 52 0" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.85" filter="url(#archGlow)" />
      <path d="M8 36 Q32 22 56 36" fill="rgba(255,255,255,0.06)" stroke="#fde68a" strokeWidth="1" />
      {teeth}
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
const API_MOUTH_MAX_EDGE        = 768;
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
const AI_SMILE_FETCH_TIMEOUT_MS      = 130_000;

let faceMeshInstance;
let faceMeshLoadFailed = false;
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

const initFaceMesh = async () => {
  if (faceMeshLoadFailed) return null;
  if (faceMeshInstance) return faceMeshInstance;
  try {
    const FaceMeshModule = await import("@mediapipe/face_mesh");
    const faceMesh = new FaceMeshModule.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.2,
      minTrackingConfidence: 0.2,
    });
    faceMeshInstance = faceMesh;
    return faceMeshInstance;
  } catch {
    faceMeshLoadFailed = true;
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

  const fileInputRef = useRef(null);
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);

  // ── Utilities ──────────────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const normalizeImage = async (imageSrc, maxWidth = 1024) => {
    const img = await loadImage(imageSrc);
    const scale  = img.width > maxWidth ? maxWidth / img.width : 1;
    const width  = Math.round(img.width  * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.9);
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

  const runFaceMeshOnCanvas = (canvas) =>
    new Promise(resolve => {
      let settled = false, timer;
      const finish = p => { if (settled) return; settled = true; clearTimeout(timer); resolve(p); };
      timer = setTimeout(() => finish({ ok: false }), 12000);
      Promise.race([
        initFaceMesh(),
        new Promise(r => setTimeout(() => r(null), FACE_MESH_INIT_TIMEOUT_MS)),
      ]).then(faceMesh => {
        if (!faceMesh) { finish({ ok: false }); return; }
        faceMesh.onResults(results => {
          const landmarks = results?.multiFaceLandmarks?.[0];
          if (!landmarks) { finish({ ok: false }); return; }
          const analysis = analyzeMouthFromLandmarks(landmarks, canvas.width, canvas.height) ||
                           buildAnalysisFromMinimalMouthHull(landmarks, canvas.width, canvas.height);
          if (!analysis) { finish({ ok: false }); return; }
          finish({ ok: true, ...analysis, landmarks });
        });
        faceMesh.send({ image: canvas }).catch(() => finish({ ok: false }));
      });
    });

  const detectMouth = async (imageSrc) => {
    const img = await loadImage(imageSrc);
    if (typeof img.decode === "function") { try { await img.decode(); } catch {} }
    const iw = img.width, ih = img.height;
    const canvas = document.createElement("canvas");
    canvas.width = iw; canvas.height = ih;
    const detCtx = canvas.getContext("2d");
    detCtx.drawImage(img, 0, 0);
    boostMouthGuideRegion(detCtx, iw, ih);

    let lm = null;
    try { lm = await tryFaceLandmarker(canvas); } catch {}
    if (lm) return { ok: true, bounds: lm.bounds, oval: lm.oval, confidence: lm.confidence, landmarks: lm.landmarks };

    const mesh = await runFaceMeshOnCanvas(canvas);
    if (mesh.ok && mesh.bounds && mesh.oval) return mesh;

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
    const canvas = document.createElement("canvas");
    canvas.width = rect.width; canvas.height = rect.height;
    canvas.getContext("2d").drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // ── Whitening ────────────────────────────────────────────────────────
  const generateTeethMask = (landmarks, ctx, iw, ih) => {
    const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih);
    if (!pts || pts.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();
    return true;
  };

  const applyMouthPopFilter = (ctx, bounds) => {
    if (!bounds) return;
    const { width: cw, height: ch } = ctx.canvas;
    let { x, y, width, height } = bounds;
    if (!Number.isFinite(x) || !Number.isFinite(y) || width < 2 || height < 2) return;
    x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
    width  = Math.min(Math.floor(width),  cw - x);
    height = Math.min(Math.floor(height), ch - y);
    if (width < 2 || height < 2) return;
    try {
      const tmp = document.createElement("canvas");
      tmp.width = width; tmp.height = height;
      const tctx = tmp.getContext("2d");
      tctx.filter = "contrast(1.05) saturate(1.1)";
      tctx.drawImage(ctx.canvas, x, y, width, height, 0, 0, width, height);
      tctx.filter = "none";
      ctx.drawImage(tmp, 0, 0, width, height, x, y, width, height);
    } catch {}
  };

  const applyLuminosityWhiteningPass = (ctx, iw, ih, strength = 0.4, landmarks = null) => {
    ctx.filter = "contrast(1.1) brightness(1.03)";
    ctx.drawImage(ctx.canvas, 0, 0, iw, ih, 0, 0, iw, ih);
    ctx.filter = "none";

    const preColor = document.createElement("canvas");
    preColor.width = iw; preColor.height = ih;
    const preCtx = preColor.getContext("2d", { willReadFrequently: true });
    preCtx.drawImage(ctx.canvas, 0, 0);
    const preData = preCtx.getImageData(0, 0, iw, ih).data;

    const chromaLayer = document.createElement("canvas");
    chromaLayer.width = iw; chromaLayer.height = ih;
    const zctx = chromaLayer.getContext("2d", { willReadFrequently: true });
    zctx.drawImage(ctx.canvas, 0, 0);
    const zimg = zctx.getImageData(0, 0, iw, ih);
    const zd = zimg.data;
    for (let i = 0; i < zd.length; i += 4) {
      const r = zd[i], g = zd[i+1], b = zd[i+2];
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      zd[i]   = Math.round(lum + (r - lum) * 0.52);
      zd[i+1] = Math.round(lum + (g - lum) * 0.52);
      zd[i+2] = Math.round(lum + (b - lum) * 0.52);
    }
    zctx.putImageData(zimg, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.drawImage(chromaLayer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    const layer = document.createElement("canvas");
    layer.width = iw; layer.height = ih;
    const lctx = layer.getContext("2d", { willReadFrequently: true });
    lctx.drawImage(ctx.canvas, 0, 0);
    const img = lctx.getImageData(0, 0, iw, ih);
    const d = img.data;
    const ivory = { r: 252, g: 249, b: 241 };

    let sumLum = 0, nArch = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX) { sumLum += lum; nArch++; }
    }
    const archMeanLum = nArch > 0 ? sumLum / nArch : 150;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const lum = 0.2126*r + 0.7152*g + 0.0722*b;
      const origLum = 0.2126*preData[i] + 0.7152*preData[i+1] + 0.0722*preData[i+2];
      const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      const inEnamelBand = lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX;
      const baseW = clamp((lum - 8) / 230, 0, 1);
      let adapt = 0;
      if (inEnamelBand) adapt = lum < 60 ? 2.0 : 1 + clamp((archMeanLum - lum) / (archMeanLum * 0.42 + 8), 0, 1.6);
      let w = clamp(baseW * adapt, 0, 1.28);
      if (origLum < INTERDENTAL_SHADOW_LUM_MAX) { const t = origLum / Math.max(INTERDENTAL_SHADOW_LUM_MAX, 1); w *= 0.05 + 0.22 * t * t; }
      const translucency = 0.22 + 0.78 * (origLum / 255);
      w *= translucency;
      d[i]   = Math.round(r + (ivory.r - r) * w);
      d[i+1] = Math.round(g + (ivory.g - g) * w);
      d[i+2] = Math.round(b + (ivory.b - b) * w);
    }
    lctx.putImageData(img, 0, 0);

    if (landmarks) {
      const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih);
      if (pts && pts.length >= 3) {
        lctx.globalCompositeOperation = "destination-in";
        lctx.beginPath();
        lctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) lctx.lineTo(pts[i].x, pts[i].y);
        lctx.closePath();
        lctx.fillStyle = "#fff";
        lctx.fill();
        lctx.globalCompositeOperation = "source-over";
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = strength;
    ctx.filter = `blur(${MASK_CLIP_FEATHER_PX}px)`;
    ctx.drawImage(layer, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  };

  const applyEnamelGlossAndGumOcclusion = (ctx, iw, ih, landmarks, oval) => {
    let yTop, yBandEnd;
    if (landmarks) {
      const ys = TEETH_WHITEN_MASK_INDICES.map(i => landmarks[i]?.y).filter(v => typeof v === "number");
      if (ys.length >= 2) {
        const minY = Math.min(...ys.map(ny => ny * ih));
        const maxY = Math.max(...ys.map(ny => ny * ih));
        yTop = minY; yBandEnd = minY + (maxY - minY) * 0.1;
      }
    }
    if (yTop === undefined && oval) { const span = oval.ry * 2; yTop = oval.cy - oval.ry; yBandEnd = yTop + span * 0.1; }
    if (yTop !== undefined && yBandEnd > yTop) {
      ctx.save();
      const g = ctx.createLinearGradient(0, yTop, 0, yBandEnd);
      g.addColorStop(0, "rgba(0,0,0,0.2)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, yTop, iw, yBandEnd - yTop);
      ctx.restore();
    }
    if (!landmarks) return;
    const specIdx = ENAMEL_SPECULAR_INDICES.filter(i => landmarks[i]);
    if (!specIdx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    specIdx.slice(0, 3).forEach(i => {
      const px = landmarks[i].x * iw, py = landmarks[i].y * ih, rad = 5;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, rad);
      rg.addColorStop(0, "rgba(255,255,255,0.7)"); rg.addColorStop(0.55, "rgba(255,255,255,0.15)"); rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };

  const applyTeethWhitening = async (imageSrc, oval, landmarks, bounds) => {
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
        let clipped = landmarks ? generateTeethMask(landmarks, ctx, w, h) : false;
        if (!clipped) { ctx.beginPath(); ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2); ctx.clip(); }
        applyLuminosityWhiteningPass(ctx, w, h, 0.4, landmarks);
        applyEnamelGlossAndGumOcclusion(ctx, w, h, landmarks, oval);
        ctx.restore();
        if (bounds) applyMouthPopFilter(ctx, bounds);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
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

  const applyAlignmentWarp = async (imageSrc, bounds, landmarks, oval, treatment = "alignment") => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
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
        const lipU = landmarks[13], lipL = landmarks[14];
        const midY = lipU && lipL ? ((lipU.y + lipL.y) * 0.5 * canvas.height - y) : height * 0.5;
        const upperCap = Math.floor(clamp(midY - 2, 0, height - 1));

        const topEdge = new Float32Array(width).fill(1e9);
        const valid = new Uint8Array(width);
        for (let cx = 0; cx < width; cx++) {
          for (let cy = 0; cy <= upperCap; cy++) {
            if (!pointInPoly(cx, cy, localPoly)) continue;
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

        // Smooth top edge
        const smoothTop = new Float32Array(width).fill(0);
        for (let cx = 0; cx < width; cx++) {
          let sum = 0;
          let n = 0;
          for (let k = -3; k <= 3; k++) {
            const ix = clamp(cx + k, 0, width - 1);
            if (!valid[ix]) continue;
            sum += topEdge[ix];
            n++;
          }
          smoothTop[cx] = n ? sum / n : upperCap * 0.62;
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

        const archAmp = clamp((treatment === "transformation" ? 0.1 : 0.06) * width, 4, 20);
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
          dxCol[cx] = clamp(-slope * 0.22, -2.4, 2.4);
          if (spanDelta > 1.2 && cx < midX) dxCol[cx] += clamp(spanDelta * 0.08, 0, 2.3);
          if (spanDelta < -1.2 && cx > midX) dxCol[cx] -= clamp(Math.abs(spanDelta) * 0.08, 0, 2.3);
        }

        const slopeAt = (cxCol) => {
          const i0 = clamp(cxCol - 1, 0, width - 1);
          const i1 = clamp(cxCol + 1, 0, width - 1);
          return (smoothTop[i1] - smoothTop[i0]) * 0.5;
        };

        // Texture-preserving inverse warp: local rotation (column pivot) + translation = homography-style enamel move.
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            const oi = (cy * width + cx) * 4;
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const top = smoothTop[cx];
            const depth = clamp((cy - top) / Math.max(upperCap - top + 1, 1), 0, 1);
            const warpW = 1 - depth;
            const tdx = dxCol[cx] * (0.25 + 0.75 * warpW);
            const tdy = dyCol[cx] * (0.2 + 0.8 * warpW);
            const slope = slopeAt(cx);
            const theta = -Math.atan(slope) * (1 - depth) * 0.32;
            const vx = -tdx;
            const vy = cy - top - tdy;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const srx = vx * cosT + vy * sinT;
            const sry = -vx * sinT + vy * cosT;
            const sx = cx + srx;
            const sy = top + sry;
            const smp = sampleRGBA(src, width, height, sx, sy);
            out[oi] = smp[0];
            out[oi + 1] = smp[1];
            out[oi + 2] = smp[2];
            out[oi + 3] = smp[3];
          }
        }

        // Anti-blur protocol: immediate post-warp unsharp to recover enamel edge acuity.
        const warpBlur = new Float32Array(width * height * 3);
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const oi = (cy * width + cx) * 4;
            const bi = (cy * width + cx) * 3;
            warpBlur[bi] = out[oi];
            warpBlur[bi + 1] = out[oi + 1];
            warpBlur[bi + 2] = out[oi + 2];
          }
        }
        const blur3 = (cx, cy) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const nx = clamp(cx + kx, 0, width - 1);
              const ny = clamp(cy + ky, 0, height - 1);
              if (!pointInPoly(nx, ny, localPoly)) continue;
              const bi = (ny * width + nx) * 3;
              r += warpBlur[bi];
              g += warpBlur[bi + 1];
              b += warpBlur[bi + 2];
              n++;
            }
          }
          return n ? [r / n, g / n, b / n] : [0, 0, 0];
        };
        for (let cy = 0; cy < upperCap; cy++) {
          for (let cx = 0; cx < width; cx++) {
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const oi = (cy * width + cx) * 4;
            const [br, bg, bb] = blur3(cx, cy);
            const amt = 0.18;
            out[oi] = clamp(Math.round(out[oi] + amt * (out[oi] - br)), 0, 255);
            out[oi + 1] = clamp(Math.round(out[oi + 1] + amt * (out[oi + 1] - bg)), 0, 255);
            out[oi + 2] = clamp(Math.round(out[oi + 2] + amt * (out[oi + 2] - bb)), 0, 255);
          }
        }

        const enamelLum = (idx) =>
          0.2126 * out[idx] + 0.7152 * out[idx + 1] + 0.0722 * out[idx + 2];

        if (treatment === "transformation") {
          // Digital veneer mirror: if one side is gap-dark and the mirrored side is healthy enamel, clone mirror texture.
          for (let cy = 0; cy < upperCap; cy++) {
            for (let cx = 0; cx < width; cx++) {
              if (!pointInPoly(cx, cy, localPoly)) continue;
              const oi = (cy * width + cx) * 4;
              const lum = enamelLum(oi);
              if (lum > 64) continue;
              const mirrorX = clamp(Math.round(midX + (midX - cx)), 0, width - 1);
              if (!pointInPoly(mirrorX, cy, localPoly)) continue;
              const mi = (cy * width + mirrorX) * 4;
              if (enamelLum(mi) < 88) continue;
              out[oi] = out[mi];
              out[oi + 1] = out[mi + 1];
              out[oi + 2] = out[mi + 2];
            }
          }

          // Smart gap inpaint: distance-weighted clone from adjacent enamel (no stretch-blur).
          for (let cy = 0; cy < upperCap; cy++) {
            for (let cx = 1; cx < width - 1; cx++) {
              if (!pointInPoly(cx, cy, localPoly)) continue;
              const oi = (cy * width + cx) * 4;
              if (enamelLum(oi) > 62) continue;
              let dL = 0;
              let dR = 0;
              let li = -1;
              let ri = -1;
              for (let s = 1; s <= 14; s++) {
                const lx = cx - s;
                if (lx < 0 || !pointInPoly(lx, cy, localPoly)) break;
                const lidx = (cy * width + lx) * 4;
                if (enamelLum(lidx) > 86) {
                  li = lidx;
                  dL = s;
                  break;
                }
              }
              for (let s = 1; s <= 14; s++) {
                const rx = cx + s;
                if (rx >= width || !pointInPoly(rx, cy, localPoly)) break;
                const ridx = (cy * width + rx) * 4;
                if (enamelLum(ridx) > 86) {
                  ri = ridx;
                  dR = s;
                  break;
                }
              }
              if (li >= 0 && ri >= 0) {
                const wL = 1 / (dL + 0.5);
                const wR = 1 / (dR + 0.5);
                const wSum = wL + wR;
                out[oi] = Math.round((out[li] * wL + out[ri] * wR) / wSum);
                out[oi + 1] = Math.round((out[li + 1] * wL + out[ri + 1] * wR) / wSum);
                out[oi + 2] = Math.round((out[li + 2] * wL + out[ri + 2] * wR) / wSum);
              } else if (li >= 0) {
                out[oi] = out[li];
                out[oi + 1] = out[li + 1];
                out[oi + 2] = out[li + 2];
              } else if (ri >= 0) {
                out[oi] = out[ri];
                out[oi + 1] = out[ri + 1];
                out[oi + 2] = out[ri + 2];
              }
            }
          }

          for (let cx = 0; cx < width; cx++) {
            if (valid[cx]) continue;
            const mirrorX = clamp(Math.round(midX + (midX - cx)), 0, width - 1);
            const srcX = valid[mirrorX] ? mirrorX : valid[clamp(cx - 1, 0, width - 1)] ? cx - 1 : cx + 1;
            for (let cy = 0; cy < upperCap; cy++) {
              if (!pointInPoly(cx, cy, localPoly) || !pointInPoly(srcX, cy, localPoly)) continue;
              const oi = (cy * width + cx) * 4;
              const si = (cy * width + srcX) * 4;
              out[oi] = out[si];
              out[oi + 1] = out[si + 1];
              out[oi + 2] = out[si + 2];
            }
          }

          // Ambient occlusion in narrow dark seams (post–gap closure).
          for (let cy = 0; cy < upperCap; cy++) {
            for (let cx = 1; cx < width - 1; cx++) {
              if (!pointInPoly(cx, cy, localPoly)) continue;
              const oi = (cy * width + cx) * 4;
              const l = enamelLum(oi);
              if (l > 72) continue;
              const lL = enamelLum(((cy * width + cx - 1) * 4));
              const lR = enamelLum(((cy * width + cx + 1) * 4));
              if (lL > 95 && lR > 95) {
                const ao = 10;
                out[oi] = clamp(Math.round(out[oi] - ao), 0, 255);
                out[oi + 1] = clamp(Math.round(out[oi + 1] - ao), 0, 255);
                out[oi + 2] = clamp(Math.round(out[oi + 2] - ao), 0, 255);
              }
            }
          }
        }

        // Preserve texture: no heavy bilateral blur. Light interdental shading only.
        for (let cy = 1; cy < height - 1; cy++) {
          for (let cx = 1; cx < width - 1; cx++) {
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const oi = (cy * width + cx) * 4;
            const l = enamelLum(oi);
            if (l < 40) {
              const shade = Math.max(0, 22 - l) * 0.045;
              out[oi] = clamp(Math.round(out[oi] - shade), 0, 255);
              out[oi + 1] = clamp(Math.round(out[oi + 1] - shade), 0, 255);
              out[oi + 2] = clamp(Math.round(out[oi + 2] - shade), 0, 255);
            }
          }
        }

        // Unsharp mask on incisal band (crisp biting edges vs mouth interior).
        const blurScratch = new Float32Array(width * height * 3);
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            const bi = (cy * width + cx) * 3;
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const oi = (cy * width + cx) * 4;
            blurScratch[bi] = out[oi];
            blurScratch[bi + 1] = out[oi + 1];
            blurScratch[bi + 2] = out[oi + 2];
          }
        }
        const box3 = (cx, cy) => {
          let r = 0, g = 0, b = 0, n = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const nx = clamp(cx + kx, 0, width - 1);
              const ny = clamp(cy + ky, 0, height - 1);
              if (!pointInPoly(nx, ny, localPoly)) continue;
              const bi = (ny * width + nx) * 3;
              r += blurScratch[bi];
              g += blurScratch[bi + 1];
              b += blurScratch[bi + 2];
              n++;
            }
          }
          if (!n) return [0, 0, 0];
          return [r / n, g / n, b / n];
        };
        const unsharpAmt = treatment === "transformation" ? 0.55 : 0.42;
        const incisalBand = 4;
        for (let cy = 0; cy < height; cy++) {
          for (let cx = 0; cx < width; cx++) {
            if (!pointInPoly(cx, cy, localPoly)) continue;
            const top = smoothTop[cx];
            if (cy < top || cy > top + incisalBand + 6) continue;
            const distIncisal = Math.abs(cy - top);
            if (distIncisal > incisalBand) continue;
            const oi = (cy * width + cx) * 4;
            const [br, bg, bb] = box3(cx, cy);
            const k = unsharpAmt * (1 - distIncisal / (incisalBand + 0.01));
            out[oi] = clamp(Math.round(out[oi] + k * (out[oi] - br)), 0, 255);
            out[oi + 1] = clamp(Math.round(out[oi + 1] + k * (out[oi + 1] - bg)), 0, 255);
            out[oi + 2] = clamp(Math.round(out[oi + 2] + k * (out[oi + 2] - bb)), 0, 255);
          }
        }

        ctx.putImageData(outImg, x, y);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("Could not load image for alignment"));
      img.src = imageSrc;
    });
  };

  const cropMouthRegion = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
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
    const c1 = document.createElement("canvas"); c1.width = nw; c1.height = nh;
    c1.getContext("2d").drawImage(mouthImg, 0, 0, nw, nh);
    const maskImg = await loadImage(maskDataUrl);
    const c2 = document.createElement("canvas"); c2.width = nw; c2.height = nh;
    c2.getContext("2d").drawImage(maskImg, 0, 0, nw, nh);
    return { mouth: c1.toDataURL("image/jpeg", 0.88), mask: c2.toDataURL("image/png") };
  };

  const createTeethMaskForCrop = async (mouthImageSrc, cw, ch, ovalInCrop) => {
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, cw, ch);
    const img = await loadImage(mouthImageSrc);
    const src = document.createElement("canvas");
    src.width = cw; src.height = ch;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, cw, ch);
    const frame = sctx.getImageData(0, 0, cw, ch).data;
    const { cx, cy, rx, ry } = ovalInCrop;
    const out = ctx.getImageData(0, 0, cw, ch);
    const od = out.data;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const nx = (x - cx) / Math.max(rx, 1), ny = (y - cy) / Math.max(ry, 1);
        if (nx * nx + ny * ny > 1.06) continue;
        const i = (y * cw + x) * 4;
        const r = frame[i], g = frame[i+1], b = frame[i+2];
        const maxc = Math.max(r,g,b), minc = Math.min(r,g,b);
        const lum = 0.2126*r + 0.7152*g + 0.0722*b;
        const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
        if (lum < ENAMEL_LUM_MIN || lum > ENAMEL_LUM_MAX || sat > ENAMEL_SAT_MAX) continue;
        od[i] = od[i+1] = od[i+2] = od[i+3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    ctx.filter = `blur(${MASK_CLIP_FEATHER_PX}px)`;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    return canvas.toDataURL("image/png");
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

  const mergeFinalImage = async (originalSrc, mouthEnhancedSrc, bounds, oval) => {
    const [original, mouth] = await Promise.all([loadImage(originalSrc), loadImage(mouthEnhancedSrc)]);
    const canvas = document.createElement("canvas");
    canvas.width = original.width; canvas.height = original.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(original, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = imageData.data;
    const tmp = document.createElement("canvas");
    tmp.width = bounds.width; tmp.height = bounds.height;
    tmp.getContext("2d").drawImage(mouth, 0, 0, mouth.width, mouth.height, 0, 0, bounds.width, bounds.height);
    const mouthPixels = tmp.getContext("2d").getImageData(0, 0, bounds.width, bounds.height).data;
    for (let py = bounds.y; py < bounds.y + bounds.height; py++) {
      for (let px = bounds.x; px < bounds.x + bounds.width; px++) {
        const w = ellipseFeatherWeight(px, py, oval, OVAL_FEATHER_PX);
        if (w <= 0) continue;
        const oi = (py * canvas.width + px) * 4;
        const mi = ((py - bounds.y) * bounds.width + (px - bounds.x)) * 4;
        out[oi]   = Math.round(out[oi]   * (1-w) + mouthPixels[mi]   * w);
        out[oi+1] = Math.round(out[oi+1] * (1-w) + mouthPixels[mi+1] * w);
        out[oi+2] = Math.round(out[oi+2] * (1-w) + mouthPixels[mi+2] * w);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95);
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
    const captured = canvas.toDataURL("image/jpeg", 0.88);
    stopCamera();
    processWithAI(captured).catch(err => { setError(err?.message || "Could not process this photo."); setStep("upload"); });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const normalized = await normalizeImage(ev.target.result, 1024);
        await processWithAI(normalized);
      } catch (err) {
        setError(err?.message || "Could not process this image.");
        setStep("upload");
      }
    };
    reader.onerror = () => { setError("Could not read this file."); setStep("upload"); };
    reader.readAsDataURL(file);
  };

  // ── Main AI pipeline ─────────────────────────────────────────────────
  const processWithAI = async (baseImage) => {
    setStep("processing");
    setError(null);
    setActiveTreatment(selectedTreatment);

    try {
      const normalized = await normalizeImage(baseImage, 1024);
      const mouth = await detectMouth(normalized);

      if (!mouth.bounds || !mouth.oval) {
        setError("Keep your mouth slightly open so we can see your teeth clearly, then try again.");
        setStep("upload");
        return;
      }

      const { bounds, oval, landmarks } = mouth;
      const fullFrame = await loadImage(normalized);
      let canvasEnhanced = normalized;

      // Whitening pass (for whitening, transformation, braces)
      if (["whitening", "transformation", "braces"].includes(selectedTreatment)) {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, oval, landmarks, bounds);
      }
      // Alignment pass
      if (["alignment", "transformation"].includes(selectedTreatment)) {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds, landmarks, oval, selectedTreatment);
      }

      const mouthCrop = await cropMouthRegion(canvasEnhanced, bounds);
      let aiPolishedCrop = null;

      // AI Replicate pass (skip braces — vector overlay handles it)
      const useReplicatePolish = selectedTreatment !== "braces";
      if (useReplicatePolish && AI_SMILE_API) {
        const replicateTreatment = selectedTreatment === "transformation" ? "transformation" : selectedTreatment;
        const midlineXNorm = getFacialMidlineXNorm(landmarks);
        let ovalInCrop = { cx: oval.cx - bounds.x, cy: oval.cy - bounds.y, rx: oval.rx, ry: oval.ry };
        const mask = await createTeethMaskForCrop(mouthCrop, bounds.width, bounds.height, ovalInCrop);
        try {
          const { mouth: apiMouth, mask: apiMask } = await scaleMouthAndMaskForApi(mouthCrop, mask, API_MOUTH_MAX_EDGE);
          aiPolishedCrop = await enhanceWithAI(apiMouth, apiMask, replicateTreatment, midlineXNorm);
        } catch {
          aiPolishedCrop = null;
        }
      }

      // Merge AI result back into full frame
      let merged = await mergeFinalImage(normalized, aiPolishedCrop || mouthCrop, bounds, oval);

      // Braces vector overlay (FIXED: uses clean pipeline)
      if (selectedTreatment === "braces") {
        merged = await applyBracesOverlay(merged, fullFrame.width, fullFrame.height);
      }

      const previewRect  = squareCropRect(fullFrame.width, fullFrame.height, oval);
      const beforeSquare = await cropImageToDataUrl(normalized, previewRect);
      const afterSquare  = await cropImageToDataUrl(merged, previewRect);

      setBeforeImage(beforeSquare);
      setAfterImage(afterSquare);
      setStep("result");
    } catch (err) {
      setError(err?.message || "Simulation failed.");
      setStep("upload");
    }
  };

  const reset = () => {
    stopCamera();
    setStep("upload");
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
        <AnimatedSection className="mx-auto mb-12 flex justify-center">
          <div className="inline-flex items-center gap-4 rounded-full border border-[rgba(255,255,255,0.1)] bg-zinc-950/62 px-5 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
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
                      CENTER TEETH WITHIN THE FRAME
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
                <p className="text-lg font-serif text-zinc-800 animate-pulse">Designing your future smile…</p>
                <p className="text-sm text-zinc-400 mt-2">This may take up to 30 seconds</p>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <motion.div
                  className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/20 bg-black w-full max-w-lg mx-auto aspect-square max-h-[min(92vw,560px)] origin-center"
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
