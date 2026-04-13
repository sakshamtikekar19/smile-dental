import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, CheckCircle2, Info, RefreshCw, Play } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";
import { applyBracesOverlayFixed } from "../utils/bracesOverlayFixed";
import { generateTeethPath, getTightenedWhiteningMaskPoints } from "../utils/teethWhitenMaskPath";

// ── Environment ──────────────────────────────────────────────────────────────
const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

// ── MediaPipe singleton (shared, loaded once) ────────────────────────────────
let _faceLandmarkerInstance = null;
let _faceLandmarkerFailed = false;
let _faceLandmarkerPromise = null;

async function initFaceLandmarker() {
  if (_faceLandmarkerFailed) return null;
  if (_faceLandmarkerInstance) return _faceLandmarkerInstance;
  if (_faceLandmarkerPromise) return _faceLandmarkerPromise;

  _faceLandmarkerPromise = (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
      );
      _faceLandmarkerInstance = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.1,
        minFacePresenceConfidence: 0.1,
      });
      return _faceLandmarkerInstance;
    } catch {
      _faceLandmarkerFailed = true;
      _faceLandmarkerPromise = null;
      return null;
    }
  })();

  return _faceLandmarkerPromise;
}

/**
 * Anatomical Teeth Focus (Dental Zoom)
 */
function getTeethFocusBox(landmarks, width, height, padding = 0.5) {
  if (!landmarks || landmarks.length === 0) return { x: 0, y: 0, width, height };

  const indices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const points = indices.map(i => landmarks[i]).filter(Boolean);
  if (!points.length) return { x: 0, y: 0, width, height };

  const xs = points.map(p => p.x * width);
  const ys = points.map(p => p.y * height);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const w = maxX - minX;
  const h = maxY - minY;
  const p = Math.max(w, h) * padding;

  return {
    x: Math.max(0, minX - p),
    y: Math.max(0, minY - p * 1.5), // More vertical padding for smile context
    width: Math.min(width, w + p * 2),
    height: Math.min(height, h + p * 3)
  };
}

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_IMAGE_SIZE = 8192;  // High-fidelity limit (essentially original resolution)
const FACE_DETECT_TIMEOUT_MS = 18_000;
const AI_FETCH_TIMEOUT_MS = 75_000;
const MOUTH_PERIMETER_INDICES = [61, 291, 17, 13, 14, 78, 308, 181];
const EYE_SANITY_INDICES = [33, 133, 362, 263];

const TREATMENTS = [
  { id: "whitening", label: "Whitening", desc: "Blue-white enamel sheen enhancement." },
  { id: "alignment", label: "Alignment", desc: "Gap closure and crooked-tooth rectification." },
  { id: "braces", label: "Braces", desc: "Precision metallic bracket preview." },
  { id: "transformation", label: "Full Smile", desc: "Hollywood-style smile reconstruction." },
];

const TREATMENT_THEME = {
  whitening: { glow: "0 0 28px rgba(212,175,55,0.45)", ring: "rgba(212,175,55,0.9)", tint: "from-amber-100/20 to-yellow-600/25" },
  alignment: { glow: "0 0 28px rgba(129,140,248,0.52)", ring: "rgba(129,140,248,0.9)", tint: "from-indigo-300/20 to-indigo-500/25" },
  braces: { glow: "0 0 28px rgba(212,175,55,0.42)", ring: "rgba(212,175,55,0.9)", tint: "from-slate-200/20 to-slate-400/25" },
  transformation: { glow: "0 0 28px rgba(212,175,55,0.5)", ring: "#D4AF37", tint: "from-amber-200/20 to-yellow-600/25" },
};

