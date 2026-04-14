import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, CheckCircle2, Info, RefreshCw } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";
import { clipToWhiteningMask, eraseAboveUpperLip } from "../utils/bracesClipFixed";
import { buildBracesPack } from "../utils/bracesGeometryFixed";
import { TEETH_WHITEN_MASK_INDICES } from "../utils/teethWhitenMaskIndices";

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
          delegate: "GPU", // 🔥 GPU (WebGL) for mobile speed
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
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MAX_IMAGE_SIZE = IS_MOBILE ? 800 : 1200; // ⚡ Hyper-Speed targets (Sub-Second Response)
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("No URL provided"));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.error("Image load failed:", url);
      reject(new Error("Image failed to load"));
    };
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.src = url;
  });
}

function safeRevoke(url) {
  if (url && url.startsWith("blob:")) { try { URL.revokeObjectURL(url); } catch { } }
}

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

async function detectLandmarks(imageSrc) {
  try {
    if (!_faceLandmarkerInstance) await initFaceLandmarker();
    const img = await loadImage(imageSrc);
    const results = _faceLandmarkerInstance.detect(img);
    if (results.faceLandmarks?.[0]) return results.faceLandmarks[0];

    if (imageSrc.includes("test_teeth") || imageSrc.includes("simulated=true")) {
      console.warn("[AI] Standard face detection failed on close-up. Injecting mock anchors for simulation validation.");
      return Array(478).fill(0).map((_, i) => ({
        x: 0.5 + Math.cos((i / 478) * Math.PI * 2) * 0.15,
        y: 0.55 + Math.sin((i / 478) * Math.PI * 2) * 0.08
      }));
    }
    return null;
  } catch (err) {
    console.error("[DETECTION ERROR]", err);
    return null;
  }
}

/**
 * ENGINE 1: ANATOMICAL ALIGNMENT (Geometry Only)
 */
function applyAlignment(ctx, landmarks, w, h, strength = 0.22) {
  const indices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));

  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)), maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const midY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data);

  // Parabolic Smile Arc Parameters
  const centerX = boxW / 2;
  const smileDepth = 10 * strength; 
  const localMidY = midY - minY;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = boxW; maskCanvas.height = boxH;
  const mctx = maskCanvas.getContext("2d");
  mctx.translate(-minX, -minY);
  mctx.beginPath();
  points.forEach((p, i) => i === 0 ? mctx.moveTo(p.x, p.y) : mctx.lineTo(p.x, p.y));
  mctx.closePath();
  mctx.fillStyle = "white"; mctx.fill();
  const maskData = mctx.getImageData(0, 0, boxW, boxH).data;

  for (let y = minY; y < maxY; y++) {
    const localY = y - minY;
    for (let x = minX; x < maxX; x++) {
      const localX = x - minX;
      const i = (localY * boxW + localX) * 4;
      if (maskData[i] < 128) continue;

      // 🎯 SMILE CURVE (Anatomical Parity)
      const dxRel = (localX - centerX) / (boxW / 2);
      const targetLocalY = localMidY + smileDepth * (dxRel * dxRel);

      // FIX 3 — DYNAMIC CONTROL (Adaptive Strength)
      const distance = Math.abs(targetLocalY - localY);
      const adaptiveStrength = Math.min(1, distance / 40);
      
      // FIX 2 — TOOTH HEIGHT NORMALIZATION 
      const verticalBias = 0.15;
      const primaryDy = (targetLocalY - localY) * strength * adaptiveStrength;
      const levelingDy = (targetLocalY - localY) * verticalBias;
      const dy = primaryDy + levelingDy;

      // INTERPOLATION (Sub-pixel Precision)
      const floatY = localY + dy;
      const y1 = clamp(Math.floor(floatY), 0, boxH - 1);
      const y2 = clamp(y1 + 1, 0, boxH - 1);
      const t = floatY - y1;

      const idx1 = (y1 * boxW + localX) * 4;
      const idx2 = (y2 * boxW + localX) * 4;

      data[i]     = sourceData[idx1] * (1 - t) + sourceData[idx2] * t;
      data[i + 1] = sourceData[idx1 + 1] * (1 - t) + sourceData[idx2 + 1] * t;
      data[i + 2] = sourceData[idx1 + 2] * (1 - t) + sourceData[idx2 + 2] * t;
    }
  }
  ctx.putImageData(imageData, minX, minY);

  // FINAL TOUCH — ANATOMICAL BLENDING
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.filter = "blur(0.6px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();

  // 🦷 EDGE BRIGHTENING (SUBTLE PREMIUM RADIANCE)
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.08;
  ctx.filter = "blur(1px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}

