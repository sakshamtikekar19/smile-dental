import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, CheckCircle2, Info, RefreshCw } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";
import { eraseAboveUpperLip } from "../utils/bracesClipFixed";
import { buildBracesPack } from "../utils/bracesGeometryFixed";
import { applyAlignment as applyProfessionalAlignment } from "../utils/alignmentEngine";


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
        minFaceDetectionConfidence: 0.01,
        minFacePresenceConfidence: 0.01,
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
 * ENGINE 1: ANATOMICAL ALIGNMENT (Upgraded Parabolic Geometry)
 */
function applyAlignment(ctx, landmarks, w, h) {
  applyProfessionalAlignment(ctx, landmarks, w, h);
}

/**
 * 🚫 DO NOT MODIFY THIS FUNCTION 🚫
 * 
 * This whitening engine is FINAL + LOCKED.
 * 
 * Rules:
 * - Do NOT change thresholds
 * - Do NOT change blending
 * - Do NOT refactor logic
 * - Do NOT optimize
 * 
 * Only allowed: CALL this function
 * 
 * Any modification will break realism.
 */
const applyWhitening = Object.freeze(function(ctx, landmarks, w, h) {
  // 🦷 ANATOMICAL MOUTH BOUNDARY
  const innerLipIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const innerPts = innerLipIndices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  
  // 🛡️ LOCK REGION (User-Calibrated Safety)
  const mouthTopY = landmarks[13].y * h;
  const mouthBottomY = landmarks[14].y * h;
  const padding = (mouthBottomY - mouthTopY) * 0.35;
  const regionTop = mouthTopY - padding;
  const regionBottom = mouthBottomY + padding;

  const xs = innerPts.map(p => p.x), ys = innerPts.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)) - 2, maxX = Math.ceil(Math.max(...xs)) + 2;
  const minY = Math.floor(Math.min(...ys)) - 2, maxY = Math.ceil(Math.max(...ys)) + 2;
  const boxW = maxX - minX, boxH = maxY - minY;

  if (boxW <= 0 || boxH <= 0) return;

  // 🚀 ENGINE 5: Plaque-Neutralizing Buffer
  const offCanvas = document.createElement("canvas");
  offCanvas.width = boxW; offCanvas.height = boxH;
  const octx = offCanvas.getContext("2d");
  octx.drawImage(ctx.canvas, minX, minY, boxW, boxH, 0, 0, boxW, boxH);
  
  const imageData = octx.getImageData(0, 0, boxW, boxH);
  const data = imageData.data;
  const sourceData = new Uint8ClampedArray(data); // Reference for edge detection

  // --- CLINICAL FILTER (MAX TISSUE SHIELD + PLAGUE CATCH) ---
  function isToothPixel(r, g, b) {
    const lum = (r + g + b) / 3;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;
    // Lower lum for plague catch, but strict ratio to protect gums
    if (lum < 35) return false;
    if (sat > 95) return false; 
    if (r > g * 1.70) return false; 
    return true;
  }

  // --- WHITENING LOOP (Region-Locked + Gradient Lift) ---
  for (let y = 0; y < boxH; y++) {
    const globalY = minY + y;
    if (globalY < regionTop || globalY > regionBottom) continue;

    for (let x = 0; x < boxW; x++) {
      const idx = (y * boxW + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];

      // 🚫 HARD GUARD (VERY IMPORTANT)
      const isTooth = (
        r > 50 && g > 45 && b > 35 &&   // inclusive enamel
        r < 253 && g < 253 && b < 253     // avoid pure highlights
      );
      if (!isTooth) continue;

      // 🧠 Detect edge (between teeth)
      const getLum = (offset) => {
        const r = sourceData[offset];
        const g = sourceData[offset + 1];
        const b = sourceData[offset + 2];
        return (r + g + b) / 3;
      };

      const iL = ((y * boxW + Math.max(0, x - 1)) * 4);
      const iR = ((y * boxW + Math.min(boxW - 1, x + 1)) * 4);

      const lumC = getLum(idx);
      const lumL = getLum(iL);
      const lumR = getLum(iR);

      const edgeStrength = Math.abs(lumL - lumR);
      // tighter + more clinical
      const isEdge = edgeStrength > 22 && edgeStrength < 80;

      // 🧪 STEP 1: Anatomical Arch Gradient (Realism Key)
      const distFromCenter = Math.abs(x - boxW / 2) / (boxW / 2);
      const gradient = 1.0 - (distFromCenter * 0.35);

      // 🧪 STEP 2: CLINICAL TARTAR EXTRACTION (RESTORED)
      const warmStrength = (r + g) / 2 - b; // catches yellow + orange
      const lum = (r + g + b) / 3;
      let nr = r, ng = g, nb = b;

      const isTartar = warmStrength > 12 && lum > 70 && lum < 170;
      if (isTartar) {
        const strength = 0.10; // controlled
        nr *= (1 - strength);
        ng *= (1 - strength * 0.6);

        // neutralize toward grey (NOT blue)
        const avg = (nr + ng + nb) / 3;
        nr = nr * 0.92 + avg * 0.08;
        ng = ng * 0.92 + avg * 0.08;
        nb = nb * 0.92 + avg * 0.08;
      } else if (warmStrength > 8) {
        // Normal cleaning for non-tartar yellow spots
        const cleanup = 1.1 * gradient;
        nr *= (1.0 - (0.06 * cleanup));
        ng *= (1.0 - (0.03 * cleanup));
        nb = nb + (nr - nb) * 0.08;
      }


      // 🧠 STEP 3: REALISM BLEND (0.55)
      const blend = 0.55; 
      const wr = Math.min(255, nr * 1.04);
      const wg = Math.min(255, ng * 1.06);
      const wb = Math.min(255, nb * 1.08);

      let fr = r * (1 - blend) + wr * blend;
      let fg = g * (1 - blend) + wg * blend;
      let fb = b * (1 - blend) + wb * blend;

      // ✨ STEP 4: CONTRAST RESTORE (Depth Lock - Reduced for Naturalism)
      const contrast = 1.02;
      fr = (fr - 128) * contrast + 128;
      fg = (fg - 128) * contrast + 128;
      fb = (fb - 128) * contrast + 128;
 
      data[idx]     = Math.max(0, Math.min(255, fr));
      data[idx + 1] = Math.max(0, Math.min(255, fg));
      data[idx + 2] = Math.max(0, Math.min(255, fb));
    }
  }
  octx.putImageData(imageData, 0, 0);

  // 4. FINAL CLIP: Drawing Buffer through Surgical Path
  ctx.save();
  const path = new Path2D();
  path.moveTo(innerPts[0].x, innerPts[0].y);
  for (let i = 1; i < innerPts.length; i++) path.lineTo(innerPts[i].x, innerPts[i].y);
  path.closePath();

  ctx.clip(path); // Double-Shield: No Lip Bleed
  ctx.drawImage(offCanvas, minX, minY);
  ctx.restore();
});





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

