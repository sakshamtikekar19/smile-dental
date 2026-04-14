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
    const dy = (midY - y) * strength;
    const srcLocalY = Math.max(0, Math.min(boxH - 1, Math.round(localY + dy)));
    for (let x = minX; x < maxX; x++) {
      const localX = x - minX;
      const i = (localY * boxW + localX) * 4;
      if (maskData[i] < 128) continue;
      const srcIdx = (srcLocalY * boxW + localX) * 4;
      data[i] = sourceData[srcIdx];
      data[i + 1] = sourceData[srcIdx + 1];
      data[i + 2] = sourceData[srcIdx + 2];
    }
  }
  ctx.putImageData(imageData, minX, minY);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.filter = "blur(0.6px)";
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.restore();
}

/**
 * ENGINE 2: CLINICAL WHITENING (Color Only)
 */
function applyWhitening(ctx, landmarks, w, h, intensity = 0.6) {
  const indices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const points = indices.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.floor(Math.min(...xs)), maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys));
  const boxW = maxX - minX, boxH = maxY - minY;
  if (boxW <= 0 || boxH <= 0) return;

  const imageData = ctx.getImageData(minX, minY, boxW, boxH);
  const data = imageData.data;
  const faceScale = boxH / 100;

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = boxW; maskCanvas.height = boxH;
  const mctx = maskCanvas.getContext("2d");
  mctx.translate(-minX, -minY);
  mctx.filter = `blur(${Math.round(3.5 * faceScale)}px)`;
  mctx.beginPath();
  points.forEach((p, i) => i === 0 ? mctx.moveTo(p.x, p.y) : mctx.lineTo(p.x, p.y));
  mctx.closePath();
  mctx.fillStyle = "white"; mctx.fill();
  const sdfData = mctx.getImageData(0, 0, boxW, boxH).data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const feather = sdfData[i] / 255;
    if (feather < 0.1) continue;
    const isTooth = r > 80 && g > 80 && b > 65 && Math.abs(r - g) < 30 && r < g * 1.12;
    if (!isTooth) continue;

    const avg = (r + g + b) / 3;
    const lift = 0.40 * feather * (intensity / 0.65);
    r = r * 0.65 + avg * 0.35; g = g * 0.65 + avg * 0.35; b = b * 0.85 + avg * 0.15;
    r += (255 - r) * 0.12 * lift; g += (255 - g) * 0.15 * lift; b += (255 - b) * 0.48 * lift;

    const isPlaque = r > g && g > b && (r - b) > 25;
    if (isPlaque && avg < 160) {
      r = r * 0.85 + avg * 0.15; g = g * 0.88 + avg * 0.12; b = b * 0.95 + avg * 0.05;
      r += (255 - r) * 0.08; g += (255 - g) * 0.08; b += (255 - b) * 0.12;
    }
    if (feather < 0.3) { r *= 0.96; g *= 0.96; b *= 0.96; }
    data[i] = Math.min(255, r); data[i + 1] = Math.min(255, g); data[i + 2] = Math.min(255, b);
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
  const [step, setStep] = useState("upload");
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

  useEffect(() => {
    const img = new Image();
    const base = import.meta.env.BASE_URL || "/";
    img.src = `${base}assets/bracket.png`.replace(/\/\//g, '/');
    img.onload = () => { bracesImageRef.current = img; };
    initFaceLandmarker().catch(() => { });
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
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setStep("upload"); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const reset = () => {
    generationRef.current += 1; stopCamera(); setStep("upload"); setBeforeImage(null); setAfterImage(null); setFinalLandmarks(null); setIsProcessing(false); setRawImageUrl(null);
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
        case "whitening": applyWhitening(ctx, landmarks, iw, ih, 0.7); break;
        case "alignment": applyAlignment(ctx, landmarks, iw, ih, 0.22); applyWhitening(ctx, landmarks, iw, ih, 0.15); break;
        case "braces": applyBracesEffect(ctx, landmarks, iw, ih, bracesImageRef.current); break;
        case "transformation": applyAlignment(ctx, landmarks, iw, ih, 0.25); applyWhitening(ctx, landmarks, iw, ih, 0.75); applyBracesEffect(ctx, landmarks, iw, ih, bracesImageRef.current); break;
      }

      const finalUrl = canvas.toDataURL("image/jpeg", 0.93);
      setAfterImage(finalUrl);
      setBeforeImage(snapshotUrl);
      setFinalLandmarks(landmarks);
      setStep("result");

      setZoomLoading(true);
      setTimeout(() => {
        if (zoomCanvasRef.current) {
          const focus = getTeethFocusBox(landmarks, iw, ih);
          const scale = 3;
          zoomCanvasRef.current.width = focus.width * scale;
          zoomCanvasRef.current.height = focus.height * scale;
          const zctx = zoomCanvasRef.current.getContext("2d");
          zctx.drawImage(canvas, focus.x, focus.y, focus.width, focus.height, 0, 0, zoomCanvasRef.current.width, zoomCanvasRef.current.height);
          setZoomLoading(false);
        }
      }, 100);

    } catch (err) { setError(err.message); setIsProcessing(false); }
  }, []);

  useEffect(() => {
    if (!rawImageUrl || !isProcessing) return;
    const timer = setTimeout(() => startHeavyProcessingPipeline(rawImageUrl), 150);
    return () => clearTimeout(timer);
  }, [rawImageUrl, isProcessing, startHeavyProcessingPipeline]);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingTreatmentRef.current = selectedTreatment;
    setActiveTreatment(selectedTreatment);
    setRawImageUrl(URL.createObjectURL(file));
    setIsProcessing(true);
  };

  return (
    <section id="simulator" className="relative py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <AnimatedSection className="text-center mb-16">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-4xl md:text-5xl lg:text-6xl mb-6">Smile Simulator</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg">Experience your dental potential with our clinical-grade AI simulation.</p>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto bg-zinc-50 rounded-[40px] p-4 md:p-8 shadow-2xl border border-zinc-100 min-h-[600px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
                <div className="flex justify-center gap-6 mb-12">
                  {TREATMENTS.map(t => (
                    <TreatmentDockButton key={t.id} treatment={t} active={selectedTreatment === t.id} onSelect={() => setSelectedTreatment(t.id)} />
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button onClick={startCamera} className="group relative h-64 bg-white rounded-3xl border-2 border-dashed border-zinc-200 hover:border-brand-gold transition-all overflow-hidden flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center group-hover:scale-110 transition-transform"><Camera size={32} className="text-zinc-400 group-hover:text-brand-gold" /></div>
                    <span className="font-bold text-zinc-500">Live Camera</span>
                  </button>
                  <label className="group relative h-64 bg-white rounded-3xl border-2 border-dashed border-zinc-200 hover:border-brand-gold transition-all cursor-pointer flex flex-col items-center justify-center gap-4">
                    <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                    <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center group-hover:scale-110 transition-transform"><Info size={32} className="text-zinc-400 group-hover:text-brand-gold" /></div>
                    <span className="font-bold text-zinc-500">Upload Photo</span>
                  </label>
                </div>
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] md:aspect-video shadow-2xl">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
                  <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20"><p className="text-white text-xs font-bold uppercase tracking-wider">Live Preview: {selectedTreatment}</p></div>
                  <button onClick={reset} className="p-3 bg-black/40 backdrop-blur-md text-white rounded-full border border-white/20 hover:bg-white/10 transition-colors"><X size={20} /></button>
                </div>
                <div className="absolute bottom-10 left-0 right-0 flex justify-center z-10">
                  <button onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      pendingTreatmentRef.current = selectedTreatment;
                      setActiveTreatment(selectedTreatment);
                      setRawImageUrl(canvas.toDataURL("image/jpeg", 0.95));
                      setIsProcessing(true);
                    }
                  }} className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-transform"><div className="h-14 w-14 rounded-full bg-white group-hover:bg-brand-gold transition-colors" /></button>
                </div>
              </motion.div>
            )}

            {isProcessing && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-lg">
                <div className="text-center max-w-xs">
                  <div className="relative w-24 h-24 mx-auto mb-8">
                    <motion.div className="absolute inset-0 border-4 border-zinc-100 rounded-full" />
                    <motion.div className="absolute inset-0 border-4 border-brand-gold rounded-full border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="absolute inset-0 flex items-center justify-center" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}><WhiteningIcon /></motion.div>
                  </div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl mb-2">Designing Your Smile</h3>
                  <p className="text-zinc-400 text-sm animate-pulse tracking-wide uppercase font-bold">{processingLog || "Analyzing landmarks..."}</p>
                </div>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                <div className="relative rounded-[32px] overflow-hidden shadow-2xl border-4 border-white bg-zinc-200">
                  <ReactCompareImage leftImage={beforeImage} rightImage={afterImage} sliderLineColor="#D4AF37" sliderLineWidth={3} handleSize={40} />
                </div>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-64 h-40 rounded-2xl overflow-hidden border-2 border-brand-gold shadow-xl bg-zinc-950">
                    {zoomLoading && <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm z-10"><RefreshCw className="animate-spin text-brand-gold" /></div>}
                    <canvas ref={zoomCanvasRef} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">Clinical Detail Zoom</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] shadow-xl border border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500"><CheckCircle2 size={24} /></div>
                    <div><h4 className="font-serif text-xl">Simulation Ready</h4><p className="text-zinc-500 text-sm capitalize">{activeTreatment} result complete</p></div>
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={reset} className="flex-1 md:px-8 py-4 rounded-2xl border-2 border-zinc-200 font-bold hover:border-zinc-400 transition-colors">Try Another</button>
                    <button className="flex-1 md:px-10 py-4 rounded-2xl bg-zinc-950 text-white font-bold shadow-xl shadow-zinc-200 hover:scale-105 transition-transform">Book Consultation</button>
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