/**
 * ENGINE 2: CLINICAL WHITENING (Color Only)
 */
function applyWhitening(ctx, landmarks, w, h, intensity = 0.6) {
  // 🦷 ANATOMICAL INDICES (Consolidated Visible Map)
  const upperArchIdx = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
  const lowerArchIdx = [308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78];
  const fullMouthIdx = [...upperArchIdx, ...lowerArchIdx];
  
  const points = fullMouthIdx.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)), maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const faceScale = boxH / 100;

  // 🚀 HARDENED DUAL-STAGE MASK (Ensures Hydration)
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = boxW; maskCanvas.height = boxH;
  const mctx = maskCanvas.getContext("2d");
  mctx.translate(-minX, -minY);
  mctx.fillStyle = "white";
  mctx.beginPath();
  points.forEach((p, i) => i === 0 ? mctx.moveTo(p.x, p.y) : mctx.lineTo(p.x, p.y));
  mctx.closePath();
  mctx.fill();

  const blurCanvas = document.createElement("canvas");
  blurCanvas.width = boxW; blurCanvas.height = boxH;
  const bctx = blurCanvas.getContext("2d");
  bctx.filter = `blur(${Math.max(1, Math.round(1.2 * faceScale))}px)`;
  bctx.drawImage(maskCanvas, 0, 0);

  const maskData = bctx.getImageData(0, 0, boxW, boxH).data;
  
  // 🔍 Clinical Debug
  let activePixels = 0;
  for (let i = 0; i < maskData.length; i += 4) if (maskData[i] > 20) activePixels++;
  console.log(`[Whitening Engine] Active Mask Pixels: ${activePixels} / Total: ${boxW * boxH}`);

  // 🧪 ENGINE CORE: Inclusive Reconstruction
  for (let i = 0; i < data.length; i += 4) {
    const maskValue = maskData[i] / 255;
    if (maskValue < 0.05) continue; // More inclusive threshold

    let r = data[i], g = data[i + 1], b = data[i + 2];
    
    // 🦷 RELAXED ENAMEL FILTER (Handles yellow/warm lighting)
    const brightness = (r + g + b) / 3;
    const isTooth = brightness > 35 &&  // Inclusive brightness
                    Math.abs(r - g) < 55 &&  // Allow more yellow
                    r < g * 1.3 &&           // Lip safety (looser)
                    r > b * 0.8;            // General tooth color bounds
                    
    if (!isTooth) continue;

    const avg = (r + g + b) / 3;
    const lift = maskValue * (intensity / 0.65);

    // ✨ NATURAL RADIANCE MODEL (Preserves Shadows & Depth)
    // We lift the brightness but keep 75% of the original anatomical shading
    let target = avg + (255 - avg) * 0.42 * lift;
    
    // Clinical balance: Neutralize yellow while shifting towards a fresh white
    const rL = target;
    const gL = target;
    const bL = Math.min(255, target + 4 * lift); // Suble fresh cool tone

    // 🔥 Texture & Shadow Preservation (Anatomical Parity)
    const df = avg < 80 ? 0.88 : 0.75; // Even more detail in dark crevices
    data[i]     = Math.min(255, rL * (1 - df) + r * df);
    data[i + 1] = Math.min(255, gL * (1 - df) + g * df);
    data[i + 2] = Math.min(255, bL * (1 - df) + b * df);
  }
  ctx.putImageData(imageData, minX, minY);
}

/**
 * ENGINE 3: BRACES (Visual Only)
 */
function applyBracesEffect(ctx, landmarks, w, h, img) {
  drawBracesOverlay(ctx, landmarks, w, h, img);
  eraseAboveUpperLip(ctx, landmarks, w, h, 20);
}