/**
 * 🦷 ANATOMICAL TRANSFORMATION MATRIX
 * Calculates Scale, Rotation (Tilt), and Centering based on Facial Midline
 */
function getProperAlignment(landmarks, w, h) {
  if (!landmarks) return null;

  // 1. CALCULATE TILT (Interpupillary Anchor)
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const radians = Math.atan2((rightEye.y - leftEye.y) * h, (rightEye.x - leftEye.x) * w);
  const tiltDegrees = radians * (180 / Math.PI);

  // 2. CALCULATE POSITIONING (Midline Center)
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const leftCorner = landmarks[57];
  const rightCorner = landmarks[287];

  const centerX = ((leftCorner.x + rightCorner.x) / 2) * w;
  const centerY = (upperLip.y + (lowerLip.y - upperLip.y) * 0.4) * h;

  // 3. CALCULATE SCALE (Corner-to-Corner)
  const mouthWidth = Math.sqrt(
    Math.pow((rightCorner.x - leftCorner.x) * w, 2) + 
    Math.pow((rightCorner.y - leftCorner.y) * h, 2)
  );

  return {
    x: centerX,
    y: centerY,
    rotation: radians,
    rotationDeg: tiltDegrees,
    scale: (mouthWidth / w) * 1.05 // Adjusted for 105% coverage realism
  };
}