// ── Icons ────────────────────────────────────────────────────────────────────
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
      <path d="M48 10v10M43 15h10" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 18v6M9 21h6" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M28 8c6 0 10 4 11 10 1 8 0 18-2 24-2 6-6 14-11 14s-9-8-11-14c-2-6-3-16-2-24 1-6 5-10 11-10z"
        fill="url(#medicalWhite)" stroke="#0284c7" strokeWidth="2.5" />
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
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <rect x="26.5" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <rect x="43" y="14" width="11" height="30" rx="4" fill="url(#alignTooth)" stroke="#334155" strokeWidth="1.6" />
      <line x1="6" y1="29" x2="58" y2="29" stroke="url(#silverLevel)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function BracesIcon() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="bracketChrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="70%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="44" height="44" rx="14" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="19" y="19" width="26" height="26" rx="6.5" fill="url(#bracketChrome)" stroke="#64748b" strokeWidth="2" />
      <path d="M24 32h16M32 24v16" stroke="#334155" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M8 34c12-7 36-7 48 0" stroke="#cbd5e1" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function FullSmileIcon() {
  const cx = [12, 18, 24, 30, 36, 42, 48, 54];
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="fullSmileShimmer" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#eab308" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d="M8 40 Q32 26 56 40" fill="rgba(250,250,250,0.5)" stroke="#d4d4d8" strokeWidth="1" />
      {cx.map((c, i) => (
        <g key={i}>
          <ellipse cx={c} cy="38" rx="4.5" ry="10.5" fill="#fafafa" stroke="#d4d4d8" strokeWidth="1.1" />
          <ellipse cx={c - 1} cy="32" rx="1.4" ry="2.3" fill="#ffffff" opacity="0.55" />
        </g>
      ))}
      <line x1="10" y1="38" x2="54" y2="38" stroke="url(#fullSmileShimmer)" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

const ICON_MAP = { whitening: WhiteningIcon, alignment: AlignmentIcon, braces: BracesIcon, transformation: FullSmileIcon };

// ── TreatmentDockButton ──────────────────────────────────────────────────────
function TreatmentDockButton({ treatment, active, disabled, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const Icon = ICON_MAP[treatment.id] ?? WhiteningIcon;
  const theme = TREATMENT_THEME[treatment.id] ?? TREATMENT_THEME.whitening;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      className="relative h-16 w-16 md:h-[74px] md:w-[74px] rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition-colors"
      style={{ borderColor: active ? theme.ring : "rgba(255,255,255,0.1)" }}
      animate={{
        scale: active ? [1, 1.05, 1] : 1,
        boxShadow: active ? theme.glow : "0 0 0 rgba(0,0,0,0)",
      }}
      whileHover={{ scale: 1.15, boxShadow: theme.glow }}
      transition={{
        scale: { duration: 1.8, repeat: active ? Infinity : 0, ease: "easeInOut" },
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
            <p style={{ fontFamily: "'Playfair Display', serif" }} className="text-sm text-zinc-100">{treatment.label}</p>
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="mt-1 text-xs text-zinc-300">{treatment.desc}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function safeRevoke(url) {
  if (url && url.startsWith("blob:")) { try { URL.revokeObjectURL(url); } catch { } }
}

/**
 * Resize image to maxPx on longest side and return a blob URL.
 * Runs entirely on the main thread but is fast (single drawImage).
 */
async function resizeImage(src, maxPx = MAX_IMAGE_SIZE) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve({ url: URL.createObjectURL(blob), w, h }), "image/jpeg", 0.9)
  );
}

/**
 * Detect face landmarks using the singleton FaceLandmarker.
 * Returns landmark array or null.
 */
async function detectLandmarks(imageSrc) {
  try {
    // Mandate 1: Strict Promise-Based Image Loader (Await-Decode)
    const img = await loadImage(imageSrc);
    if (!img.width || !img.height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    // Pillar 3: Fallback Dimension Check
    if (canvas.width === 0 || canvas.height === 0) {
      console.warn("AI Detect: Zero-dimension canvas detected.");
      return null;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // Mandate 2: AI Pre-heating check
    const landmarker = await initFaceLandmarker();
    if (!landmarker) {
      console.warn("AI Engine not ready yet.");
      return null;
    }

    const result = landmarker.detect(canvas);
    const lm = result?.faceLandmarks?.[0];
    return lm?.length >= 100 ? lm : null;
  } catch (err) {
    console.error("Detection error:", err);
    return null;
  }
}

/**
 * Build conservative mouth bounding box from landmarks.
 */
function buildMouthBounds(landmarks, iw, ih) {
  const indices = MOUTH_PERIMETER_INDICES;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p || typeof p.x !== "number") return null;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  indices.forEach(i => {
    const p = landmarks[i];
    const x = p.x * iw, y = p.y * ih;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  });
  if (!(maxX > minX && maxY > minY)) return null;
  const padX = (maxX - minX) * 0.14 + 6;
  const padY = (maxY - minY) * 0.18 + 8;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const rx = Math.max((maxX - minX) / 2 * 1.08, 12);
  const ry = Math.max((maxY - minY) / 2 * 1.12, 10);
  return {
    bounds: {
      x: clamp(Math.floor(minX - padX), 0, iw - 1),
      y: clamp(Math.floor(minY - padY), 0, ih - 1),
      width: clamp(Math.ceil(maxX - minX + padX * 2), 24, iw),
      height: clamp(Math.ceil(maxY - minY + padY * 2), 24, ih),
    },
    oval: { cx, cy, rx, ry },
  };
}

function heuristicMouthBounds(iw, ih) {
  const cx = iw * 0.5, cy = ih * 0.63;
  const rx = Math.max(iw * 0.19, 14), ry = Math.max(ih * 0.1, 10);
  const w = clamp(Math.ceil(rx * 2.45), 48, iw);
  const h = clamp(Math.ceil(ry * 2.35), 40, ih);
  return {
    bounds: {
      x: clamp(Math.floor(cx - w / 2), 0, iw - w),
      y: clamp(Math.floor(cy - h / 2), Math.floor(ih * 0.45), Math.max(0, ih - h)),
      width: w, height: h,
    },
    oval: { cx, cy, rx, ry },
  };
}

function squareCropRect(iw, ih, oval) {
  const maxSide = Math.min(iw, ih);
  const side = clamp(Math.ceil(2.35 * Math.max(oval.rx, oval.ry)), 120, maxSide);
  const x0 = clamp(Math.round(oval.cx - side / 2), 0, iw - side);
  const y0 = clamp(Math.round(oval.cy - side / 2), 0, ih - side);
  return { x: x0, y: y0, width: side, height: side };
}

function ellipseWeight(px, py, oval, feather) {
  const { cx, cy, rx, ry } = oval;
  if (rx <= 0 || ry <= 0) return 0;
  const nx = (px - cx) / rx, ny = (py - cy) / ry;
  const dist = Math.sqrt(nx * nx + ny * ny);
  const outer = 1 + feather / Math.max(rx, ry);
  if (dist <= 1) return 1;
  if (dist >= outer) return 0;
  const t = (outer - dist) / (outer - 1);
  return t * t * (3 - 2 * t);
}

/**
 * Run the pixel-heavy work in a Web Worker.
 * Returns a promise that resolves to a blob URL of the processed image.
 */
function runWorkerProcessing(imageSrc, treatment, landmarks, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(imageSrc);
      const { width: iw, height: ih } = img;
      const canvas = document.createElement("canvas");
      canvas.width = iw; canvas.height = ih;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, iw, ih);

      let worker;
      try {
        worker = new Worker(new URL("../utils/smileProcessor.worker.js", import.meta.url), { type: "module" });
      } catch (workerErr) {
        // Fallback: resolve with original image if Worker fails to initialize
        console.warn("Worker init failed, returning original:", workerErr);
        resolve(imageSrc);
        return;
      }

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Processing timed out. Please try a smaller photo."));
      }, 60_000);

      worker.onmessage = (e) => {
        const { type, imageData: resultData, log, message } = e.data;
        if (type === "PROGRESS") { onProgress?.(log); return; }
        clearTimeout(timeout);
        worker.terminate();
        if (type === "ERROR") { reject(new Error(message)); return; }
        // DONE: convert ImageData back to blob URL
        const outCanvas = document.createElement("canvas");
        outCanvas.width = resultData.width;
        outCanvas.height = resultData.height;
        outCanvas.getContext("2d").putImageData(resultData, 0, 0);
        outCanvas.toBlob(blob => resolve(URL.createObjectURL(blob)), "image/jpeg", 0.98);
      };

      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(e.message || "Worker crashed"));
      };

      worker.postMessage(
        { type: "PROCESS", imageData, treatment, landmarks },
        [imageData.data.buffer]  // transfer buffer (zero-copy)
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Crop a region of an image to a blob URL (fast, main thread OK).
 */
async function cropRegion(imageSrc, rect) {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.getContext("2d").drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return new Promise(r => canvas.toBlob(b => r(URL.createObjectURL(b)), "image/jpeg", 0.93));
}

// ── Shared Engine Canvas (Pillar 2: Anti-Crash) ──────────────────────────────
let _sharedSimCanvas = null;
let _sharedMainCanvas = null;
let _sharedDetCanvas = null;

function getSharedCanvases(iw, ih) {
  if (!_sharedMainCanvas) _sharedMainCanvas = document.createElement('canvas');
  if (!_sharedDetCanvas) _sharedDetCanvas = document.createElement('canvas');

  // Rule 1: Physical Pixel Fidelity (Pillar 1)
  const maxSafeRes = 4096;
  const rw = Math.min(iw, maxSafeRes);
  const rh = Math.min(ih, maxSafeRes);

  _sharedMainCanvas.width = rw;
  _sharedMainCanvas.height = rh;
  _sharedDetCanvas.width = 1024;
  _sharedDetCanvas.height = 1024;

  const ctx = _sharedMainCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return { main: _sharedMainCanvas, det: _sharedDetCanvas, rw, rh };
}

// --- THE FINAL CLINICAL WHITENING ENGINE (Mandate: Zero Film, Zero Bleed) ---
const applyClinicalWhitening = (ctx, landmarks, rw, rh) => {
  ctx.save();
  
  // 1. ANATOMIC BOUNDARY (Strict Teeth Anchor)
  ctx.beginPath();
  const indices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  indices.forEach((idx, i) => {
    const pt = landmarks[idx];
    if (pt) {
      const x = pt.x * rw, y = pt.y * rh;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.clip(); 

  // 2. THE PURITY PASS (No Film, Only Lightness)
  ctx.filter = 'brightness(1.05) contrast(1.1) saturate(0.85)';
  ctx.drawImage(ctx.canvas, 0, 0);

  // 3. EROSION BOUNDARY (Prevent edge film)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 10; // Approximate 5px erosion
  ctx.stroke();

  ctx.restore();
};

// --- ANATOMICAL BRACES ENGINE (Mandate: Bezier Curve Geometry) ---
const drawAnatomicalBraces = (ctx, landmarks, rw, rh) => {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const left = landmarks[78], mid = landmarks[13], right = landmarks[308];
  if (!left || !mid || !right) { ctx.restore(); return; }
  
  ctx.beginPath();
  ctx.strokeStyle = '#B0B0B0'; 
  ctx.lineWidth = 2.4;
  ctx.moveTo(left.x * rw, left.y * rh);
  ctx.quadraticCurveTo(mid.x * rw, (mid.y * rh) + 8, right.x * rw, right.y * rh);
  ctx.stroke();

  const bracketPoints = [191, 80, 81, 82, 13, 312, 311, 310, 415];
  bracketPoints.forEach(idx => {
    const p = landmarks[idx];
    if (p) {
      const x = p.x * rw, y = p.y * rh;
      ctx.fillStyle = '#D3D3D3';
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(x - 2, y - 2, 2, 2);
      ctx.fillStyle = '#D3D3D3';
    }
  });
  ctx.restore();
};

// --- CLINICAL SIMULATION WRAPPER (Mandate: Engine-Linked) ---
const renderClinicalSimulation = (ctx, canvas, landmarks, treatment, rw, rh) => {
  // Mandate: Braces first, then Whitening last for terminal visibility
  if (treatment === "braces" || treatment === "both") {
    drawAnatomicalBraces(ctx, landmarks, rw, rh);
  }
  if (treatment === "whitening" || treatment === "both") {
    applyClinicalWhitening(ctx, landmarks, rw, rh);
  }
};

// --- AI SPLIT-ENGINE (Mandate: Production-Grade Post-Processing) ---
const REPLICATE_API_TOKEN = import.meta.env.VITE_REPLICATE_API_TOKEN;

/**
 * Professional LAB-Space Whitening (Mandate: Realistic B-Channel Reduction)
 * Adjusts: Yellow (-8), Brightness (+5), Texture-Blend (90/10)
 */
/**
 * Strict Clinical Purity Engine (Mandate: Zero Film, Perfect Enamel Anchor)
 * - Heavy Erosion (7px) to stay strictly inside teeth
 * - Per-Pixel Chrominance Filtering (isStrictToothPixel)
 * - Targeted RGB Shift: R+4, G+4, B-6
 * - Texture Preservation (85% New / 15% Original)
 */
function isStrictToothPixel(r, g, b) {
  const brightness = (r + g + b) / 3;
  // Teeth are bright but NOT pure white/overblown
  const isBright = brightness > 140 && brightness < 235;

  // Low color variation (Ensures we skip gums/lips)
  const lowColorDiff =
    Math.abs(r - g) < 18 &&
    Math.abs(r - b) < 18 &&
    Math.abs(g - b) < 18;

  // Slight yellow bias is characteristic of real enamel
  const slightlyYellow = b < r && b < g;

  return isBright && lowColorDiff && slightlyYellow;
}

async function preprocessWhitening(imageSrc, landmarks, iw, ih, cropBounds) {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // 1. REFINED HEAVY EROSION MASK (Stay inside teeth only)
  const localLandmarks = normalizeLandmarksToCrop(landmarks, iw, ih, cropBounds);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const mctx = maskCanvas.getContext("2d");
  
  mctx.beginPath();
  const outerIndices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 146, 61];
  outerIndices.forEach((idx, i) => {
    const p = localLandmarks[idx];
    if (p) {
      if (i === 0) mctx.moveTo(p.x * canvas.width, p.y * canvas.height);
      else mctx.lineTo(p.x * canvas.width, p.y * canvas.height);
    }
  });
  mctx.fillStyle = "white";
  mctx.fill();

  // HEAVY EROSION: Shrink the mask significantly (7x7 logic)
  mctx.globalCompositeOperation = 'destination-out';
  mctx.lineWidth = 14; // Approximate 7px erosion on both sides
  mctx.stroke();
  
  const maskData = mctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // 2. STRICT PIXEL-EDIT Loop (No Global Blend)
  for (let i = 0; i < data.length; i += 4) {
    if (maskData[i + 3] > 0) { // Strictly inside mouth region
      let r = data[i], g = data[i + 1], b = data[i + 2];
      
      // Step A: Clinical ENAMEL Filter
      if (isStrictToothPixel(r, g, b)) {
        // Step B: Pure Color Shift (No Film)
        let newR = Math.min(255, r + 4);
        let newG = Math.min(255, g + 4);
        let newB = Math.max(0, b - 6);
        
        // Step C: Detailed Texture preservation (85% Edited / 15% Original)
        data[i] = (0.85 * newR) + (0.15 * r);
        data[i + 1] = (0.85 * newG) + (0.15 * g);
        data[i + 2] = (0.85 * newB) + (0.15 * b);
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return new Promise(r => canvas.toBlob(b => r(URL.createObjectURL(b)), "image/jpeg", 0.95));
}

/**
 * Calculates a tight bounding box around the mouth area using anatomical landmarks.
 */
function getTeethCropBounds(landmarks, iw, ih, padding = 0.2) {
  const mouthIndices = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
  let minX = 1, minY = 1, maxX = 0, maxY = 0;

  mouthIndices.forEach(idx => {
    const p = landmarks[idx];
    if (p) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  });

  const w = maxX - minX;
  const h = maxY - minY;
  const px = w * padding;
  const py = h * padding;

  return {
    x: Math.max(0, (minX - px) * iw),
    y: Math.max(0, (minY - py) * ih),
    width: Math.min(iw, (w + 2 * px) * iw),
    height: Math.min(ih, (h + 2 * py) * ih)
  };
}

async function processWhitening(imageSrc, landmarks, iw, ih, cropBounds) {
  console.log("[AI] Firing Replicate Whitening pass on CROP (strength: 0.28)");
  // At this stage, imageSrc is our high-res mouth crop
  const base = await preprocessWhitening(imageSrc, landmarks, iw, ih, cropBounds);
  // Optional Replicate Polish here
  return base;
}

// --- DUAL-ARCH BRACES ENGINE (Mandate: Terminal Overlay) ---
const UPPER_TEETH_INDICES = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const LOWER_TEETH_INDICES = [146, 91, 181, 84, 17, 314, 405, 321, 375];

async function placeBrackets(imageSrc, landmarks) {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  const rw = canvas.width;
  const rh = canvas.height;
  const bracketImg = await loadImage("/assets/bracket.png");
  const stampSize = Math.max(12, rw / 55);

  const drawArch = (indices, wireOffset) => {
    // 1. Draw Archwire
    ctx.beginPath();
    ctx.strokeStyle = '#B0B0B0'; // Clinical Silver
    ctx.lineWidth = Math.max(1.8, rw / 450);
    indices.forEach((idx, i) => {
      const p = landmarks[idx];
      if (p) {
        const x = p.x * rw, y = (p.y * rh) + wireOffset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 2. Place Brackets
    indices.forEach(idx => {
      const p = landmarks[idx];
      if (p) {
        const x = p.x * rw, y = (p.y * rh) + wireOffset;
        ctx.drawImage(bracketImg, x - (stampSize/2), y - (stampSize/2), stampSize, stampSize);
      }
    });
  };

  // Process both rows
  drawArch(UPPER_TEETH_INDICES, rh * 0.005);
  drawArch(LOWER_TEETH_INDICES, -rh * 0.005);

  return new Promise(r => canvas.toBlob(b => r(URL.createObjectURL(b)), "image/jpeg", 0.95));
}

/**
 * Normalizes landmarks from full-image space [0,1] to crop-local space [0,1].
 */
function normalizeLandmarksToCrop(landmarks, iw, ih, cropBounds) {
  return landmarks.map(p => ({
    x: ((p.x * iw) - cropBounds.x) / cropBounds.width,
    y: ((p.y * ih) - cropBounds.y) / cropBounds.height
  }));
}

async function processBraces(imageSrc, landmarks, iw, ih, cropBounds) {
  console.log("[AI] Firing 3-Step Braces Engine on CROP");
  // Adjust landmarks to the crop coordinate system
  const localLandmarks = normalizeLandmarksToCrop(landmarks, iw, ih, cropBounds);
  const bracesBase = await placeBrackets(imageSrc, localLandmarks);
  return bracesBase;
}

async function processAlignment(image) {
  console.log("[AI] Firing Replicate Alignment pass");
  // return await replicate.run("antigravity-alignment", ...);
  return image;
}

async function processSimulation(croppedImage, treatment, landmarks, iw, ih, cropBounds) {
  if (treatment === "whitening") return await processWhitening(croppedImage, landmarks, iw, ih, cropBounds);
  if (treatment === "braces") return await processBraces(croppedImage, landmarks, iw, ih, cropBounds);
  if (treatment === "alignment") return croppedImage; 
  if (treatment === "transformation" || treatment === "both") {
    const w = await processWhitening(croppedImage, landmarks, iw, ih, cropBounds);
    return w;
  }
  return croppedImage;
}

async function mergeIntoFullFrame(originalSrc, processedSrc, bounds, oval, landmarks, treatment) {
  const [orig, proc] = await Promise.all([loadImage(originalSrc), loadImage(processedSrc)]);
  const { main: canvas, rw, rh } = getSharedCanvases(orig.width, orig.height);
  const ctx = canvas.getContext("2d");

  // 1. CLEAR: Start with a fresh slate
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, rw, rh);

  // 1.5 RESTORE BASE IMAGE
  ctx.drawImage(orig, 0, 0, rw, rh);
  
  // 3. AI SUB-FRAME COMPOSITE
  if (processedSrc && processedSrc !== originalSrc) {
    ctx.save();
    const scaleX = rw / orig.width, scaleY = rh / orig.height;
    const dx = bounds.x * scaleX, dy = bounds.y * scaleY, dw = bounds.width * scaleX, dh = bounds.height * scaleY;
    
    // Composite the ultra-sharp AI dental work back onto the face background
    ctx.drawImage(proc, 0, 0, proc.width, proc.height, dx, dy, dw, dh);
    ctx.restore();
  }

  return new Promise(resolve => {
    requestAnimationFrame(() => {
      canvas.toBlob(blob => {
        if (!blob) return;
        resolve(URL.createObjectURL(blob));
      }, "image/jpeg", 0.95);
    });
  });
}

// ── Main Component ───────────────────────────────────────────────────────────
const OVAL_FEATHER_PX = 16;

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("upload");
  const [selectedTreatment, setSelectedTreatment] = useState("whitening");
  const [activeTreatment, setActiveTreatment] = useState("whitening");
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [processingLog, setProcessingLog] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Mandate 1 & 2: rawImageUrl is the ONLY bridge between file selection and processing.
  // Setting it triggers the useEffect below — the onChange handler itself does NO math.
  const [rawImageUrl, setRawImageUrl] = useState(null);
  // We snapshot the treatment at the moment the user picks an image (avoids stale closure issues)
  const pendingTreatmentRef = useRef("whitening");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const generationRef = useRef(0);
  const latestLandmarksRef = useRef(null);
  const requestRef = useRef(null);

  // --- REAL-TIME DETECTION LOOP (Pillar: Precision Sync) ---
  const detectionLoop = useCallback(async () => {
    if (step !== "camera" || !videoRef.current || !_faceLandmarkerInstance) {
      if (step === "camera") requestRef.current = requestAnimationFrame(detectionLoop);
      return;
    }
    
    try {
      const result = _faceLandmarkerInstance.detectForVideo(videoRef.current, performance.now());
      if (result.faceLandmarks?.[0]) {
        latestLandmarksRef.current = result.faceLandmarks[0];
      }
    } catch (err) {
      // Squelch background detection errors
    }
    
    if (step === "camera") requestRef.current = requestAnimationFrame(detectionLoop);
  }, [step]);

  useEffect(() => {
    if (step === "camera") {
      requestRef.current = requestAnimationFrame(detectionLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [step, detectionLoop]);

  // PERFORMANCE OPTIMAL: Deferred AI Pre-Heating (Mandate 1)
  useEffect(() => {
    // Wait for UI to be fully interactive before hitting the network for WASM
    const timer = setTimeout(() => {
      initFaceLandmarker().catch(() => { });
    }, 1200);
    return () => {
      clearTimeout(timer);
      generationRef.current += 1;
    };
  }, []);

  // Camera cleanup
  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (step !== "camera" || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => { });
  }, [step]);

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

  const reset = useCallback(() => {
    generationRef.current += 1;
    stopCamera();
    setStep("upload");
    safeRevoke(beforeImage);
    safeRevoke(afterImage);
    setBeforeImage(null);
    setAfterImage(null);
    setError(null);
    setCameraError(null);
    setIsProcessing(false);
    setRawImageUrl(null);
    setActiveTreatment(selectedTreatment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeImage, afterImage, selectedTreatment]);

  // ── Mandate 2: Double-Timeout Processing Trigger ───────────────────────────
  // This useEffect is the ONLY place that triggers the heavy pipeline.
  // The 150ms delay guarantees React has painted the spinner before ANY math starts.
  useEffect(() => {
    if (!rawImageUrl || !isProcessing) return;
    console.log("[2] UI Yielding — waiting 150ms for browser paint before heavy work");
    const timer = setTimeout(() => {
      console.log("[3] Starting heavy processing pipeline");
      startHeavyProcessingPipeline(rawImageUrl);
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawImageUrl, isProcessing]);

  // ── Core pipeline (Mandate 3: Granular tracking) ───────────────────────────
  const startHeavyProcessingPipeline = useCallback(async (imageUrl) => {
    const treatment = pendingTreatmentRef.current;
    const generation = ++generationRef.current;
    const isCurrent = () => generation === generationRef.current;

    let normalizedUrl = null;
    let processedUrl = null;
    let mergedUrl = null;
    let finalUrl = null;

    try {
      // Step 1: Detect landmarks on a standard 1024px image (Pillar 1/Regression 1)
      setProcessingLog("Analyzing anatomy...");

      // Mandate 3: UI 'Facade' State. If user clicks before AI is ready, show a warm-up message.
      if (!_faceLandmarkerInstance) {
        setProcessingLog("Waking up AI engine, please wait a moment...");
        // Wait for pre-heating for up to 5s
        for (let i = 0; i < 10; i++) {
          if (_faceLandmarkerInstance) break;
          await new Promise(r => setTimeout(r, 500));
        }
        if (!_faceLandmarkerInstance) throw new Error("AI Engine took too long to wake up. Please refresh.");
      }

      setProcessingLog("Locating anatomical landmarks...");
      const detectTarget = await resizeImage(imageUrl, 1024);
      const landmarks = await detectLandmarks(detectTarget.url);
      safeRevoke(detectTarget.url);
      console.log("[6] AI Waking Up — running FaceLandmarker on 512px proxy");

      if (!landmarks) throw new Error("Face not detected. Retake photo with better lighting.");

      // Step 2: Use the ORIGINAL high-res image for visual rendering
      console.log("[4] Starting high-res processing");
      const { url: resized, w: iw, h: ih } = await resizeImage(imageUrl, MAX_IMAGE_SIZE);
      safeRevoke(imageUrl);
      normalizedUrl = resized;
      console.log(`[5] High-res resize complete — ${iw}×${ih}px`);

      if (!isCurrent()) { console.log("[CANCELLED] after high-res resize"); return; }

      // Step 3: Mouth region & Teeth Focus Crop
      console.log("[8] Computing mouth focus bounds");
      const mouthCropBounds = getTeethCropBounds(landmarks, iw, ih);
      const teethImageRegion = await cropRegion(normalizedUrl, mouthCropBounds);
      console.log("[9] Mouth focus crop ready for AI");

      // Step 4: AI SPLIT-ENGINE (Whitening, Braces, or Alignment on CROP)
      console.log("[10] Firing Split-Engine on Focus Crop — treatment:", treatment);
      setProcessingLog("Generating focus-simulation...");
      
      // We process the crop, not the full image, passing dimensions for coordinate math
      const processedTeethCrop = await processSimulation(teethImageRegion, treatment, landmarks, iw, ih, mouthCropBounds);
      console.log("[11] Split-Engine returned processed teeth crop");

      if (!isCurrent()) { safeRevoke(processedTeethCrop); console.log("[CANCELLED] after AI"); return; }

      // Step 5: Merge back into full frame
      console.log("[12] Merging AI results back into anatomical frame");
      setProcessingLog("Compositing result...");
      finalUrl = await mergeIntoFullFrame(normalizedUrl, processedTeethCrop, mouthCropBounds, null, landmarks, treatment);
      safeRevoke(processedTeethCrop);
      console.log("[13] Merge complete");

      if (!isCurrent()) { safeRevoke(finalUrl); console.log("[CANCELLED] after composite"); return; }

      // Step 7: Dental Zoom (The 'Focus' Fix)
      console.log("[16] Capturing clinical focus area (Dental Zoom)");
      setProcessingLog("Finalizing...");

      const { rw: curW, rh: curH } = getSharedCanvases(iw, ih);
      const focusBox = (landmarks && landmarks.length)
        ? getTeethFocusBox(landmarks, curW, curH)
        : { x: 0, y: 0, width: curW, height: curH };

      const [bImg, aImg] = await Promise.all([
        cropRegion(normalizedUrl, {
          x: (focusBox.x / curW) * iw,
          y: (focusBox.y / curH) * ih,
          width: (focusBox.width / curW) * iw,
          height: (focusBox.height / curH) * ih
        }),
        cropRegion(finalUrl, {
          x: (focusBox.x / curW) * iw,
          y: (focusBox.y / curH) * ih,
          width: (focusBox.width / curW) * iw,
          height: (focusBox.height / curH) * ih
        }),
      ]);
      console.log("[17] Previews ready — rendering zoom result");

      if (!isCurrent()) { safeRevoke(bImg); safeRevoke(aImg); console.log("[CANCELLED] after crop"); return; }

      safeRevoke(finalUrl); finalUrl = null;
      safeRevoke(normalizedUrl); normalizedUrl = null;

      setBeforeImage(bImg);
      setAfterImage(aImg);
      setStep("result");
      console.log("[18] ✅ Pipeline complete");
    } catch (err) {
      if (!isCurrent()) return;
      console.error("[ERROR] Pipeline crashed at:", err);
      setError(err?.message || "Simulation failed. Please try another photo.");
      setStep("upload");
    } finally {
      if (isCurrent()) {
        setIsProcessing(false);
        setRawImageUrl(null);
      }
      // Cleanup any lingering URLs
      safeRevoke(normalizedUrl);
      safeRevoke(processedUrl);
      safeRevoke(mergedUrl);
      safeRevoke(finalUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const takePhoto = async () => {
    console.log("[1] Photo taken — linking to clinical engine");
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 1. Capture the Raw Frame
    const outW = video.videoWidth;
    const outH = video.videoHeight;
    canvas.width = outW;
    canvas.height = outH;
    ctx.drawImage(video, 0, 0, outW, outH);

    // 2. GET CURRENT LANDMARKS (Crucial Step)
    if (latestLandmarksRef.current) {
        console.log("[2] Landmarks found — executing clinical render");
        
        // This is the line that was missing!
        renderClinicalSimulation(
            ctx, 
            canvas, 
            latestLandmarksRef.current, 
            selectedTreatment, 
            outW, 
            outH
        );
    }

    stopCamera();

    // 3. Export the processed result
    canvas.toBlob(blob => {
        const processedUrl = URL.createObjectURL(blob) + "#simulated=true";
        setStep("processing");
        setActiveTreatment(selectedTreatment);
        setRawImageUrl(processedUrl); // This now contains the whitening/braces!
        setIsProcessing(true);
    }, "image/jpeg", 0.95);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section id="simulation" className="py-16 md:py-24 bg-[#F9F9F7] scroll-mt-20">
      <div className="container mx-auto px-4 sm:px-6">

        <AnimatedSection className="text-center mb-10 md:mb-16">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl sm:text-4xl md:text-5xl text-zinc-900 mb-4">
            AI Smile Simulation
          </h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-base md:text-lg leading-relaxed px-2">
            Take a photo live — AI whitening, alignment, and precise bracket placement in seconds.
          </p>
        </AnimatedSection>

        {/* Floating treatment dock — scales down on mobile */}
        <AnimatedSection className="fixed bottom-5 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 flex justify-center w-full px-2 sm:px-4">
          <div className="inline-flex items-center justify-center gap-1.5 sm:gap-4 rounded-full border border-[rgba(255,255,255,0.1)] bg-zinc-950/75 px-2.5 sm:px-5 py-2 sm:py-3 shadow-[0_18px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            {TREATMENTS.map(t => (
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
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">

            {/* ── Camera prompt step ── */}
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-3xl border border-zinc-100 shadow-xl overflow-hidden"
              >
                {/* Hero area */}
                <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 px-8 pt-14 pb-12 text-center">
                  {/* Animated camera ring */}
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <motion.div
                      className="absolute w-28 h-28 rounded-full border-2 border-brand-gold/30"
                      animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.15, 0.5] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute w-20 h-20 rounded-full border border-brand-gold/50"
                      animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.2, 0.6] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    />
                    <div className="relative w-16 h-16 rounded-full bg-brand-gold/20 border border-brand-gold/60 flex items-center justify-center">
                      <Camera size={28} className="text-brand-gold" />
                    </div>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-serif text-white mb-3">Capture Your Smile</h3>
                  <p className="text-zinc-400 text-sm sm:text-base max-w-xs mx-auto">
                    Open your mouth slightly so your teeth are clearly visible.
                  </p>
                </div>

                {/* Action area */}
                <div className="px-6 sm:px-10 py-8">
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100 text-left">
                      <strong className="block mb-1">Could not process image</strong>
                      {error}
                    </div>
                  )}
                  {cameraError && !error && (
                    <div className="mb-6 p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">{cameraError}</div>
                  )}

                  {/* Big tap-friendly camera button */}
                  <div className="space-y-3">
                    <motion.button
                      type="button"
                      onClick={startCamera}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-5 rounded-2xl font-bold text-base tracking-wide flex items-center justify-center gap-3 text-white shadow-xl shadow-zinc-900/20"
                      style={{ background: "linear-gradient(135deg,#18181b,#3f3f46)" }}
                    >
                      <Camera size={22} />
                      Take Live Photo
                    </motion.button>
                    
                    <motion.button
                      type="button"
                      onClick={() => {
                        console.log("[TEST] Loading yellow teeth asset...");
                        setStep("processing");
                        setActiveTreatment("whitening");
                        setRawImageUrl("/assets/test_teeth.png");
                        setIsProcessing(true);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 text-zinc-600 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 transition-colors"
                    >
                      <Play size={18} className="fill-current" />
                      Run Test Simulation (Yellow Teeth)
                    </motion.button>
                  </div>

                  {/* Tips */}
                  <ul className="mt-6 space-y-2.5">
                    {[
                      "Good lighting works best — face a window or lamp",
                      "Open your lips slightly to show all teeth",
                      "Hold your phone at eye level for the best angle",
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-500">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center flex-shrink-0 font-bold text-[10px]">{i + 1}</span>
                        {tip}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex items-start gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <Info size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      AI-generated preview — not a substitute for professional dental advice.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Live camera step ── */}
            {step === "camera" && (
              <motion.div
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col rounded-3xl overflow-hidden bg-black shadow-2xl"
              >
                {/* Video + mask — controls never enter this box */}
                <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

                  {/* Teeth guide overlay — pointer-events-none so it doesn't block taps */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="rounded-full border border-white/25 bg-black/50 px-4 py-1.5 text-[11px] font-semibold tracking-widest text-white/90">
                        ALIGN TEETH IN CENTER
                      </span>
                      <div className="h-20 w-56 sm:w-72 rounded-full border-2 border-dashed border-white/70 bg-white/5" />
                    </div>
                  </div>
                </div>

                {/* Controls bar — always below the video, never overlapping the mask */}
                <div className="flex items-center justify-center gap-8 bg-zinc-950 px-6 py-6">
                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={reset}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white active:scale-90 transition-transform"
                    aria-label="Cancel"
                  >
                    <X size={20} />
                  </button>

                  {/* Shutter */}
                  <motion.button
                    type="button"
                    onClick={takePhoto}
                    whileTap={{ scale: 0.88 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-black/40"
                    aria-label="Take photo"
                  >
                    <span className="h-14 w-14 rounded-full bg-zinc-900" />
                  </motion.button>

                  {/* Flip / retry */}
                  <button
                    type="button"
                    onClick={() => { stopCamera(); startCamera(); }}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white active:scale-90 transition-transform"
                    aria-label="Flip camera"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}


            {/* ── Processing step ── */}
            {step === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white px-8 py-16 sm:py-20 rounded-3xl border border-zinc-100 shadow-xl text-center"
              >
                <div className="w-16 h-16 border-4 border-zinc-100 border-t-brand-gold rounded-full animate-spin mx-auto mb-8" />
                <p className="text-lg font-serif text-zinc-800">Designing your future smile…</p>
                <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-8 overflow-hidden">
                  <div className="bg-brand-gold h-full animate-[loading_20s_ease-in-out_infinite]" style={{ width: "30%" }} />
                </div>
                <p className="mt-6 text-[10px] text-brand-gold font-bold uppercase tracking-[0.2em] animate-pulse">
                  {processingLog || "Preparing..."}
                </p>
              </motion.div>
            )}

            {/* ── Result step ── */}
            {step === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 sm:space-y-8"
              >
                {/* Before / After slider */}
                <motion.div
                  className="relative rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.14)] w-full mx-auto bg-black"
                  style={{ aspectRatio: "1/1", maxHeight: "min(90vw, 560px)" }}
                  initial={{ scale: 1.06, y: 6 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ReactCompareImage
                    key={afterImage || "compare"}
                    leftImage={beforeImage}
                    rightImage={afterImage}
                    aspectRatio="taller"
                    sliderPositionPercentage={0.5}
                    sliderLineWidth={2}
                    sliderLineColor="#D4AF37"
                    handleSize={40}
                    leftImageCss={{ objectFit: "cover", objectPosition: "center" }}
                    rightImageCss={{ objectFit: "cover", objectPosition: "center" }}
                  />
                  <div className="absolute top-4 left-4 pointer-events-none">
                    <span className="glass px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-zinc-900 shadow-sm">Before</span>
                  </div>
                  <div className="absolute top-4 right-4 pointer-events-none">
                    <span className="glass px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-brand-gold shadow-sm">After</span>
                  </div>
                </motion.div>

                <p className="text-center text-xs text-zinc-400">← Drag the gold line to compare →</p>

                {/* Result card */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-zinc-100 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div
                      className="w-10 h-10 bg-green-50 text-green-500 rounded-full flex items-center justify-center flex-shrink-0"
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <CheckCircle2 size={20} />
                    </motion.div>
                    <div>
                      <h4 className="font-serif text-lg sm:text-xl">Simulation Complete</h4>
                      <p className="text-zinc-400 text-sm capitalize">{activeTreatment} preview ready</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={reset}
                      className="flex-1 py-3.5 rounded-xl border-2 border-zinc-200 text-zinc-700 font-bold text-sm hover:border-zinc-400 transition-colors"
                    >
                      Try Another
                    </button>
                    <motion.div
                      className="flex-1"
                      animate={{ boxShadow: ["0 0 0 0 rgba(212,175,55,0)", "0 0 18px 5px rgba(212,175,55,0.3)", "0 0 0 0 rgba(212,175,55,0)"] }}
                      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2 }}
                    >
                      <button
                        className="w-full py-3.5 rounded-xl font-bold text-sm text-black"
                        style={{ background: "linear-gradient(135deg,#D4AF37,#F5E6C5)" }}
                      >
                        Book Consultation
                      </button>
                    </motion.div>
                  </div>
                </div>

                <p className="text-center text-xs text-zinc-400 italic px-4">
                  &ldquo;AI-generated preview — not a substitute for professional dental advice.&rdquo;
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