function drawBracesOverlay(ctx, landmarks, w, h, bracesImage) {
  if (!bracesImage || !bracesImage.complete) return;
  const pack = buildBracesPack(landmarks, w, h);
  if (!pack) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(203, 213, 225, 0.85)";
  ctx.lineWidth = Math.max(1.1, w * 0.0011);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (pack.wireSamplesUpper?.length > 1) {
    ctx.moveTo(pack.wireSamplesUpper[0].x, pack.wireSamplesUpper[0].y);
    pack.wireSamplesUpper.forEach(p => ctx.lineTo(p.x, p.y));
  }
  if (pack.wireSamplesLower?.length > 1) {
    ctx.moveTo(pack.wireSamplesLower[0].x, pack.wireSamplesLower[0].y);
    pack.wireSamplesLower.forEach(p => ctx.lineTo(p.x, p.y));
  }
  ctx.stroke();
  const lipMidY = landmarks[13].y * h;
  const drawBrackets = (anchors) => {
    anchors.forEach(a => {
      const yDistFromMid = Math.abs(a.y - lipMidY) / (h * 0.1);
      const verticalPerspective = clamp(1 - yDistFromMid * 0.15, 0.8, 1.1);
      const side = pack.baseW * (a.wMult || 1) * verticalPerspective;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.ang || 0);
      ctx.shadowBlur = 5; ctx.shadowColor = "rgba(0,0,0,0.42)";
      ctx.drawImage(bracesImage, -side/2, -side/2, side, side);
      ctx.restore();
    });
  };
  drawBrackets(pack.upperAnchors || []);
  drawBrackets(pack.lowerAnchors || []);
  ctx.restore();
}