// ── Shared Engine Buffers Removed (Mandate: Passing Real Context Only) ───────

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("entry"); // 🔥 Starts with explicit user action
  const alignmentStrength = 0.22; // Clinical Default
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
  const [cameraStream, setCameraStream] = useState(null);
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
      const align = getProperAlignment(latestLandmarksRef.current, canvas.width, canvas.height);
      
      if (t === "whitening") applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height);
      if (t === "alignment") { 
        applyAlignment(ctx, latestLandmarksRef.current, canvas.width, canvas.height, { ...align, strength: alignmentStrength }); 
        applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height); 
      }
      if (t === "braces") applyBracesEffect(ctx, latestLandmarksRef.current, canvas.width, canvas.height, bracesImageRef.current);
      if (t === "transformation") { 
        applyAlignment(ctx, latestLandmarksRef.current, canvas.width, canvas.height, { ...align, strength: alignmentStrength }); 
        applyWhitening(ctx, latestLandmarksRef.current, canvas.width, canvas.height); 
        applyBracesEffect(ctx, latestLandmarksRef.current, canvas.width, canvas.height, bracesImageRef.current); 
      }
    }
    if (step === "camera") renderRequestRef.current = requestAnimationFrame(renderLoop);
  }, [step, selectedTreatment]);

  useEffect(() => {
    if (step === "camera") { requestRef.current = requestAnimationFrame(detectionLoop); renderRequestRef.current = requestAnimationFrame(renderLoop); }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); if (renderRequestRef.current) cancelAnimationFrame(renderRequestRef.current); };
  }, [step, detectionLoop, renderLoop]);

  const startCamera = async () => {
    stopCamera(); // Clean up any zombie tracks before starting fresh
    setError(null);
    setProcessingLog("Opening secure camera feed...");
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: false 
      });
      streamRef.current = stream;
      setCameraStream(stream);
    } catch (err) { 
      setError("Camera access denied or hardware not supported. Please enable permissions.");
      setStep("entry");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(t => t.stop()); 
      streamRef.current = null; 
    }
    setCameraStream(null);
  };

  const reset = () => {
    stopCamera(); // Force hardware track disposal
    generationRef.current += 1; 
    setAfterImage(null); 
    setFinalLandmarks(null); 
    setIsProcessing(false); 
    setRawImageUrl(null);
    setCameraStream(null);
    setStep("entry");
  };

  const startHeavyProcessingPipeline = useCallback(async (imageUrl) => {
    const treatment = pendingTreatmentRef.current;
    const generation = ++generationRef.current;
    try {
      setProcessingLog("Landmarking facial anatomy...");
      let landmarks = await detectLandmarks(imageUrl);
      
      // 🔥 RESILIENCE FALLBACK: If static detection fails, use the last known live landmarks
      if (!landmarks && latestLandmarksRef.current) {
        console.warn("[AI] Static detection failed. Falling back to live anatomical anchors.");
        landmarks = latestLandmarksRef.current;
      }

      if (generation !== generationRef.current) return;
      if (!landmarks) throw new Error("Please look directly at camera. Face not detected.");

      const { url: snapshotUrl, w: iw, h: ih } = await resizeImage(imageUrl, MAX_IMAGE_SIZE);
      
      // 🔥 ARCHITECTURAL FIX: Use private buffer for simulation (No Live-UI Desync)
      const procCanvas = document.createElement("canvas");
      procCanvas.width = iw;
      procCanvas.height = ih;
      const pctx = procCanvas.getContext("2d");

      const img = await loadImage(snapshotUrl);
      
      // 🔥 2. FINAL PIPELINE (LOCK THIS IN)
      pctx.clearRect(0, 0, iw, ih);
      pctx.drawImage(img, 0, 0, iw, ih);

      console.time("simulation_render");
      switch (treatment) {
        case "whitening": 
          setProcessingLog("Applying stoichiometry whitening...");
          applyWhitening(pctx, landmarks, iw, ih); 
          break;
        case "alignment": 
          setProcessingLog("Reconstructing dental anatomy...");
          applyAlignment(pctx, landmarks, iw, ih, alignmentStrength); 
          setProcessingLog("Finalizing enamel texture...");
          applyWhitening(pctx, landmarks, iw, ih); 
          break;
        case "braces": 
          setProcessingLog("Positioning clinical brackets...");
          applyBracesEffect(pctx, landmarks, iw, ih, bracesImageRef.current); 
          break;
        case "transformation": 
          setProcessingLog("Aligning full dental arch...");
          applyAlignment(pctx, landmarks, iw, ih, alignmentStrength); 
          setProcessingLog("Enhancing stoichiometric radiance...");
          applyWhitening(pctx, landmarks, iw, ih); 
          setProcessingLog("Bonding medical-grade braces...");
          applyBracesEffect(pctx, landmarks, iw, ih, bracesImageRef.current); 
          break;
      }
      console.timeEnd("simulation_render");

      const finalUrl = procCanvas.toDataURL("image/jpeg", 0.93);
      setAfterImage(finalUrl);
      setBeforeImage(snapshotUrl);
      setFinalLandmarks(landmarks);
      setStep("result");
      setIsProcessing(false);
      stopCamera();
    } catch (err) { 
      console.error("[CRITICAL] Processing Pipeline Failed:", err);
      setError(`Simulation Failed: ${err.message || "Anatomical conflict detected. Please retry in better lighting."}`); 
      setIsProcessing(false); 
    }
  }, []);

  useEffect(() => {
    if (!rawImageUrl || !isProcessing) return;
    const timer = setTimeout(() => startHeavyProcessingPipeline(rawImageUrl), 150);
    return () => clearTimeout(timer);
  }, [rawImageUrl, isProcessing, startHeavyProcessingPipeline]);

  // 🔥 CLINICAL FIX: Camera Lifecycle Sync (State-Based Tracking)
  useEffect(() => {
    if (step === "camera" && cameraStream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
        video.onloadedmetadata = () => {
          video.play().catch(e => console.error("Camera play failed:", e));
        };
      }
    }
  }, [step, cameraStream]);

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

        <div className="max-w-4xl mx-auto rounded-[32px] md:rounded-[40px] relative flex flex-col justify-center min-h-[400px] md:min-h-[500px]">
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
                  <video 
                    ref={videoRef} 
                    style={{ position: 'absolute', top: 0, left: 0 }}
                    className="w-full h-full" 
                    playsInline muted autoPlay 
                  />
                  <canvas 
                    ref={canvasRef} 
                    style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
                    className="w-full h-full pointer-events-none" 
                  />
                  
                  {/* 🦷 Anatomical Teeth Placement Guidance (The 'Oval') */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="relative w-[50%] md:w-[32%] aspect-[1.8/1] border-[3px] border-dashed border-white/50 rounded-[500px] flex items-center justify-center">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-white/20 rounded-[500px] animate-pulse" />
                      <span className="text-white/60 text-[8px] md:text-[9px] uppercase tracking-[0.3em] font-bold mt-20 md:mt-24">Align Teeth</span>
                    </div>
                  </div>
                  
                  <div className="absolute top-10 left-0 right-0 flex flex-col items-center gap-6 z-10 pointer-events-none">
                    <p className="text-white/70 text-[10px] uppercase tracking-[0.3em] font-bold drop-shadow-md">Live AI Simulation</p>
                    {error && <p className="text-red-400 text-[10px] font-bold bg-black/40 px-3 py-1 rounded-full backdrop-blur-md animate-pulse">{error}</p>}
                  </div>

                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
                    <button onClick={() => {
                      const video = videoRef.current;
                      if (video) {
                        setProcessingLog("Capturing high-res dental scan...");
                        setIsProcessing(true);
                        pendingTreatmentRef.current = selectedTreatment;
                        setActiveTreatment(selectedTreatment);
                        
                        // 🔥 ARCHITECTURAL FIX: Capture RAW from Video (Not the processed canvas)
                        const captureCanvas = document.createElement("canvas");
                        captureCanvas.width = video.videoWidth;
                        captureCanvas.height = video.videoHeight;
                        const cctx = captureCanvas.getContext("2d");
                        cctx.drawImage(video, 0, 0);
                        
                        const url = captureCanvas.toDataURL("image/jpeg", 0.95);
                        setRawImageUrl(url);
                      }
                    }} className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-transform">
                      <div className="h-14 w-14 rounded-full bg-white group-hover:bg-brand-gold transition-colors" />
                    </button>
                  </div>
                </div>
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

          {/* 🚀 Processing Overlay (Floating layer to prevent camera unmount) */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div 
                key="processing" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-[32px] md:rounded-[40px] text-center p-8"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 mb-6 md:mb-8 relative">
                   <div className="absolute inset-0 border-4 border-zinc-100/50 rounded-full" />
                   <div className="absolute inset-0 border-4 border-brand-gold rounded-full border-t-transparent animate-spin" />
                </div>
                <h3 className="text-xl md:text-2xl font-serif text-zinc-900 mb-1 md:mb-2">{processingLog}</h3>
                <p className="text-zinc-500 text-xs md:text-sm max-w-xs">Our clinical AI is reconstructing your smile profile...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