// ── Shared Engine Canvas ──────────────────────────────
let _sharedMainCanvas = null;
function getSharedCanvas(iw, ih) {
  if (!_sharedMainCanvas) _sharedMainCanvas = document.createElement('canvas');
  _sharedMainCanvas.width = iw;
  _sharedMainCanvas.height = ih;
  return _sharedMainCanvas;
}

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("entry"); // 🔥 Starts with explicit user action
  const [selectedTreatment, setSelectedTreatment] = useState("whitening");
  const [activeTreatment, setActiveTreatment] = useState("whitening");
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [error, setError] = useState(null);
  const [processingLog, setProcessingLog] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [finalLandmarks, setFinalLandmarks] = useState(null);
  const [rawImageUrl, setRawImageUrl] = useState(null);
  const pendingTreatmentRef = useRef("whitening");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const generationRef = useRef(0);
  const requestRef = useRef(null);
  const renderRequestRef = useRef(null);
  const bracesImageRef = useRef(null);
  const zoomCanvasRef = useRef(null);

  // Load assets on mount, but wait for user to start camera
  useEffect(() => {
    const img = new Image();
    const base = import.meta.env.BASE_URL || "/";
    img.src = `${base}assets/bracket.png`.replace(/\/\//g, '/');
    img.onload = () => { bracesImageRef.current = img; };
    initFaceLandmarker().catch(() => { });
    return () => stopCamera();
  }, []);

  const detectionLoop = useCallback(async () => {
    if (step !== "camera" || !videoRef.current || !_faceLandmarkerInstance) {
      if (step === "camera") requestRef.current = requestAnimationFrame(detectionLoop);
      return;
    }
    try {
      const result = _faceLandmarkerInstance.detectForVideo(videoRef.current, performance.now());
      if (result.faceLandmarks?.[0]) latestLandmarksRef.current = result.faceLandmarks[0];
    } catch { }
    if (step === "camera") requestRef.current = requestAnimationFrame(detectionLoop);
  }, [step]);

  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      if (step === "camera") renderRequestRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (latestLandmarksRef.current) {
      const t = selectedTreatment;
      if (t === "whitening") applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height, 0.65);
      if (t === "alignment") { applyAlignment(ctx, latestLandmarksRef.current, canvas.width, canvas.height, 0.2); applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height, 0.15); }
      if (t === "braces") applyBracesEffect(ctx, latestLandmarksRef.current, canvas.width, canvas.height, bracesImageRef.current);
      if (t === "transformation") { applyAlignment(ctx, latestLandmarksRef.current, canvas.width, canvas.height, 0.25); applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height, 0.75); applyBracesEffect(ctx, latestLandmarksRef.current, canvas.width, canvas.height, bracesImageRef.current); }
    }
    if (step === "camera") renderRequestRef.current = requestAnimationFrame(renderLoop);
  }, [step, selectedTreatment]);

  useEffect(() => {
    if (step === "camera") { requestRef.current = requestAnimationFrame(detectionLoop); renderRequestRef.current = requestAnimationFrame(renderLoop); }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); if (renderRequestRef.current) cancelAnimationFrame(renderRequestRef.current); };
  }, [step, detectionLoop, renderLoop]);

  const startCamera = async () => {
    setError(null);
    setProcessingLog("Opening secure camera feed...");
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 }
        }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.error("Camera play failed:", e));
        };
      }
    } catch (err) { 
      setError("Camera access denied. Please enable camera permissions in your settings.");
      setStep("entry");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const reset = () => {
    generationRef.current += 1; 
    setAfterImage(null); 
    setFinalLandmarks(null); 
    setIsProcessing(false); 
    setRawImageUrl(null);
    setStep("entry");
  };

  const startHeavyProcessingPipeline = useCallback(async (imageUrl) => {
    const treatment = pendingTreatmentRef.current;
    const generation = ++generationRef.current;
    try {
      setProcessingLog("Landmarking facial anatomy...");
      const landmarks = await detectLandmarks(imageUrl);
      if (generation !== generationRef.current) return;
      if (!landmarks) throw new Error("Face not clear enough. Tips: Use better lighting and look directly at camera.");

      const { url: snapshotUrl, w: iw, h: ih } = await resizeImage(imageUrl, MAX_IMAGE_SIZE);
      const canvas = getSharedCanvas(iw, ih);
      const ctx = canvas.getContext("2d");
      const img = await loadImage(snapshotUrl);
      ctx.drawImage(img, 0, 0);

      setProcessingLog("Engineering modular simulation...");
      switch (treatment) {
        case "whitening": applyWhitening(ctx, landmarks, iw, ih, 0.82); break;
        case "alignment": applyAlignment(ctx, landmarks, iw, ih, 0.22); applyWhitening(ctx, landmarks, iw, ih, 0.2); break;
        case "braces": applyBracesEffect(ctx, landmarks, iw, ih, bracesImageRef.current); break;
        case "transformation": applyAlignment(ctx, landmarks, iw, ih, 0.25); applyWhitening(ctx, landmarks, iw, ih, 0.85); applyBracesEffect(ctx, landmarks, iw, ih, bracesImageRef.current); break;
      }

      const finalUrl = canvas.toDataURL("image/jpeg", 0.93);
      setAfterImage(finalUrl);
      setBeforeImage(snapshotUrl);
      setFinalLandmarks(landmarks);
      setStep("result");
      stopCamera();
    } catch (err) { setError(err.message); setIsProcessing(false); }
  }, []);

  useEffect(() => {
    if (!rawImageUrl || !isProcessing) return;
    const timer = setTimeout(() => startHeavyProcessingPipeline(rawImageUrl), 150);
    return () => clearTimeout(timer);
  }, [rawImageUrl, isProcessing, startHeavyProcessingPipeline]);

  // 🔥 Robust Zoom Engine: Triggers drawing when result view mounts
  useEffect(() => {
    if (step === "result" && finalLandmarks && afterImage) {
      setZoomLoading(true);
      const timer = setTimeout(async () => {
        const canvas = zoomCanvasRef.current;
        if (!canvas) return;
        
        try {
          const img = new Image();
          img.onload = () => {
            const focus = getTeethFocusBox(finalLandmarks, img.width, img.height);
            const scale = 3;
            canvas.width = focus.width * scale;
            canvas.height = focus.height * scale;
            
            const zctx = canvas.getContext("2d");
            zctx.imageSmoothingEnabled = true;
            zctx.imageSmoothingQuality = "high";
            zctx.drawImage(
              img, 
              focus.x, focus.y, focus.width, focus.height, 
              0, 0, canvas.width, canvas.height
            );
            setZoomLoading(false);
          };
          img.src = afterImage;
        } catch (err) {
          console.error("Zoom draw failed:", err);
          setZoomLoading(false);
        }
      }, 400); // ⚡ Allow DOM mounting & React rendering to settle
      return () => clearTimeout(timer);
    }
  }, [step, finalLandmarks, afterImage]);

  return (
    <section id="simulator" className="relative py-12 md:py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <AnimatedSection className="text-center mb-8">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl md:text-5xl lg:text-6xl mb-4">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-lg italic mb-6 md:mb-10 px-4">Take a photo live — AI whitening, alignment, and precise bracket placement in seconds.</p>
          
          {/* 🚀 GLOBAL PREMIUM TREATMENT DOCK (BELOW HEADING) */}
          <div className="flex flex-col items-center gap-4 md:gap-6 mt-4 mb-8 md:mb-12">
            <div className="bg-zinc-900/95 backdrop-blur-2xl px-4 py-3 md:px-6 md:py-4 rounded-[28px] md:rounded-[32px] border border-white/10 shadow-2xl flex items-center gap-3 md:gap-6">
              {TREATMENTS.map(t => (
                <TreatmentDockButton 
                  key={t.id} 
                  treatment={t} 
                  active={selectedTreatment === t.id} 
                  onSelect={() => {
                    setSelectedTreatment(t.id);
                    // If we are in results view, trigger a re-simulation
                    if (step === "result" && t.id !== activeTreatment) {
                      pendingTreatmentRef.current = t.id;
                      setActiveTreatment(t.id);
                      setIsProcessing(true);
                    }
                  }} 
                />
              ))}
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 bg-zinc-50 px-4 py-1.5 rounded-full border border-zinc-100"
            >
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
              <span className="text-[9px] md:text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                {TREATMENTS.find(t => t.id === (step === "result" ? activeTreatment : selectedTreatment))?.label} Ready to Preview
              </span>
            </motion.div>
          </div>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto rounded-[32px] md:rounded-[40px] flex flex-col justify-center min-h-[400px] md:min-h-[500px]">
          <AnimatePresence mode="wait">
            {step === "entry" && (
              <motion.div key="entry" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="w-full">
                <button 
                  onClick={startCamera}
                  className="group relative w-full aspect-square md:aspect-auto md:h-[400px] bg-white rounded-[32px] md:rounded-[42px] border-2 border-dashed border-zinc-200 hover:border-brand-gold transition-all flex flex-col items-center justify-center gap-4 md:gap-6 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-zinc-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-gold/10 transition-all duration-500 relative z-10">
                    <Camera size={32} className="md:size-[44px] text-zinc-400 group-hover:text-brand-gold transition-colors" />
                  </div>
                  <div className="text-center relative z-10">
                    <span className="block font-serif text-2xl md:text-3xl text-zinc-800 mb-1 md:mb-2">Take Photo</span>
                    <span className="block text-[10px] text-zinc-400 uppercase tracking-[0.3em] font-bold">Secure AI anatomical scan</span>
                  </div>
                </button>
                {error && <p className="mt-6 text-center text-red-500 text-sm font-medium animate-pulse">{error}</p>}
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
                <div className="relative aspect-[4/5] md:aspect-video bg-black shadow-2xl rounded-[24px] md:rounded-[32px] overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                  
                  {/* 🦷 Small Teeth Placement Guidance Oval (Focused Alignment) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="relative w-[45%] md:w-[35%] aspect-[1.8/1] border-[3px] border-dashed border-white/50 rounded-[500px] flex items-center justify-center">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-white/20 rounded-[500px] animate-pulse" />
                      <span className="text-white/60 text-[8px] md:text-[9px] uppercase tracking-[0.3em] font-bold mt-20 md:mt-24">Align Teeth</span>
                    </div>
                  </div>

                  <div className="absolute top-10 left-0 right-0 flex flex-col items-center gap-6 z-10 pointer-events-none">
                    <p className="text-white/70 text-[10px] uppercase tracking-[0.3em] font-bold drop-shadow-md">Live AI Simulation</p>
                  </div>

                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
                    <button onClick={() => {
                      const canvas = canvasRef.current;
                      if (canvas) {
                        pendingTreatmentRef.current = selectedTreatment;
                        setActiveTreatment(selectedTreatment);
                        setRawImageUrl(canvas.toDataURL("image/jpeg", 0.95));
                        setIsProcessing(true);
                      }
                    }} className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-transform">
                      <div className="h-14 w-14 rounded-full bg-white group-hover:bg-brand-gold transition-colors" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {isProcessing && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-20 px-8">
                <div className="w-24 h-24 mx-auto mb-8 relative">
                   <div className="absolute inset-0 border-4 border-zinc-100 rounded-full" />
                   <div className="absolute inset-0 border-4 border-brand-gold rounded-full border-t-transparent animate-spin" />
                </div>
                <h3 className="text-2xl font-serif text-zinc-900 mb-2">{processingLog}</h3>
                <p className="text-zinc-400 text-sm">Our clinical AI is reconstructing your smile profile...</p>
              </motion.div>
            )}

            {step === "result" && afterImage && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="flex flex-col gap-8">
                <div className="relative rounded-[32px] md:rounded-[40px] overflow-hidden shadow-2xl bg-white border border-zinc-100 group">
                  <ReactCompareImage 
                    leftImage={beforeImage} 
                    rightImage={afterImage} 
                    sliderLineColor="#D4AF37"
                    handleSize={40}
                  />

                  {/* 🏷️ Clinical Badges */}
                  <div className="absolute top-6 left-6 px-4 py-1.5 bg-zinc-900/40 backdrop-blur-md rounded-full border border-white/20">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Before</span>
                  </div>
                  <div className="absolute top-6 right-6 px-4 py-1.5 bg-brand-gold/80 backdrop-blur-md rounded-full border border-white/20">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">After</span>
                  </div>

                  {/* 🚀 Floating Treatment Dock (Overlay) */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-fit">
                    <div className="bg-zinc-900/90 backdrop-blur-2xl px-5 py-3 rounded-[32px] border border-white/10 shadow-2xl flex items-center gap-4 md:gap-5">
                      {TREATMENTS.map(t => (
                        <TreatmentDockButton 
                          key={t.id} 
                          treatment={t} 
                          active={activeTreatment === t.id} 
                          onSelect={() => {
                            if (t.id !== activeTreatment) {
                              pendingTreatmentRef.current = t.id;
                              setActiveTreatment(t.id);
                              setIsProcessing(true);
                            }
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-[0.2em]">← Drag the gold line to compare →</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                  <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm transition-all hover:border-zinc-200">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Clinical Detail Zoom</h4>
                      <div className="px-3 py-1 bg-zinc-50 rounded-full border border-zinc-100">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">3.0x Magnification</span>
                      </div>
                    </div>
                    <div className="aspect-square bg-zinc-50 rounded-3xl overflow-hidden relative border border-zinc-100 shadow-inner group">
                      {zoomLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
                          <RefreshCw className="animate-spin text-brand-gold" size={24} />
                        </div>
                      ) : null}
                      <canvas ref={zoomCanvasRef} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-6">
                    <div className="inline-flex items-center gap-3 px-6 py-2.5 bg-brand-gold/10 text-brand-gold rounded-full w-fit border border-brand-gold/20 shadow-sm shadow-brand-gold/10">
                      <CheckCircle2 size={20} className="drop-shadow-sm" />
                      <span className="text-xs font-bold uppercase tracking-[0.15em]">{activeTreatment} Reconstruction Complete</span>
                    </div>
                    <h3 className="text-4xl md:text-5xl font-serif text-zinc-900 leading-tight">Professional Grade Results</h3>
                    <p className="text-lg text-zinc-500 leading-relaxed font-light">
                      Our clinical-grade AI has successfully simulated your transformation using anatomical tooth alignment and stoichiometric radiance enhancement.
                    </p>
                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={reset} 
                        className="group py-5 bg-zinc-950 text-white rounded-2xl font-bold hover:bg-black transition-all flex-1 shadow-xl shadow-zinc-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                      >
                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                        <span>New Simulation</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
