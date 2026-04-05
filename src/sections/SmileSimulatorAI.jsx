import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, CheckCircle2, Info, Sparkles, RefreshCw, AlignCenter, ShieldPlus, Link2 } from "lucide-react";

import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

const TREATMENTS = [
  { id: "whitening", label: "Whitening", icon: Sparkles, desc: "Visible whitening" },
  { id: "alignment", label: "Alignment", icon: AlignCenter, desc: "Subtle straightening" },
  { id: "braces", label: "Braces", icon: Link2, desc: "Straighter teeth + bracket preview" },
  { id: "transformation", label: "Full Smile", icon: ShieldPlus, desc: "Whitening + alignment" },
];

/** Lip / mouth perimeter — note: landmark 0 is NOT on the mouth in FaceMesh (it skews the box); use lip/chin points only */
const MOUTH_PERIMETER_INDICES = [61, 291, 17, 13, 14, 78, 308, 181];
/** Fallback if any of the above are missing (minimal mouth hull) */
const MOUTH_FALLBACK_INDICES = [61, 291, 13, 14, 78, 308];
/** Used only for sanity (eyes should sit above the mouth), not for mouth box math */
const EYE_SANITY_INDICES = [33, 133, 362, 263];
const OVAL_FEATHER_PX = 16;
/** Gaussian feather on whitening composite (tighter = less gray fog on lips). */
const MASK_CLIP_FEATHER_PX = 5;
/** Whitening must stay at least this many px occlusal to the estimated gingival line (upper arch / general). */
const GUM_CLEARANCE_PX = 5;
/** Extra buffer on the lower arch (more lip movement; stricter gum lock). */
const LOWER_GUM_CLEARANCE_PX = 8;
/** Pre-color luminance above this ends interdental gradient (tighter gaps, sharper tooth edges). */
const INTERDENTAL_SHADOW_LUM_MAX = 45;
/** Default centroid inset; commissures use WHITEN_MASK_LIP_INSET_CORNER_PX. */
const WHITEN_MASK_LIP_INSET_PX = 5;
const WHITEN_MASK_LIP_INSET_CORNER_PX = 6;
/** Never place mask vertices closer than this to outer lip/gum landmark points. */
const LIP_GUM_LANDMARK_GUARD_PX = 5;
/** Inclusive enamel: include yellow + shadowed teeth in masks (higher sat cap, lower lum floor). */
const ENAMEL_LUM_MIN = 15;
const ENAMEL_LUM_MAX = 252;
const ENAMEL_SAT_MAX = 0.58;
/** Longest edge (px) for Replicate payload — smaller = faster upload + GPU; merged back to full bounds in the client. */
const API_MOUTH_MAX_EDGE = 768;

/** Inner-only teeth loop — tissue-safe whitening (tighter than lip line). */
const TEETH_WHITEN_MASK_INDICES = [13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82];
/** Inner mouth cluster used for adaptive biometric tooth scan. */
const MOUTH_LANDMARKS = TEETH_WHITEN_MASK_INDICES;
/** Nose–chin axis (facial midline X). */
const NOSE_MIDLINE_IDX = 4;
const CHIN_MIDLINE_IDX = 152;
/** Commissures → mouth width (px); count snapped to odd professional set. */
const COMMISSURE_LEFT_IDX = 61;
const COMMISSURE_RIGHT_IDX = 291;
/** Mean Y of these FaceMesh points → upper lip band (occlusal anchor, not generic mid-face). */
const BRACES_UPPER_LIP_Y_INDICES = [61, 185, 40, 39, 37, 267, 269, 270, 409, 78, 191, 80, 81, 82, 312, 311, 310];
/** Mean Y of these → lower lip band; with upper mean, defines enamel vertical span for bracket rows. */
const BRACES_LOWER_LIP_Y_INDICES = [146, 91, 181, 84, 17, 314, 405, 321, 375, 14, 87, 178, 88, 95, 308, 324, 318];
/**
 * Full smile: commissure-wide mouth strip + loose lateral enamel mask; density peaks + 28-col merge (<=14 upper, <=14 lower);
 * 20% face clamp; 5-pt smooth; 1.2px wire + 3px shadow.
 */
const BRACKET_DRAW_SIDE_PX = 10;
/** Catmull–Rom samples per inter-centroid segment (smooth archwire; minimum 20 enforced in sampler). */
const CATMULL_WIRE_STEPS_PER_SEGMENT = 20;
/** Fallback column count across enamel span if density peak detection finds too few teeth. */
const GRID_ENAMEL_COLUMNS = 28;
/** 3px-wide horizontal window: luminance refinement at each density peak (gap avoidance). */
const LUMINANCE_PEAK_STRIP_WIDTH_PX = 3;
/** Keep bracket mid-Y inside tooth face: 20% inset from gum and from biting edge. */
const BRACKET_VERTICAL_FACE_SAFE_FRAC = 0.2;
/** 1D box half-width (px) on summed luminance density before local-max scan. */
const ENAMEL_DENSITY_BLUR_HALF_WX = 2;
/** Local peak vs arch max; lower = keep dimmer molars at left/right. */
const ENAMEL_DENSITY_PEAK_MIN_FRAC = 0.14;
/** Lower-arch studs must sit at least this far below arch midline Y (image px). */
const LOWER_ARCH_Y_SPLIT_OFFSET_PX = 10;
/** Max upper-arch studs (wide smile / molars). */
const UPPER_ARCH_MAX_LUMINANCE_PEAKS = 14;
/** Lower arch: cap after mirroring upper (match wide upper arch). */
const LOWER_ARCH_SUBSAMPLE_MAX = 14;
/** Surgical silver spline (mandate). */
const ARCHWIRE_LINE_WIDTH_PX = 1.2;
/** Cap studs per arch (wide smiles). */
const MAX_CENTROID_STUDS_PER_ARCH = 22;
/** Delay (ms) after rAF flush so landmarks/pixels settle before hardware draw. */
const BRACES_HARDWARE_SETTLE_MS = 50;
const HARDWARE_LAYER_SHADOW_BLUR_PX = 3;
const ARCHWIRE_SHADOW_BLUR_PX = 3;
const HARDWARE_SHADOW_COLOR = "rgba(0,0,0,0.8)";
/** Upper-arch specular dots for enamel gloss (overlay radials). */
const ENAMEL_SPECULAR_INDICES = [82, 81, 311];

/** Mouth-only fallback (user-specified). If ≥4 land inside the guide oval, we still run the sim. */
const MOUTH_FIRST_INDICES = [0, 13, 14, 17, 37, 267];
/** Last resort for tight mouth crops: hull from lip corners + commissures (no oval / eye checks). */
const MINIMAL_MOUTH_HULL_INDICES = [78, 308, 13, 14, 61, 291, 17];
/**
 * Normalized guide ellipse (matches enlarged camera overlay). Radii are 20% larger than a typical base so landmarks near the frame still count.
 */
const MOUTH_GUIDE_OVAL_NORM = { cx: 0.5, cy: 0.56, rx: 0.2 * 1.2, ry: 0.12 * 1.2 };

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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const normalized = await normalizeImage(ev.target.result, 1024);
      processWithAI(normalized);
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
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

    const maxWidth = 1024;
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const outW = Math.round(video.videoWidth * scale);
    const outH = Math.round(video.videoHeight * scale);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = outW;
    canvas.height = outH;
    ctx.drawImage(video, 0, 0, outW, outH);

    const captured = canvas.toDataURL("image/jpeg", 0.88);
    stopCamera();
    processWithAI(captured);
  };

  const normalizeImage = async (imageSrc, maxWidth = 1024) => {
    const img = await loadImage(imageSrc);
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  /** Downscale mouth JPEG + mask PNG together so Replicate receives smaller tensors (faster end-to-end). */
  const scaleMouthAndMaskForApi = async (mouthDataUrl, maskDataUrl, maxEdge) => {
    const mouthImg = await loadImage(mouthDataUrl);
    const w = mouthImg.width;
    const h = mouthImg.height;
    const longest = Math.max(w, h);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    if (scale >= 1) return { mouth: mouthDataUrl, mask: maskDataUrl };

    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const c1 = document.createElement("canvas");
    c1.width = nw;
    c1.height = nh;
    c1.getContext("2d").drawImage(mouthImg, 0, 0, nw, nh);
    const mouthScaled = c1.toDataURL("image/jpeg", 0.88);

    const maskImg = await loadImage(maskDataUrl);
    const c2 = document.createElement("canvas");
    c2.width = nw;
    c2.height = nh;
    c2.getContext("2d").drawImage(maskImg, 0, 0, nw, nh);
    const maskScaled = c2.toDataURL("image/png");

    return { mouth: mouthScaled, mask: maskScaled };
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Normalized distance inside ellipse: <=1 inside, ~1..(1+feather) feather zone */
  const ellipseFeatherWeight = (px, py, oval, featherPx) => {
    const { cx, cy, rx, ry } = oval;
    if (rx <= 0 || ry <= 0) return 0;
    const nx = (px - cx) / rx;
    const ny = (py - cy) / ry;
    const dist = Math.sqrt(nx * nx + ny * ny);
    const edge = 1;
    const outer = 1 + featherPx / Math.max(rx, ry);
    if (dist <= edge) return 1;
    if (dist >= outer) return 0;
    const t = (outer - dist) / (outer - edge);
    return t * t * (3 - 2 * t);
  };

  /**
   * Mouth geometry from lip/chin landmarks only (no nose/forehead indices).
   * Tries primary index set, then a smaller fallback set.
   */
  const buildMouthAnalysis = (landmarks, iw, ih, indices) => {
    for (const i of indices) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    indices.forEach((i) => {
      const p = landmarks[i];
      const x = p.x * iw;
      const y = p.y * ih;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    if (!(maxX > minX && maxY > minY)) return null;

    const padX = (maxX - minX) * 0.14 + 6;
    const padY = (maxY - minY) * 0.18 + 8;

    let x = Math.floor(minX - padX);
    let y = Math.floor(minY - padY);
    let width = Math.ceil(maxX - minX + padX * 2);
    let height = Math.ceil(maxY - minY + padY * 2);

    x = clamp(x, 0, iw - 1);
    y = clamp(y, 0, ih - 1);
    width = clamp(width, 24, iw - x);
    height = clamp(height, 24, ih - y);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max((maxX - minX) / 2 * 1.08, 12);
    const ry = Math.max((maxY - minY) / 2 * 1.12, 10);

    const mouthWidthNorm = Math.abs(landmarks[291].x - landmarks[61].x);
    const mouthCenterY = (landmarks[13].y + landmarks[14].y) / 2;
    const lipSep = Math.abs(landmarks[14].y - landmarks[13].y);

    const eyeYs = EYE_SANITY_INDICES.map((ei) => landmarks[ei]?.y).filter((v) => typeof v === "number");
    const avgEyeY = eyeYs.length ? eyeYs.reduce((a, b) => a + b, 0) / eyeYs.length : 0.35;
    let eyeFactor = 1;
    if (avgEyeY >= mouthCenterY + 0.04) eyeFactor = 0.45;
    else if (avgEyeY >= mouthCenterY - 0.005) eyeFactor = 0.88;

    const wScore = mouthWidthNorm > 0.08 && mouthWidthNorm < 0.58 ? 1 : Math.max(0.15, 1 - Math.abs(mouthWidthNorm - 0.28) * 4);
    const yScore = mouthCenterY > 0.3 && mouthCenterY < 0.94 ? 1 : 0.45;
    const hScore = lipSep > 0.002 ? 1 : 0.78;
    const posScore = cy / ih > 0.3 && cy / ih < 0.92 ? 1 : 0.5;

    const confidence = clamp(
      (0.32 * wScore + 0.28 * yScore + 0.22 * hScore + 0.18 * posScore) * eyeFactor,
      0,
      1
    );

    return {
      confidence,
      bounds: { x, y, width, height },
      oval: { cx, cy, rx, ry },
    };
  };

  const analyzeMouthFromLandmarks = (landmarks, iw, ih) =>
    buildMouthAnalysis(landmarks, iw, ih, MOUTH_PERIMETER_INDICES) ||
    buildMouthAnalysis(landmarks, iw, ih, MOUTH_FALLBACK_INDICES);

  /** Slightly looser hit-test (15%) so landmarks just outside the drawn guide still qualify */
  const pointInNormalizedGuideOval = (nx, ny) => {
    const o = MOUTH_GUIDE_OVAL_NORM;
    const hitRx = o.rx * 1.15;
    const hitRy = o.ry * 1.15;
    const dx = (nx - o.cx) / hitRx;
    const dy = (ny - o.cy) / hitRy;
    return dx * dx + dy * dy <= 1.03;
  };

  /** ≥4 of the mouth-first points inside guide → proceed without full-face hull */
  const buildAnalysisFromMouthFirstIndices = (landmarks, iw, ih) => {
    const inGuide = [];
    for (const i of MOUTH_FIRST_INDICES) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
      if (!pointInNormalizedGuideOval(p.x, p.y)) continue;
      inGuide.push({ x: p.x * iw, y: p.y * ih });
    }
    if (inGuide.length < 4) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    inGuide.forEach(({ x, y }) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    if (!(maxX > minX && maxY > minY)) return null;

    const padX = (maxX - minX) * 0.18 + 8;
    const padY = (maxY - minY) * 0.22 + 10;

    let x = Math.floor(minX - padX);
    let y = Math.floor(minY - padY);
    let width = Math.ceil(maxX - minX + padX * 2);
    let height = Math.ceil(maxY - minY + padY * 2);

    x = clamp(x, 0, iw - 1);
    y = clamp(y, 0, ih - 1);
    width = clamp(width, 24, iw - x);
    height = clamp(height, 24, ih - y);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max((maxX - minX) / 2 * 1.1, 12);
    const ry = Math.max((maxY - minY) / 2 * 1.15, 10);

    return {
      confidence: 0.55,
      bounds: { x, y, width, height },
      oval: { cx, cy, rx, ry },
    };
  };

  /** When full mouth hull / oval gate fails (e.g. extreme close-up), still derive bounds from core mouth indices. */
  const buildAnalysisFromMinimalMouthHull = (landmarks, iw, ih) => {
    for (const i of MINIMAL_MOUTH_HULL_INDICES) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    MINIMAL_MOUTH_HULL_INDICES.forEach((i) => {
      const p = landmarks[i];
      const x = p.x * iw;
      const y = p.y * ih;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    if (!(maxX > minX && maxY > minY)) return null;

    const padX = (maxX - minX) * 0.2 + 8;
    const padY = (maxY - minY) * 0.24 + 10;

    let x = Math.floor(minX - padX);
    let y = Math.floor(minY - padY);
    let width = Math.ceil(maxX - minX + padX * 2);
    let height = Math.ceil(maxY - minY + padY * 2);

    x = clamp(x, 0, iw - 1);
    y = clamp(y, 0, ih - 1);
    width = clamp(width, 24, iw - x);
    height = clamp(height, 24, ih - y);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = Math.max((maxX - minX) / 2 * 1.1, 12);
    const ry = Math.max((maxY - minY) / 2 * 1.15, 10);

    return {
      confidence: 0.42,
      bounds: { x, y, width, height },
      oval: { cx, cy, rx, ry },
    };
  };

  const tryAnalyzeLandmarksFullOrMouthFirst = (landmarks, iw, ih) =>
    analyzeMouthFromLandmarks(landmarks, iw, ih) ||
    buildAnalysisFromMouthFirstIndices(landmarks, iw, ih) ||
    buildAnalysisFromMinimalMouthHull(landmarks, iw, ih);

  /** Brightness/contrast lift on guide ellipse bbox to help detectors in shadows */
  const boostMouthGuideRegion = (ctx, iw, ih) => {
    const o = MOUTH_GUIDE_OVAL_NORM;
    const px = o.cx * iw;
    const py = o.cy * ih;
    const prx = o.rx * iw;
    const pry = o.ry * ih;
    const pad = 1.1;
    const x0 = clamp(Math.floor(px - prx * pad), 0, iw - 1);
    const y0 = clamp(Math.floor(py - pry * pad), 0, ih - 1);
    const x1 = clamp(Math.ceil(px + prx * pad), 0, iw);
    const y1 = clamp(Math.ceil(py + pry * pad), 0, ih);
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw < 8 || rh < 8) return;

    const imageData = ctx.getImageData(x0, y0, rw, rh);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      const contrast = 1.1;
      const bright = 18;
      r = (r - 128) * contrast + 128 + bright;
      g = (g - 128) * contrast + 128 + bright;
      b = (b - 128) * contrast + 128 + bright;
      d[i] = clamp(Math.round(r), 0, 255);
      d[i + 1] = clamp(Math.round(g), 0, 255);
      d[i + 2] = clamp(Math.round(b), 0, 255);
    }
    ctx.putImageData(imageData, x0, y0);
  };

  /** Typical selfie mouth band when ML fails (iOS Safari / blocked CDN) */
  const heuristicMouthRegion = (iw, ih) => {
    const cx = iw * 0.5;
    const cy = ih * 0.63;
    const rx = Math.max(iw * 0.19, 14);
    const ry = Math.max(ih * 0.1, 10);
    const width = clamp(Math.ceil(rx * 2.45), 48, iw);
    const height = clamp(Math.ceil(ry * 2.35), 40, ih);
    const x = clamp(Math.floor(cx - width / 2), 0, iw - width);
    const y = clamp(Math.floor(cy - height / 2), Math.floor(ih * 0.45), Math.max(0, ih - height));
    return {
      confidence: 0.35,
      bounds: { x, y, width, height },
      oval: { cx, cy, rx, ry },
    };
  };

  const tryFaceLandmarker = async (canvas) => {
    const landmarker = await initFaceLandmarker();
    if (!landmarker) return null;
    let result;
    try {
      result = landmarker.detect(canvas);
    } catch {
      return null;
    }
    const faceLm = result?.faceLandmarks?.[0];
    if (!faceLm || faceLm.length < 50) return null;
    const analysis = tryAnalyzeLandmarksFullOrMouthFirst(faceLm, canvas.width, canvas.height);
    if (!analysis) return null;
    return { ...analysis, landmarks: faceLm };
  };

  const runFaceMeshOnCanvas = (canvas) =>
    new Promise((resolve) => {
      const fail = { ok: false };
      let settled = false;
      let timer;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        resolve(payload);
      };
      timer = window.setTimeout(() => finish(fail), 12000);

      initFaceMesh().then((faceMesh) => {
        if (!faceMesh) {
          finish(fail);
          return;
        }

        faceMesh.onResults((results) => {
          const landmarks = results?.multiFaceLandmarks?.[0];
          if (!landmarks) {
            finish(fail);
            return;
          }
          const analysis = tryAnalyzeLandmarksFullOrMouthFirst(landmarks, canvas.width, canvas.height);
          if (!analysis) {
            finish(fail);
            return;
          }
          finish({ ok: true, ...analysis, landmarks });
        });

        faceMesh.send({ image: canvas }).catch(() => finish(fail));
      });
    });

  /**
   * 1) Face Landmarker (reliable on mobile Safari)
   * 2) Legacy FaceMesh with **Canvas** (HTMLImageElement often fails on iOS)
   * 3) Heuristic mouth band (always returns bounds so users aren’t blocked)
   */
  const detectMouth = async (imageSrc) => {
    const img = await loadImage(imageSrc);
    if (typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        /* ignore */
      }
    }

    const iw = img.width;
    const ih = img.height;
    const canvas = document.createElement("canvas");
    canvas.width = iw;
    canvas.height = ih;
    const detCtx = canvas.getContext("2d");
    detCtx.drawImage(img, 0, 0);
    boostMouthGuideRegion(detCtx, iw, ih);

    let lm = null;
    try {
      lm = await tryFaceLandmarker(canvas);
    } catch {
      lm = null;
    }
    if (lm) {
      return attachSimulationRenderer({
        ok: true,
        bounds: lm.bounds,
        oval: lm.oval,
        confidence: lm.confidence,
        landmarks: lm.landmarks,
      });
    }

    const mesh = await runFaceMeshOnCanvas(canvas);
    if (mesh.ok && mesh.bounds && mesh.oval) {
      return attachSimulationRenderer(mesh);
    }

    const h = heuristicMouthRegion(iw, ih);
    return attachSimulationRenderer({ ok: true, ...h, landmarks: null });
  };

  const squareCropRect = (iw, ih, oval) => {
    const maxSide = Math.min(iw, ih);
    let side = Math.min(maxSide, Math.ceil(2.35 * Math.max(oval.rx, oval.ry)));
    side = clamp(side, 120, maxSide);
    let x0 = Math.round(oval.cx - side / 2);
    let y0 = Math.round(oval.cy - side / 2);
    x0 = clamp(x0, 0, iw - side);
    y0 = clamp(y0, 0, ih - side);
    return { x: x0, y: y0, width: side, height: side };
  };

  const cropImageToDataUrl = async (imageSrc, rect) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  /**
   * Gum clearance (strict) + inner inset toward centroid so paint stays off lips; prefer bare enamel
   * over tinting soft tissue.
   */
  const getTightenedWhiteningMaskPoints = (landmarks, iw, ih) => {
    const p13 = landmarks[13];
    const p14 = landmarks[14];
    if (!p13 || !p14) return null;
    const midYpx = ((p13.y + p14.y) / 2) * ih;
    const pts = TEETH_WHITEN_MASK_INDICES.map((idx) => {
      const p = landmarks[idx];
      if (!p || typeof p.x !== "number") return null;
      return { x: p.x * iw, y: p.y * ih };
    }).filter(Boolean);
    if (pts.length < 3) return null;
    const out = pts.map((p) => ({ x: p.x, y: p.y }));
    const lower = out.filter((p) => p.y > midYpx - 0.5);
    if (lower.length >= 2) {
      const lowerGumY = Math.min(...lower.map((p) => p.y));
      const lowerLipY = Math.max(...lower.map((p) => p.y));
      const span = Math.max(6, lowerLipY - lowerGumY);
      const yMaxSafe = lowerLipY - LOWER_GUM_CLEARANCE_PX;
      const yMinLower = Math.min(lowerGumY + span * 0.4, yMaxSafe - 4);
      out.forEach((p) => {
        if (p.y > midYpx - 0.5) {
          p.y = Math.max(p.y, yMinLower);
          p.y = Math.min(p.y, yMaxSafe);
        }
      });
    }
    const upper = out.filter((p) => p.y <= midYpx + 0.5);
    if (upper.length >= 2) {
      const upperGumY = Math.min(...upper.map((p) => p.y));
      const upperToothY = Math.max(...upper.map((p) => p.y));
      const span = Math.max(6, upperToothY - upperGumY);
      const yMinSafe = Math.max(upperGumY + GUM_CLEARANCE_PX, upperGumY + GUM_CLEARANCE_PX + span * 0.1);
      out.forEach((p) => {
        if (p.y <= midYpx + 0.5) p.y = Math.max(p.y, yMinSafe);
      });
    }
    const cx = out.reduce((s, p) => s + p.x, 0) / out.length;
    const cy = out.reduce((s, p) => s + p.y, 0) / out.length;
    const xs = out.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const cornerBand = Math.max(20, (maxX - minX) * 0.2);
    out.forEach((p) => {
      const nearCorner = p.x <= minX + cornerBand || p.x >= maxX - cornerBand;
      const inset = nearCorner ? WHITEN_MASK_LIP_INSET_CORNER_PX : WHITEN_MASK_LIP_INSET_PX;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      p.x -= (dx / len) * inset;
      p.y -= (dy / len) * inset;
    });
    const lipGumPx = [...new Set([...MOUTH_PERIMETER_INDICES, 312, 308, 415, 310])]
      .map((idx) => landmarks[idx])
      .filter((p) => p && typeof p.x === "number")
      .map((p) => ({ x: p.x * iw, y: p.y * ih }));
    const g = LIP_GUM_LANDMARK_GUARD_PX;
    out.forEach((p) => {
      lipGumPx.forEach((L) => {
        const dx = p.x - L.x;
        const dy = p.y - L.y;
        const d = Math.hypot(dx, dy);
        if (d < g && d > 1e-6) {
          const push = (g - d) / d;
          p.x += dx * push;
          p.y += dy * push;
        }
      });
    });
    return out;
  };

  /**
   * Brace hull: gum Y-clamps only (no centroid inset / lip-guard). Horizontal span scaled to ~106% commissure
   * width so the TEETH_WHITEN loop is not lip-clipped for molar coverage; raster may add lateral enamel outside poly.
   */
  const getBraceScanPolygonPoints = (landmarks, iw, ih) => {
    const p13 = landmarks[13];
    const p14 = landmarks[14];
    if (!p13 || !p14) return null;
    const midYpx = ((p13.y + p14.y) / 2) * ih;
    const pts = TEETH_WHITEN_MASK_INDICES.map((idx) => {
      const p = landmarks[idx];
      if (!p || typeof p.x !== "number") return null;
      return { x: p.x * iw, y: p.y * ih };
    }).filter(Boolean);
    if (pts.length < 3) return null;
    const out = pts.map((p) => ({ x: p.x, y: p.y }));
    const lower = out.filter((p) => p.y > midYpx - 0.5);
    if (lower.length >= 2) {
      const lowerGumY = Math.min(...lower.map((p) => p.y));
      const lowerLipY = Math.max(...lower.map((p) => p.y));
      const span = Math.max(6, lowerLipY - lowerGumY);
      const yMaxSafe = lowerLipY - LOWER_GUM_CLEARANCE_PX;
      const yMinLower = Math.min(lowerGumY + span * 0.4, yMaxSafe - 4);
      out.forEach((p) => {
        if (p.y > midYpx - 0.5) {
          p.y = Math.max(p.y, yMinLower);
          p.y = Math.min(p.y, yMaxSafe);
        }
      });
    }
    const upper = out.filter((p) => p.y <= midYpx + 0.5);
    if (upper.length >= 2) {
      const upperGumY = Math.min(...upper.map((p) => p.y));
      const upperToothY = Math.max(...upper.map((p) => p.y));
      const span = Math.max(6, upperToothY - upperGumY);
      const yMinSafe = Math.max(upperGumY + GUM_CLEARANCE_PX, upperGumY + GUM_CLEARANCE_PX + span * 0.1);
      out.forEach((p) => {
        if (p.y <= midYpx + 0.5) p.y = Math.max(p.y, yMinSafe);
      });
    }
    const comL = landmarks[COMMISSURE_LEFT_IDX];
    const comR = landmarks[COMMISSURE_RIGHT_IDX];
    if (comL && comR && typeof comL.x === "number" && typeof comR.x === "number") {
      const xs = out.map((p) => p.x);
      const minXp = Math.min(...xs);
      const maxXp = Math.max(...xs);
      const w0 = Math.max(1e-3, maxXp - minXp);
      const wMouth = Math.abs(comR.x * iw - comL.x * iw);
      /** Full commissure span + margin so molars sit inside the brace hull (not lip-clipped). */
      const wTarget = Math.max(w0, wMouth * 1.06);
      const cx = (minXp + maxXp) * 0.5;
      const scale = wTarget / w0;
      for (const p of out) {
        p.x = cx + (p.x - cx) * scale;
      }
    }
    return out;
  };

  /** Anatomical teeth region from landmarks; caller must ctx.save() before and ctx.restore() after. */
  const generateTeethMask = (landmarks, ctx, iw, ih) => {
    const pts = getTightenedWhiteningMaskPoints(landmarks, iw, ih);
    if (!pts || pts.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.clip();
    return true;
  };

  /** iOS / mobile: subtle contrast + saturation on mouth crop so previews read clearly after boostMouthGuideRegion. */
  const applyMouthPopFilter = (ctx, bounds) => {
    if (!bounds) return;
    const { width: cw, height: ch } = ctx.canvas;
    let { x, y, width, height } = bounds;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 2 ||
      height < 2
    ) {
      return;
    }
    x = Math.max(0, Math.floor(x));
    y = Math.max(0, Math.floor(y));
    width = Math.min(Math.floor(width), cw - x);
    height = Math.min(Math.floor(height), ch - y);
    if (width < 2 || height < 2 || x >= cw || y >= ch) return;

    try {
      const tmp = document.createElement("canvas");
      tmp.width = width;
      tmp.height = height;
      const tctx = tmp.getContext("2d", { willReadFrequently: false });
      if (!tctx) return;
      tctx.filter = "contrast(1.05) saturate(1.1)";
      tctx.drawImage(ctx.canvas, x, y, width, height, 0, 0, width, height);
      tctx.filter = "none";
      ctx.drawImage(tmp, 0, 0, width, height, x, y, width, height);
    } catch {
      /* Edge-to-edge / tainted canvas / memory: skip pop rather than breaking the pipeline */
    }
  };

  /**
   * Ivory: `color` desat → arch-adaptive blend → interdental gradient → orig-lum translucency → soft-light.
   */
  const applyLuminosityWhiteningPass = (ctx, iw, ih, strength = 0.4, landmarks = null) => {
    ctx.filter = "contrast(1.1) brightness(1.03)";
    ctx.drawImage(ctx.canvas, 0, 0, iw, ih, 0, 0, iw, ih);
    ctx.filter = "none";

    const preColor = document.createElement("canvas");
    preColor.width = iw;
    preColor.height = ih;
    const preCtx = preColor.getContext("2d", { willReadFrequently: true });
    if (!preCtx) return;
    preCtx.drawImage(ctx.canvas, 0, 0);
    const preData = preCtx.getImageData(0, 0, iw, ih).data;

    const chromaLayer = document.createElement("canvas");
    chromaLayer.width = iw;
    chromaLayer.height = ih;
    const zctx = chromaLayer.getContext("2d", { willReadFrequently: true });
    if (!zctx) return;
    zctx.drawImage(ctx.canvas, 0, 0);
    const zimg = zctx.getImageData(0, 0, iw, ih);
    const zd = zimg.data;
    const desat = 0.48;
    for (let i = 0; i < zd.length; i += 4) {
      const r = zd[i];
      const g = zd[i + 1];
      const b = zd[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      zd[i] = Math.round(lum + (r - lum) * (1 - desat));
      zd[i + 1] = Math.round(lum + (g - lum) * (1 - desat));
      zd[i + 2] = Math.round(lum + (b - lum) * (1 - desat));
    }
    zctx.putImageData(zimg, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "color";
    ctx.drawImage(chromaLayer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    const layer = document.createElement("canvas");
    layer.width = iw;
    layer.height = ih;
    const lctx = layer.getContext("2d", { willReadFrequently: true });
    if (!lctx) return;
    lctx.drawImage(ctx.canvas, 0, 0);

    const img = lctx.getImageData(0, 0, iw, ih);
    const d = img.data;
    const ivory = { r: 252, g: 249, b: 241 };

    let sumLum = 0;
    let nArch = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      if (lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX) {
        sumLum += lum;
        nArch += 1;
      }
    }
    const archMeanLum = nArch > 0 ? sumLum / nArch : 150;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const origLum =
        0.2126 * preData[i] + 0.7152 * preData[i + 1] + 0.0722 * preData[i + 2];
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      const inEnamelBand = lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX;
      const baseW = clamp((lum - 8) / 230, 0, 1);
      let adapt = 0;
      if (inEnamelBand) {
        if (lum < 60) adapt = 2.0;
        else adapt = 1 + clamp((archMeanLum - lum) / (archMeanLum * 0.42 + 8), 0, 1.6);
      }
      let w = clamp(baseW * adapt, 0, 1.28);
      if (origLum < INTERDENTAL_SHADOW_LUM_MAX) {
        const t = origLum / Math.max(INTERDENTAL_SHADOW_LUM_MAX, 1);
        const gapFalloff = t * t;
        w *= 0.05 + 0.22 * gapFalloff;
      }
      const translucency = 0.22 + 0.78 * (origLum / 255);
      w *= translucency;
      d[i] = Math.round(r + (ivory.r - r) * w);
      d[i + 1] = Math.round(g + (ivory.g - g) * w);
      d[i + 2] = Math.round(b + (ivory.b - b) * w);
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
        lctx.lineJoin = "round";
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

  /**
   * Gum-line occlusion + wet-enamel speculars (caller must have active teeth or oval clip).
   * Order: inner shadow band → overlay highlights.
   */
  const applyEnamelGlossAndGumOcclusion = (ctx, iw, ih, landmarks, oval) => {
    let yTop;
    let yBandEnd;

    if (landmarks) {
      const ys = TEETH_WHITEN_MASK_INDICES.map((i) => landmarks[i]?.y).filter((v) => typeof v === "number");
      if (ys.length >= 2) {
        const minY = Math.min(...ys.map((ny) => ny * ih));
        const maxY = Math.max(...ys.map((ny) => ny * ih));
        const span = maxY - minY;
        yTop = minY;
        yBandEnd = minY + span * 0.1;
      }
    }
    if (yTop === undefined && oval) {
      const span = oval.ry * 2;
      yTop = oval.cy - oval.ry;
      yBandEnd = yTop + span * 0.1;
    }
    if (yTop !== undefined && yBandEnd > yTop) {
      ctx.save();
      const g = ctx.createLinearGradient(0, yTop, 0, yBandEnd);
      g.addColorStop(0, "rgba(0,0,0,0.2)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = g;
      ctx.fillRect(0, yTop, iw, yBandEnd - yTop);
      ctx.restore();
    }

    if (!landmarks) return;
    const specIdx = ENAMEL_SPECULAR_INDICES.filter((i) => landmarks[i]);
    if (!specIdx.length) return;

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    specIdx.slice(0, 3).forEach((i) => {
      const px = landmarks[i].x * iw;
      const py = landmarks[i].y * ih;
      const rad = 5;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, rad);
      rg.addColorStop(0, "rgba(255,255,255,0.7)");
      rg.addColorStop(0.55, "rgba(255,255,255,0.15)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  /**
   * 1:1 roundRect: radial jet #0a0a0a → rim #e8eaee; 1px white specular chip + glint; 1px charcoal channel.
   */
  const drawReflectiveMetalStud = (ctx, x, y, tangentRad, w, h, starFlare = false, omitDropShadow = false) => {
    const side = Math.min(w, h);
    const r = clamp(side * 0.11, 0.7, side * 0.2);
    const hw = side * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tangentRad + Math.PI / 2);
    if (!omitDropShadow) {
      ctx.shadowColor = HARDWARE_SHADOW_COLOR;
      ctx.shadowBlur = ARCHWIRE_SHADOW_BLUR_PX;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1.2;
    }
    const body = ctx.createRadialGradient(0, 0, side * 0.04, 0, 0, hw * 1.06);
    body.addColorStop(0, "#0a0a0a");
    body.addColorStop(0.58, "#6d737c");
    body.addColorStop(1, "#e8eaee");
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-hw, -hw, side, side, r);
    } else {
      ctx.rect(-hw, -hw, side, side);
    }
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-hw + 0.5, -hw + 0.5, 1, 1);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(-hw + 1.5, -hw + 0.5);
    ctx.lineTo(-hw + Math.min(4, side * 0.36), -hw + 0.5);
    ctx.stroke();
    ctx.strokeStyle = "#2a3038";
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, 0);
    ctx.lineTo(hw * 0.45, 0);
    ctx.stroke();
    if (starFlare) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(0.25, side * 0.05);
      ctx.beginPath();
      ctx.moveTo(-hw * 0.15, -hw * 0.48);
      ctx.lineTo(-hw * 0.05, -hw * 0.38);
      ctx.stroke();
    }
    ctx.restore();
  };

  const pointInPolygonPx = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const cross = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
      if (cross) inside = !inside;
    }
    return inside;
  };

  const pixelEnamelInTeethMask = (data, w, h, gx, gy) => {
    if (gx < 1 || gy < 1 || gx >= w - 1 || gy >= h - 1) return false;
    const i = (Math.floor(gy) * w + Math.floor(gx)) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const sat = maxc < 1 ? 0 : (maxc - minc) / maxc;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < ENAMEL_LUM_MIN || lum > ENAMEL_LUM_MAX || sat > ENAMEL_SAT_MAX) return false;
    if (r > g + 14 && r > b + 10 && sat > 0.16) return false;
    return true;
  };

  /** Slightly looser enamel test for commissure strip only (shadowed lateral teeth). */
  const pixelEnamelBracesLateral = (data, w, h, gx, gy) => {
    if (pixelEnamelInTeethMask(data, w, h, gx, gy)) return true;
    if (gx < 1 || gy < 1 || gx >= w - 1 || gy >= h - 1) return false;
    const i = (Math.floor(gy) * w + Math.floor(gx)) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const sat = maxc < 1 ? 0 : (maxc - minc) / maxc;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 10 || lum > ENAMEL_LUM_MAX || sat > 0.64) return false;
    if (r > g + 18 && r > b + 12 && sat > 0.2) return false;
    return true;
  };

  const catmullRomPoint2D = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  };

  const expandCatmullRomEnds = (pts) => {
    if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
    const n = pts.length;
    return [
      { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y },
      ...pts.map((p) => ({ x: p.x, y: p.y })),
      { x: 2 * pts[n - 1].x - pts[n - 2].x, y: 2 * pts[n - 1].y - pts[n - 2].y },
    ];
  };

  /** Catmull–Rom needs ≥2 points; duplicate with tiny offset for single-centroid arches. */
  const ensureSplineControlPoints = (pts) => {
    if (pts.length === 0) return [];
    if (pts.length === 1) {
      const p = pts[0];
      return [
        { x: p.x, y: p.y },
        { x: p.x + 1.2, y: p.y },
      ];
    }
    return pts.map((p) => ({ x: p.x, y: p.y }));
  };

  const sampleLuminanceGlobal = (data, w, imgH, gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= w || gy >= imgH) return 0;
    const i = (Math.floor(gy) * w + Math.floor(gx)) * 4;
    return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  };

  /** Mid-Y at 50% of [top,bot], clamped frac inward from gum and biting edge (tooth face). */
  const clampBracketMidYFrac = (midLy, topLy, botLy, frac) => {
    const span = botLy - topLy + 1;
    if (span < 3) return (topLy + botLy) * 0.5;
    const lo = topLy + frac * span;
    const hi = botLy - frac * span;
    if (lo > hi) return clamp(midLy, topLy, botLy);
    return clamp(midLy, lo, hi);
  };

  /**
   * Per column: slide a 3px-wide horizontal window; highest mean enamel luminance wins X (peak strip center).
   * Y = (top+bottom)/2 of enamel in that strip, clamped by BRACKET_VERTICAL_FACE_SAFE_FRAC (tooth face).
   * `imgH` must be enamelSnap.height (same scope as `w`).
   */
  const pickColumnStudLuminancePeak = (
    data,
    w,
    imgH,
    mask,
    bw,
    minX,
    minY,
    xStart,
    xEnd,
    y0,
    y1,
    stripWidthPx,
  ) => {
    if (y0 > y1 || xEnd < xStart) return null;
    const colW = xEnd - xStart + 1;
    const stripW = clamp(stripWidthPx | 0, 1, colW);
    const colMidLx = (xStart + xEnd) * 0.5;
    let bestAvg = -1;
    let bestWx0 = xStart;
    let bestWinMid = xStart + (stripW - 1) * 0.5;
    for (let wx0 = xStart; wx0 <= xEnd - stripW + 1; wx0++) {
      const wx1 = wx0 + stripW - 1;
      let sum = 0;
      let cnt = 0;
      for (let lx = wx0; lx <= wx1; lx++) {
        for (let ly = y0; ly <= y1; ly++) {
          if (mask[ly * bw + lx] !== 1) continue;
          sum += sampleLuminanceGlobal(data, w, imgH, minX + lx, minY + ly);
          cnt++;
        }
      }
      if (cnt === 0) continue;
      const avg = sum / cnt;
      const winMid = wx0 + (stripW - 1) * 0.5;
      const tie = Math.abs(winMid - colMidLx);
      const bestTie = Math.abs(bestWinMid - colMidLx);
      if (avg > bestAvg || (avg === bestAvg && tie < bestTie)) {
        bestAvg = avg;
        bestWx0 = wx0;
        bestWinMid = winMid;
      }
    }
    if (bestAvg < 0) return null;
    const sx0 = bestWx0;
    const sx1 = bestWx0 + stripW - 1;
    let topY = -1;
    let botY = -1;
    for (let lx = sx0; lx <= sx1; lx++) {
      for (let ly = y0; ly <= y1; ly++) {
        if (mask[ly * bw + lx] !== 1) continue;
        if (topY < 0 || ly < topY) topY = ly;
        if (botY < 0 || ly > botY) botY = ly;
      }
    }
    if (topY < 0) return null;
    const midRaw = (topY + botY) * 0.5;
    const midClamped = clampBracketMidYFrac(midRaw, topY, botY, BRACKET_VERTICAL_FACE_SAFE_FRAC);
    return {
      cx: minX + (sx0 + sx1) * 0.5,
      cy: minY + midClamped,
      peakMetric: bestAvg,
    };
  };

  /** Longest contiguous vertical run of enamel in one column (upper band) — thick at tooth, thin in gaps. */
  const longestEnamelRunInColumn = (mask, bw, lx, y0, y1) => {
    let best = 0;
    let cur = 0;
    for (let ly = y0; ly <= y1; ly++) {
      if (mask[ly * bw + lx] === 1) {
        cur++;
      } else {
        best = Math.max(best, cur);
        cur = 0;
      }
    }
    return Math.max(best, cur);
  };

  /**
   * Upper arch: local maxima of blurred (luminance × vertical-thickness) density → tooth centers; gaps stay low.
   * Refine each peak with 3px luminance strip. Falls back to empty array if unusable (caller uses column grid).
   */
  const buildUpperArchFromDensityLocalMaxima = (
    data,
    w,
    imgH,
    mask,
    bw,
    minX,
    minY,
    enamelMinLx,
    enamelMaxLx,
    y0,
    y1,
    maxStuds,
  ) => {
    if (y0 > y1 || enamelMaxLx < enamelMinLx) return [];
    const span = enamelMaxLx - enamelMinLx + 1;
    const raw = new Float64Array(span);
    let maxRaw = 0;
    for (let j = 0; j < span; j++) {
      const lx = enamelMinLx + j;
      let lumSum = 0;
      for (let ly = y0; ly <= y1; ly++) {
        if (mask[ly * bw + lx] !== 1) continue;
        lumSum += sampleLuminanceGlobal(data, w, imgH, minX + lx, minY + ly) / 255;
      }
      const thick = longestEnamelRunInColumn(mask, bw, lx, y0, y1);
      const v = lumSum * (1 + 0.25 * thick);
      raw[j] = v;
      if (v > maxRaw) maxRaw = v;
    }
    if (maxRaw < 1e-9) return [];

    const blurR = ENAMEL_DENSITY_BLUR_HALF_WX;
    const sm = new Float64Array(span);
    for (let j = 0; j < span; j++) {
      let s = 0;
      let c = 0;
      for (let dj = -blurR; dj <= blurR; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= span) continue;
        s += raw[jj];
        c++;
      }
      sm[j] = c > 0 ? s / c : 0;
    }

    let maxSm = 0;
    for (let j = 0; j < span; j++) if (sm[j] > maxSm) maxSm = sm[j];
    const thresh = maxSm * ENAMEL_DENSITY_PEAK_MIN_FRAC;

    const peakIdx = [];
    for (let j = 0; j < span; j++) {
      if (sm[j] < thresh) continue;
      const pl = j > 0 ? sm[j - 1] : 0;
      const pr = j < span - 1 ? sm[j + 1] : 0;
      if (span === 1) {
        peakIdx.push(0);
        break;
      }
      if (j > 0 && j < span - 1) {
        if (sm[j] > pl && sm[j] > pr) peakIdx.push(j);
      } else if (j === 0) {
        if (sm[j] > pr) peakIdx.push(j);
      } else if (sm[j] > pl) peakIdx.push(j);
    }

    const minSep = clamp(Math.floor(span / 24), 4, 12);
    peakIdx.sort((a, b) => sm[b] - sm[a]);
    const keptJ = [];
    for (const j of peakIdx) {
      const lx = enamelMinLx + j;
      let ok = true;
      for (const kj of keptJ) {
        if (Math.abs(j - kj) < minSep) {
          ok = false;
          break;
        }
      }
      if (ok) keptJ.push(j);
      if (keptJ.length >= maxStuds) break;
    }
    keptJ.sort((a, b) => a - b);

    const strip = LUMINANCE_PEAK_STRIP_WIDTH_PX;
    const win = Math.max(strip + 2, 7);
    const out = [];
    for (const j of keptJ) {
      const lxCenter = enamelMinLx + j;
      let xStart = lxCenter - Math.floor(win / 2);
      xStart = clamp(xStart, enamelMinLx, Math.max(enamelMinLx, enamelMaxLx - win + 1));
      let xEnd = Math.min(enamelMaxLx, xStart + win - 1);
      if (xEnd < xStart) xEnd = xStart;
      const refined = pickColumnStudLuminancePeak(
        data,
        w,
        imgH,
        mask,
        bw,
        minX,
        minY,
        xStart,
        xEnd,
        y0,
        y1,
        strip,
      );
      if (refined) out.push({ ...refined, area: 1 });
    }
    return out;
  };

  /**
   * Subsample column peaks left→right (≤ maxN). Strict local luminance maxima removed lateral teeth; even spacing keeps molars.
   */
  const pickUpperArchColumnPeaks = (cands, maxN) => {
    if (cands.length === 0) return [];
    const sorted = [...cands].sort((a, b) => a.cx - b.cx);
    if (sorted.length <= maxN) return sorted;
    const n = sorted.length;
    const out = [];
    for (let k = 0; k < maxN; k++) {
      const idx = Math.round((k * (n - 1)) / Math.max(1, maxN - 1));
      out.push(sorted[idx]);
    }
    return out;
  };

  /**
   * Lower arch: mirror upper X exactly; Y from 3px luminance peak in lower band at that X (face center), ≥ split + offset.
   */
  const mirrorLowerStudsExactUpperX = (
    data,
    w,
    imgH,
    mask,
    bw,
    minX,
    minY,
    yLower0,
    yLower1,
    ySplitImg,
    upperRow,
  ) => {
    const sw = LUMINANCE_PEAK_STRIP_WIDTH_PX;
    return upperRow.map((u) => {
      const lxCenter = clamp(Math.round(u.cx - minX), 0, bw - 1);
      let xStart = clamp(lxCenter - Math.floor(sw / 2), 0, bw - sw);
      let xEnd = xStart + sw - 1;
      if (xEnd > bw - 1) {
        xEnd = bw - 1;
        xStart = Math.max(0, xEnd - sw + 1);
      }
      const lo = pickColumnStudLuminancePeak(
        data,
        w,
        imgH,
        mask,
        bw,
        minX,
        minY,
        xStart,
        xEnd,
        yLower0,
        yLower1,
        sw,
      );
      const cy = lo
        ? Math.max(lo.cy, ySplitImg + LOWER_ARCH_Y_SPLIT_OFFSET_PX)
        : Math.max(ySplitImg + LOWER_ARCH_Y_SPLIT_OFFSET_PX, minY + yLower0 + 2);
      return { cx: u.cx, cy, area: 1 };
    });
  };

  const smoothArchCentroidsMovingAvg3 = (row) => {
    if (row.length === 0) return [];
    if (row.length < 3) return row.map((r) => ({ cx: r.cx, cy: r.cy, area: r.area ?? 1 }));
    return row.map((_, i) => {
      const i0 = Math.max(0, i - 1);
      const i2 = Math.min(row.length - 1, i + 1);
      return {
        cx: (row[i0].cx + row[i].cx + row[i2].cx) / 3,
        cy: (row[i0].cy + row[i].cy + row[i2].cy) / 3,
        area: row[i].area ?? 1,
      };
    });
  };

  /** 5-point moving average on cx/cy for surgical wire arc (short rows fall back to 3-pt). */
  const smoothArchCentroidsMovingAvg5 = (row) => {
    if (row.length === 0) return [];
    if (row.length < 5) return smoothArchCentroidsMovingAvg3(row);
    return row.map((_, i) => {
      const i0 = Math.max(0, i - 2);
      const i4 = Math.min(row.length - 1, i + 2);
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let k = i0; k <= i4; k++) {
        sx += row[k].cx;
        sy += row[k].cy;
        n++;
      }
      return { cx: sx / n, cy: sy / n, area: row[i].area ?? 1 };
    });
  };

  /** 3-point Y smooth only — keeps cx identical to mirrored upper after upper arch smoothing. */
  const smoothArchCyOnlyMovingAvg3 = (row) => {
    if (row.length === 0) return [];
    if (row.length < 3) return row.map((r) => ({ cx: r.cx, cy: r.cy, area: r.area ?? 1 }));
    return row.map((_, i) => {
      const i0 = Math.max(0, i - 1);
      const i2 = Math.min(row.length - 1, i + 1);
      return {
        cx: row[i].cx,
        cy: (row[i0].cy + row[i].cy + row[i2].cy) / 3,
        area: row[i].area ?? 1,
      };
    });
  };

  /** 5-point Y-only smooth; preserves mirrored upper cx (short rows use 3-pt cy). */
  const smoothArchCyOnlyMovingAvg5 = (row) => {
    if (row.length === 0) return [];
    if (row.length < 5) return smoothArchCyOnlyMovingAvg3(row);
    return row.map((_, i) => {
      const i0 = Math.max(0, i - 2);
      const i4 = Math.min(row.length - 1, i + 2);
      let sy = 0;
      let n = 0;
      for (let k = i0; k <= i4; k++) {
        sy += row[k].cy;
        n++;
      }
      return { cx: row[i].cx, cy: sy / n, area: row[i].area ?? 1 };
    });
  };

  const subsampleArchRowToCount = (row, targetN) => {
    if (row.length <= targetN) return row;
    const n = row.length;
    const out = [];
    for (let k = 0; k < targetN; k++) {
      const idx = Math.round((k * (n - 1)) / Math.max(1, targetN - 1));
      out.push(row[idx]);
    }
    return out;
  };

  /** Fill missing lateral studs: merge density picks with column luminance picks (min X gap). */
  const mergeUpperStudRowsByMinSep = (primary, filler, maxN, minSepPx) => {
    const out = [...primary].map((p) => ({ cx: p.cx, cy: p.cy, area: p.area ?? 1 }));
    out.sort((a, b) => a.cx - b.cx);
    const byX = [...filler].sort((a, b) => a.cx - b.cx);
    for (const f of byX) {
      if (out.length >= maxN) break;
      if (out.some((u) => Math.abs(u.cx - f.cx) < minSepPx)) continue;
      out.push({ cx: f.cx, cy: f.cy, area: 1 });
    }
    out.sort((a, b) => a.cx - b.cx);
    return out.slice(0, maxN);
  };

  const sampleOpenCatmullRomChain = (pts, stepsPerSeg) => {
    if (pts.length < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
    const steps = Math.max(20, stepsPerSeg | 0);
    const chain = expandCatmullRomEnds(pts);
    const out = [];
    const segCount = chain.length - 3;
    for (let i = 0; i < segCount; i++) {
      const c0 = chain[i];
      const c1 = chain[i + 1];
      const c2 = chain[i + 2];
      const c3 = chain[i + 3];
      const t0 = i > 0 ? 1 : 0;
      for (let s = t0; s <= steps; s++) {
        out.push(catmullRomPoint2D(c0, c1, c2, c3, s / steps));
      }
    }
    return out;
  };

  /**
   * Commissure-bounded strip includes lateral molars; density peaks merged with column luminance picks for edge-to-edge studs.
   */
  const buildCentroidBracesPack = (landmarks, iw, ih, oval, enamelSnap) => {
    if (!enamelSnap?.data || !landmarks) return null;
    const { data, width: w, height: h } = enamelSnap;
    const poly = getBraceScanPolygonPoints(landmarks, iw, ih);
    if (!poly || poly.length < 3) return null;

    const polyMinX = Math.min(...poly.map((p) => p.x));
    const polyMaxX = Math.max(...poly.map((p) => p.x));
    const polyMinY = Math.min(...poly.map((p) => p.y));
    const polyMaxY = Math.max(...poly.map((p) => p.y));
    const archPadX = Math.max(14, (polyMaxX - polyMinX) * 0.2);
    const archPadY = Math.max(5, (polyMaxY - polyMinY) * 0.08);

    const lm61 = landmarks[COMMISSURE_LEFT_IDX];
    const lm291 = landmarks[COMMISSURE_RIGHT_IDX];
    const cl = lm61?.x != null ? lm61.x * iw : polyMinX;
    const cr = lm291?.x != null ? lm291.x * iw : polyMaxX;
    const comPad = Math.max(22, (polyMaxX - polyMinX) * 0.1);
    const comMin = Math.min(cl, cr) - comPad;
    const comMax = Math.max(cl, cr) + comPad;

    let minX = Math.floor(Math.min(polyMinX - archPadX, comMin));
    let minY = Math.floor(polyMinY - 2);
    let maxX = Math.ceil(Math.max(polyMaxX + archPadX, comMax));
    let maxY = Math.ceil(polyMaxY + 2);
    minX = clamp(minX, 0, w - 2);
    minY = clamp(minY, 0, h - 2);
    maxX = clamp(maxX, minX + 2, w - 1);
    maxY = clamp(maxY, minY + 2, h - 1);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < 10 || bh < 10) return null;

    const mask = new Uint8Array(bw * bh);
    const stripY0 = polyMinY - archPadY;
    const stripY1 = polyMaxY + archPadY;
    for (let ly = 0; ly < bh; ly++) {
      for (let lx = 0; lx < bw; lx++) {
        const gx = minX + lx;
        const gy = minY + ly;
        const inMouthStrip = gx >= comMin && gx <= comMax && gy >= stripY0 && gy <= stripY1;
        const hasEnamel = inMouthStrip
          ? pixelEnamelBracesLateral(data, w, h, gx, gy)
          : pixelEnamelInTeethMask(data, w, h, gx, gy);
        if (!hasEnamel) continue;
        const inPoly = pointInPolygonPx(gx + 0.5, gy + 0.5, poly);
        const inExpandedArch =
          gx >= polyMinX - archPadX &&
          gx <= polyMaxX + archPadX &&
          gy >= polyMinY - archPadY &&
          gy <= polyMaxY + archPadY;
        if (inPoly || inExpandedArch || inMouthStrip) mask[ly * bw + lx] = 1;
      }
    }

    let enamelMinLx = bw;
    let enamelMaxLx = -1;
    let enamelMinLy = bh;
    let enamelMaxLy = -1;
    for (let ly = 0; ly < bh; ly++) {
      for (let lx = 0; lx < bw; lx++) {
        if (mask[ly * bw + lx] !== 1) continue;
        if (lx < enamelMinLx) enamelMinLx = lx;
        if (lx > enamelMaxLx) enamelMaxLx = lx;
        if (ly < enamelMinLy) enamelMinLy = ly;
        if (ly > enamelMaxLy) enamelMaxLy = ly;
      }
    }
    if (enamelMaxLx < enamelMinLx || enamelMaxLy < enamelMinLy) return null;

    const ew = enamelMaxLx - enamelMinLx + 1;
    if (ew < 8) return null;

    const cols = GRID_ENAMEL_COLUMNS;
    const maxUpper = Math.min(UPPER_ARCH_MAX_LUMINANCE_PEAKS, MAX_CENTROID_STUDS_PER_ARCH);

    /** Arch split from vertical center of enamel mask only (not lip polygon bbox). */
    const ySplitLocal = clamp(Math.round((enamelMinLy + enamelMaxLy) * 0.5), 1, Math.max(1, bh - 2));
    const ySplitImg = minY + ySplitLocal;
    const yUpperEnd = ySplitLocal - 1;
    const yLowerStart = ySplitLocal;
    const yU0 = 0;
    const yU1 = Math.max(0, yUpperEnd);

    let upper = buildUpperArchFromDensityLocalMaxima(
      data,
      w,
      h,
      mask,
      bw,
      minX,
      minY,
      enamelMinLx,
      enamelMaxLx,
      yU0,
      yU1,
      maxUpper,
    );

    const upperCands = [];
    for (let c = 0; c < cols; c++) {
      const xStart = enamelMinLx + Math.floor((c * ew) / cols);
      const xEnd = Math.min(enamelMaxLx, enamelMinLx + Math.ceil(((c + 1) * ew) / cols) - 1);
      if (xEnd < xStart) continue;
      const u = pickColumnStudLuminancePeak(
        data,
        w,
        h,
        mask,
        bw,
        minX,
        minY,
        xStart,
        xEnd,
        yU0,
        yU1,
        LUMINANCE_PEAK_STRIP_WIDTH_PX,
      );
      if (u) upperCands.push(u);
    }
    upperCands.sort((a, b) => a.cx - b.cx);

    if (upper.length < 2) {
      upper = pickUpperArchColumnPeaks(upperCands, maxUpper);
    } else {
      const minDx = clamp(Math.floor(ew / 26), 7, 16);
      upper = mergeUpperStudRowsByMinSep(upper, upperCands, maxUpper, minDx);
    }

    if (upper.length === 0) return null;

    upper = smoothArchCentroidsMovingAvg5(upper);

    let lower = mirrorLowerStudsExactUpperX(
      data,
      w,
      h,
      mask,
      bw,
      minX,
      minY,
      yLowerStart,
      bh - 1,
      ySplitImg,
      upper,
    );
    const lowerN = Math.min(upper.length, LOWER_ARCH_SUBSAMPLE_MAX);
    if (lower.length > lowerN) {
      lower = subsampleArchRowToCount(lower, lowerN);
    }
    lower = smoothArchCyOnlyMovingAvg5(lower);

    const anchorsFromCentroidRow = (row) =>
      row.map((c, i, arr) => {
        const edge = clamp(Math.abs((c.cx - oval.cx) / Math.max(oval.rx, 1)), 0, 1);
        const perspective = 0.72 + 0.28 * (1 - edge);
        let ang;
        if (arr.length === 1) ang = 0;
        else if (i === 0) ang = Math.atan2(arr[1].cy - arr[0].cy, arr[1].cx - arr[0].cx);
        else if (i === arr.length - 1) ang = Math.atan2(arr[i].cy - arr[i - 1].cy, arr[i].cx - arr[i - 1].cx);
        else ang = Math.atan2(arr[i + 1].cy - arr[i - 1].cy, arr[i + 1].cx - arr[i - 1].cx);
        return {
          x: clamp(c.cx, 4, iw - 5),
          y: clamp(c.cy, 4, ih - 5),
          ang,
          wMult: Math.max(0.96, perspective),
          star: false,
          skipStud: false,
        };
      });

    const upperPtsRaw = upper.map((c) => ({ x: c.cx, y: c.cy }));
    const lowerPtsRaw = lower.map((c) => ({ x: c.cx, y: c.cy }));
    const upperPts = ensureSplineControlPoints(upperPtsRaw);
    const lowerPts = ensureSplineControlPoints(lowerPtsRaw);
    const wireSamplesUpper =
      upperPtsRaw.length > 0 ? sampleOpenCatmullRomChain(upperPts, CATMULL_WIRE_STEPS_PER_SEGMENT) : [];
    const wireSamplesLower =
      lowerPtsRaw.length > 0 ? sampleOpenCatmullRomChain(lowerPts, CATMULL_WIRE_STEPS_PER_SEGMENT) : [];

    return {
      wireMode: "catmull",
      upperAnchors: anchorsFromCentroidRow(upper),
      lowerAnchors: anchorsFromCentroidRow(lower),
      wireSamplesUpper,
      wireSamplesLower,
    };
  };

  /**
   * Luminance-peak Catmull wire (no Bézier path): null if no raster snap or no upper enamel columns.
   * @param {{ data: Uint8ClampedArray, width: number, height: number } | null} enamelSnap
   */
  const computeBracesAnchors = (landmarks, iw, ih, oval, enamelSnap = null) => {
    const baseW = BRACKET_DRAW_SIDE_PX;
    const baseH = BRACKET_DRAW_SIDE_PX;
    const centroidPack = buildCentroidBracesPack(landmarks, iw, ih, oval, enamelSnap);
    if (!centroidPack) return null;
    return { ...centroidPack, baseW, baseH };
  };

  /** Soft contact shadows drawn with destination-over so they sit under studs/wire (overlay pass). */
  const drawBracesContactShadows = (landmarks, ctx, iw, ih, oval, enamelSnap = null) => {
    const pack = computeBracesAnchors(landmarks, iw, ih, oval, enamelSnap);
    if (!pack) return;
    const { upperAnchors, lowerAnchors, baseW } = pack;
    const all = [...upperAnchors, ...lowerAnchors];
    ctx.save();
    ctx.filter = "blur(3.5px)";
    all.forEach(({ x, y, wMult, ang }) => {
      const side = baseW * wMult * 1.15;
      const rr = clamp(side * 0.12, 1, 5);
      ctx.save();
      ctx.translate(x, y + 0.5);
      ctx.rotate((ang ?? 0) + Math.PI / 2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, side * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0.32)");
      g.addColorStop(0.65, "rgba(0,0,0,0.08)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(-side * 0.5, -side * 0.5, side, side, rr);
      } else {
        ctx.rect(-side * 0.5, -side * 0.5, side, side);
      }
      ctx.fill();
      ctx.restore();
    });
    ctx.filter = "none";
    ctx.restore();
  };

  /**
   * Centroid-only Catmull wire + studs. `layers`: 'wire' | 'studs' | 'both'.
   * @param {{ omitStudShadow?: boolean, layers?: 'wire' | 'studs' | 'both' }} opts
   */
  const renderBraces = (landmarks, ctx, iw, ih, oval, opts = {}) => {
    const { omitStudShadow = false, layers = "both", enamelSnap = null } = opts;
    const wireDarkW = ARCHWIRE_LINE_WIDTH_PX;
    const pack = computeBracesAnchors(landmarks, iw, ih, oval, enamelSnap);
    if (!pack) return;
    const { upperAnchors, lowerAnchors, baseW, baseH, wireSamplesUpper, wireSamplesLower } = pack;

    ctx.save();

    /** Solid #e8eaee thread; depth from composite 3px shadow only. */
    const ARCHWIRE_SOLID_SILVER = "#e8eaee";

    const drawWire = () => {
      const up = wireSamplesUpper;
      const lo = wireSamplesLower;
      const hasUpper = up?.length >= 2;
      const hasLower = lo?.length >= 2;
      if (!hasUpper && !hasLower) return;

      const strokeStyle = ARCHWIRE_SOLID_SILVER;
      const lw = wireDarkW;
      if (typeof Path2D !== "undefined") {
        const path = new Path2D();
        if (hasUpper) {
          path.moveTo(up[0].x, up[0].y);
          for (let i = 1; i < up.length; i++) path.lineTo(up[i].x, up[i].y);
        }
        if (hasLower) {
          path.moveTo(lo[0].x, lo[0].y);
          for (let j = 1; j < lo.length; j++) path.lineTo(lo[j].x, lo[j].y);
        }
        requestAnimationFrame(() => {
          ctx.save();
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lw;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.setLineDash([]);
          ctx.stroke(path);
          ctx.restore();
        });
        return;
      }
      ctx.save();
      ctx.beginPath();
      if (hasUpper) {
        ctx.moveTo(up[0].x, up[0].y);
        for (let i = 1; i < up.length; i++) ctx.lineTo(up[i].x, up[i].y);
      }
      if (hasLower) {
        ctx.moveTo(lo[0].x, lo[0].y);
        for (let j = 1; j < lo.length; j++) ctx.lineTo(lo[j].x, lo[j].y);
      }
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      requestAnimationFrame(() => {
        ctx.stroke();
        ctx.restore();
      });
    };

    const drawAnchors = (anchors) => {
      anchors.forEach(({ x, y, ang, wMult, star }) => {
        drawReflectiveMetalStud(ctx, x, y, ang, baseW * wMult, baseH * wMult, star, omitStudShadow);
      });
    };

    if (layers === "studs" || layers === "both") {
      drawAnchors(upperAnchors);
      drawAnchors(lowerAnchors);
    }
    if (layers === "wire" || layers === "both") {
      drawWire();
    }
    ctx.restore();
  };

  const attachSimulationRenderer = (payload) => {
    if (!payload.bounds || !payload.oval) return payload;
    return {
      ...payload,
      /**
       * High-fidelity visual layers on a canvas that already contains the base image (full frame, same size as detection).
       * @param {'whitening'|'braces'|'transformation'|'whitening_braces'} type
       */
      renderSimulation(type, canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const iw = canvas.width;
        const ih = canvas.height;
        const { landmarks, bounds, oval } = payload;
        const runPop = () => applyMouthPopFilter(ctx, bounds);

        const doWhitening = () => {
          ctx.save();
          let clipped = false;
          if (landmarks) clipped = generateTeethMask(landmarks, ctx, iw, ih);
          if (!clipped && oval) {
            ctx.beginPath();
            ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
            ctx.clip();
          }
          if (clipped || oval) {
            applyLuminosityWhiteningPass(ctx, iw, ih, 0.4, landmarks);
            applyEnamelGlossAndGumOcclusion(ctx, iw, ih, landmarks, oval);
          }
          ctx.restore();
        };

        if (type === "whitening" || type === "transformation") {
          doWhitening();
          runPop();
        } else if (type === "braces") {
          doWhitening();
          runPop();
          if (landmarks) renderBraces(landmarks, ctx, iw, ih, oval);
        } else if (type === "whitening_braces") {
          doWhitening();
          runPop();
          if (landmarks) renderBraces(landmarks, ctx, iw, ih, oval);
        }
      },
    };
  };

  /** Triple rAF: enamel + pop committed before charcoal hardware (top-most layer guarantee). */
  const flushPaintBeforeVectorHardware = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    });

  const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * AI enamel → mouth pop → triple rAF → hardware overlay → 3px rgba(0,0,0,0.8) layer shadow (topmost).
   * fallbackGeometry: pre–AI-pass landmarks/oval/bounds if post-AI detectMouth fails.
   */
  const applyBracesOverlay = async (imageSrc, landmarks, iw, ih, oval, mouthBounds, fallbackGeometry = null) => {
    const lm =
      landmarks?.[NOSE_MIDLINE_IDX] && landmarks?.[CHIN_MIDLINE_IDX]
        ? landmarks
        : fallbackGeometry?.landmarks ?? landmarks;
    const ov = oval ?? fallbackGeometry?.oval;
    const mb = mouthBounds ?? fallbackGeometry?.bounds;
    if (!lm || !ov) {
      throw new Error("Braces overlay requires nose–chin midline geometry");
    }

    const img = await loadImage(imageSrc);
    if (typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        /* optional */
      }
    }
    await flushPaintBeforeVectorHardware();

    const base = document.createElement("canvas");
    base.width = iw;
    base.height = ih;
    const bctx = base.getContext("2d");
    if (!bctx) throw new Error("Could not get canvas context for braces overlay");

    bctx.drawImage(img, 0, 0, iw, ih);
    applyMouthPopFilter(bctx, mb);
    await flushPaintBeforeVectorHardware();

    let enamelSnap = null;
    try {
      const snapImg = bctx.getImageData(0, 0, iw, ih);
      enamelSnap = { data: snapImg.data, width: iw, height: ih };
    } catch {
      /* tainted / security: skip raster snap */
    }

    const overlay = document.createElement("canvas");
    overlay.width = iw;
    overlay.height = ih;
    const octx = overlay.getContext("2d");
    if (!octx) throw new Error("Could not get overlay context for braces");

    await flushPaintBeforeVectorHardware();
    await delayMs(BRACES_HARDWARE_SETTLE_MS);
    const braceOpts = {
      omitStudShadow: true,
      enamelSnap,
    };
    renderBraces(lm, octx, iw, ih, ov, { ...braceOpts, layers: "wire" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flushPaintBeforeVectorHardware();
    octx.save();
    octx.globalCompositeOperation = "destination-over";
    drawBracesContactShadows(lm, octx, iw, ih, ov, enamelSnap);
    octx.restore();
    renderBraces(lm, octx, iw, ih, ov, { ...braceOpts, layers: "studs" });

    bctx.save();
    bctx.globalCompositeOperation = "source-over";
    bctx.shadowColor = HARDWARE_SHADOW_COLOR;
    bctx.shadowBlur = HARDWARE_LAYER_SHADOW_BLUR_PX;
    bctx.shadowOffsetX = 0;
    bctx.shadowOffsetY = 2;
    bctx.drawImage(overlay, 0, 0);
    bctx.shadowBlur = 0;
    bctx.shadowOffsetY = 0;
    bctx.restore();

    return base.toDataURL("image/jpeg", 0.95);
  };

  /**
   * Whitening: anatomical clip + adaptive luminosity + soft-light @ 40% + feather (MASK_CLIP_FEATHER_PX).
   * Fallback: mouth oval clip when landmarks missing. Finishes with mouth pop filter for mobile clarity.
   */
  const applyTeethWhitening = async (imageSrc, oval, landmarks, bounds) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0);

        ctx.save();
        let clipped = false;
        if (landmarks) clipped = generateTeethMask(landmarks, ctx, w, h);
        if (!clipped) {
          ctx.beginPath();
          ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
          ctx.clip();
        }
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

  const applyAlignmentWarp = async (imageSrc, bounds) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const { x, y, width, height } = bounds;

        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");

        tempCanvas.width = width;
        tempCanvas.height = height;

        tempCtx.drawImage(img, x, y, width, height, 0, 0, width, height);

        ctx.drawImage(tempCanvas, 0, 0, width, height, x + width * 0.02, y, width * 0.96, height);

        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
    });
  };

  const cropMouthRegion = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return canvas.toDataURL("image/jpeg", 0.95);
  };

  /**
   * Segmentation-inspired teeth mask in crop space (white=inpaint for Replicate only — never braces).
   * Tighter oval + anatomical y-cap + 5px blur reduces gum/lip gray and lateral “concrete” patches.
   */
  const createTeethMaskForCrop = async (mouthImageSrc, cw, ch, ovalInCrop, maskOpts = null) => {
    let yMaxCrop = ch;
    let teethBBox = null;
    if (maskOpts?.landmarks && maskOpts?.imageWidth && maskOpts?.imageHeight && maskOpts?.bounds) {
      const t = getTightenedWhiteningMaskPoints(maskOpts.landmarks, maskOpts.imageWidth, maskOpts.imageHeight);
      if (t?.length) {
        const maxY = Math.max(...t.map((p) => p.y));
        yMaxCrop = clamp(Math.ceil(maxY - maskOpts.bounds.y + 1), 1, ch);
      }

      // Alignment "edge-lock": restrict inpaint region to the original teeth bounding box.
      if (maskOpts?.mode === "alignment" || maskOpts?.mode === "transformation") {
        const pts = TEETH_WHITEN_MASK_INDICES.map((idx) => {
          const p = maskOpts.landmarks[idx];
          if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
          return { x: p.x * maskOpts.imageWidth - maskOpts.bounds.x, y: p.y * maskOpts.imageHeight - maskOpts.bounds.y };
        }).filter(Boolean);
        if (pts.length >= 3) {
          const minX = clamp(Math.floor(Math.min(...pts.map((p) => p.x))), 0, cw - 1);
          const maxX = clamp(Math.ceil(Math.max(...pts.map((p) => p.x))), 0, cw - 1);
          const minY = clamp(Math.floor(Math.min(...pts.map((p) => p.y))), 0, ch - 1);
          const maxY = clamp(Math.ceil(Math.max(...pts.map((p) => p.y))), 0, ch - 1);
          teethBBox = { minX, maxX, minY, maxY };
        }
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);

    const img = await loadImage(mouthImageSrc);
    const src = document.createElement("canvas");
    src.width = cw;
    src.height = ch;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, cw, ch);
    const frame = sctx.getImageData(0, 0, cw, ch);
    const d = frame.data;

    const { cx, cy, rx, ry } = ovalInCrop;
    const out = ctx.getImageData(0, 0, cw, ch);
    const od = out.data;
    for (let y = 0; y < ch; y++) {
      if (y > yMaxCrop) continue;
      for (let x = 0; x < cw; x++) {
        if (teethBBox && (x < teethBBox.minX || x > teethBBox.maxX || y < teethBBox.minY || y > teethBBox.maxY)) continue;
        const nx = (x - cx) / Math.max(rx, 1);
        const ny = (y - cy) / Math.max(ry, 1);
        const inOval = nx * nx + ny * ny <= 1.06;
        if (!inOval) continue;
        const i = (y * cw + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const maxc = Math.max(r, g, b);
        const minc = Math.min(r, g, b);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
        const enamel = lum >= ENAMEL_LUM_MIN && lum <= ENAMEL_LUM_MAX && sat <= ENAMEL_SAT_MAX;
        if (!enamel) continue;
        od[i] = 255;
        od[i + 1] = 255;
        od[i + 2] = 255;
        od[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    ctx.filter = `blur(${MASK_CLIP_FEATHER_PX}px)`;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    return canvas.toDataURL("image/png");
  };

  /** Nose (4) + chin (152) → vertical facial midline in normalized [0,1] x (MediaPipe / FaceMesh). */
  const getFacialMidlineXNorm = (landmarks) => {
    const n = landmarks?.[NOSE_MIDLINE_IDX];
    const c = landmarks?.[CHIN_MIDLINE_IDX];
    if (!n || !c || typeof n.x !== "number" || typeof c.x !== "number") return null;
    return (n.x + c.x) / 2;
  };

  const enhanceWithAI = async (mouthImage, mask, treatment, midlineXNorm = null) => {
    if (!AI_SMILE_API) throw new Error("Backend API is not configured.");

    const payload = { image: mouthImage, mask, treatment };
    if (midlineXNorm != null && Number.isFinite(midlineXNorm)) payload.midlineX = midlineXNorm;

    const response = await fetch(AI_SMILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI polish failed");

    return data.outputDataUrl || data.output || null;
  };

  const mergeFinalImage = async (originalSrc, mouthEnhancedSrc, bounds, oval) => {
    const [original, mouth] = await Promise.all([loadImage(originalSrc), loadImage(mouthEnhancedSrc)]);
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(original, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = imageData.data;

    const tmp = document.createElement("canvas");
    tmp.width = bounds.width;
    tmp.height = bounds.height;
    tmp.getContext("2d").drawImage(mouth, 0, 0, mouth.width, mouth.height, 0, 0, bounds.width, bounds.height);
    const mouthPixels = tmp.getContext("2d").getImageData(0, 0, bounds.width, bounds.height).data;

    for (let py = bounds.y; py < bounds.y + bounds.height; py++) {
      for (let px = bounds.x; px < bounds.x + bounds.width; px++) {
        const w = ellipseFeatherWeight(px, py, oval, OVAL_FEATHER_PX);
        if (w <= 0) continue;

        const oi = (py * canvas.width + px) * 4;
        const mi = ((py - bounds.y) * bounds.width + (px - bounds.x)) * 4;

        out[oi] = Math.round(out[oi] * (1 - w) + mouthPixels[mi] * w);
        out[oi + 1] = Math.round(out[oi + 1] * (1 - w) + mouthPixels[mi + 1] * w);
        out[oi + 2] = Math.round(out[oi + 2] * (1 - w) + mouthPixels[mi + 2] * w);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const processWithAI = async (baseImage) => {
    setStep("processing");
    setError(null);
    setActiveTreatment(selectedTreatment);

    try {
      const normalized = await normalizeImage(baseImage, 1024);
      const mouth = await detectMouth(normalized);

      if (!mouth.bounds || !mouth.oval) {
        setBeforeImage(null);
        setAfterImage(null);
        setError(
          "Keep your mouth slightly open so we can see your teeth clearly. Ensure there are no strong shadows on your lips, and try again."
        );
        setStep("upload");
        return;
      }

      const { bounds, oval, landmarks } = mouth;
      /** Stable geometry before Replicate/local enamel (fallback if post-merge detectMouth fails). */
      const preAiBracesGeometry = { landmarks, oval, bounds };

      const fullFrame = await loadImage(normalized);

      let canvasEnhanced = normalized;

      if (selectedTreatment === "whitening" || selectedTreatment === "transformation" || selectedTreatment === "braces") {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, oval, landmarks, bounds);
      }
      if (selectedTreatment === "alignment" || selectedTreatment === "transformation" || selectedTreatment === "braces") {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds);
      }

      const mouthCrop = await cropMouthRegion(canvasEnhanced, bounds);

      /**
       * Replicate/SDXL inpainting on small mouth crops often produces cyan/blue glow or wrong colors.
       * Whitening/alignment use the canvas-enhanced mouthCrop only (natural, stable). Re-enable polish later with a teeth-specific model if needed.
       */
      const useReplicatePolish = true;

      let aiPolishedCrop = null;
      if (useReplicatePolish && AI_SMILE_API) {
        /** Braces: AI pass = transformation (subtle straightening); brackets/wire are drawn locally after merge. */
        const replicateTreatment = selectedTreatment === "braces" ? "transformation" : selectedTreatment;
        const midlineXNorm = getFacialMidlineXNorm(landmarks);
        const midlineFullX =
          midlineXNorm != null ? midlineXNorm * fullFrame.width : null;
        let ovalInCrop = {
          cx: oval.cx - bounds.x,
          cy: oval.cy - bounds.y,
          rx: oval.rx,
          ry: oval.ry,
        };
        if ((selectedTreatment === "alignment" || selectedTreatment === "braces") && midlineFullX != null) {
          const midCropX = midlineFullX - bounds.x;
          ovalInCrop = {
            ...ovalInCrop,
            cx: ovalInCrop.cx * 0.55 + midCropX * 0.45,
          };
        }
        const mask = await createTeethMaskForCrop(mouthCrop, bounds.width, bounds.height, ovalInCrop, {
          landmarks,
          imageWidth: fullFrame.width,
          imageHeight: fullFrame.height,
          bounds,
          mode: replicateTreatment,
        });
        try {
          const { mouth: apiMouth, mask: apiMask } = await scaleMouthAndMaskForApi(mouthCrop, mask, API_MOUTH_MAX_EDGE);
          aiPolishedCrop = await enhanceWithAI(apiMouth, apiMask, replicateTreatment, midlineXNorm);
        } catch {
          aiPolishedCrop = null;
        }
      }

      let merged = await mergeFinalImage(normalized, aiPolishedCrop || mouthCrop, bounds, oval);

      const imgRef = fullFrame;
      /** Structure layer: braces/wire only after merged texture (Replicate + local enamel) — never in the AI pass. */
      if (selectedTreatment === "braces") {
        await flushPaintBeforeVectorHardware();
        let bracesLandmarks = preAiBracesGeometry.landmarks;
        let bracesOval = preAiBracesGeometry.oval;
        let bracesBounds = preAiBracesGeometry.bounds;
        try {
          const redetect = await detectMouth(merged);
          if (
            redetect?.landmarks?.[NOSE_MIDLINE_IDX] != null &&
            redetect?.landmarks?.[CHIN_MIDLINE_IDX] != null &&
            redetect?.oval &&
            redetect?.bounds
          ) {
            bracesLandmarks = redetect.landmarks;
            bracesOval = redetect.oval;
            bracesBounds = redetect.bounds;
          }
        } catch {
          /* keep pre-AI nose–chin / oval */
        }
        merged = await applyBracesOverlay(
          merged,
          bracesLandmarks,
          imgRef.width,
          imgRef.height,
          bracesOval,
          bracesBounds,
          preAiBracesGeometry
        );
      }

      const previewRect = squareCropRect(imgRef.width, imgRef.height, oval);
      const beforeSquare = await cropImageToDataUrl(normalized, previewRect);
      const afterSquare = await cropImageToDataUrl(merged, previewRect);

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

  return (
    <section id="simulation" className="py-24 bg-[#F9F9F7] scroll-mt-28">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 mb-6">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Hybrid render: AI refines enamel texture only; braces and archwire are drawn in sharp canvas layers after the whitened image is merged.
          </p>
        </AnimatedSection>

        <AnimatedSection className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TREATMENTS.map((t) => {
              const Icon = t.icon;
              const active = selectedTreatment === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTreatment(t.id)}
                  disabled={step === "processing" || step === "result"}
                  className={cn(
                    "rounded-2xl border p-5 text-left transition-all duration-300 bg-white",
                    active ? "border-brand-gold shadow-md ring-1 ring-brand-gold/20 scale-[1.02]" : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm",
                    (step === "processing" || step === "result") && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <span className={cn("p-3 rounded-xl", active ? "bg-brand-blue" : "bg-zinc-100")}>
                      <Icon size={20} className={active ? "text-zinc-800" : "text-zinc-500"} />
                    </span>
                    <span className="text-base font-semibold text-zinc-800">{t.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-12 rounded-3xl border border-zinc-100 shadow-xl text-center">
                <div className="mb-10 flex justify-center">
                  <div className="w-20 h-20 bg-brand-blue/30 rounded-full flex items-center justify-center text-zinc-600"><Upload size={32} /></div>
                </div>
                <h3 className="text-2xl font-serif mb-4">Upload or Capture Smile</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">
                  Face the camera with your mouth visible. On phones we also support automatic framing if live face detection is slow.
                </p>

                {error && <div className="mb-8 p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>}
                {cameraError && !error && <div className="mb-8 p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">{cameraError}</div>}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <PremiumButton onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2"><Upload size={18} />Choose File</PremiumButton>
                  <PremiumButton variant="secondary" onClick={startCamera} className="flex items-center justify-center gap-2"><Camera size={18} />Take Photo</PremiumButton>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />

                <div className="mt-12 flex items-start gap-3 text-left p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <Info size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    This is an AI-generated preview and may not reflect exact medical results.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative aspect-video overflow-hidden rounded-3xl bg-black shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[7.2rem] w-[18rem] max-w-[92%] rounded-[999px] border-2 border-brand-gold/80 bg-white/10" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 p-6">
                  <button type="button" onClick={reset} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"><X size={22} /></button>
                  <button type="button" onClick={takePhoto} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white"><span className="h-12 w-12 rounded-full bg-zinc-900" /></button>
                  <button type="button" onClick={() => { stopCamera(); startCamera(); }} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"><RefreshCw size={20} /></button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white p-20 rounded-3xl border border-zinc-100 shadow-xl text-center">
                <p className="text-lg font-medium animate-pulse">Designing your future smile...</p>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                {/* Clinic-style settle: subtle zoom from slightly wide to framed mouth (0.8s ease) */}
                <motion.div
                  className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/20 bg-black w-full max-w-lg mx-auto aspect-square max-h-[min(92vw,560px)] origin-center"
                  initial={{ scale: 1.08, y: 6 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ReactCompareImage
                    key={afterImage || "compare"}
                    leftImage={beforeImage}
                    rightImage={afterImage}
                    aspectRatio="taller"
                    sliderPositionPercentage={0.5}
                    sliderLineWidth={2}
                    sliderLineColor="#D4AF37"
                    handleSize={44}
                    leftImageCss={{
                      objectFit: "cover",
                      objectPosition: "center center",
                    }}
                    rightImageCss={{
                      objectFit: "cover",
                      objectPosition: "center center",
                    }}
                  />
                </motion.div>
                <p className="text-center text-xs text-zinc-500 md:hidden">Drag the gold line to compare — preview is zoomed on your smile.</p>

                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center"
                      animate={{ scale: [1, 1.06, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
                    >
                      <CheckCircle2 size={24} />
                    </motion.div>
                    <div>
                      <h4 className="font-serif text-xl">Simulation Complete</h4>
                      <p className="text-zinc-400 text-sm capitalize">{activeTreatment} simulation with hybrid enhancement</p>
                    </div>
                  </div>
                  <div className="flex gap-4 flex-wrap justify-center">
                    <PremiumButton variant="outline" onClick={reset}>Try Another</PremiumButton>
                    <motion.div
                      animate={{
                        boxShadow: [
                          "0 0 0 0 rgba(212, 175, 55, 0)",
                          "0 0 22px 6px rgba(212, 175, 55, 0.35)",
                          "0 0 0 0 rgba(212, 175, 55, 0)",
                        ],
                      }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
                      className="rounded-xl"
                    >
                      <PremiumButton className="text-black" style={{ background: "linear-gradient(135deg, #D4AF37, #F5E6C5)" }}>Book Consultation</PremiumButton>
                    </motion.div>
                  </div>
                </div>

                <p className="text-center text-xs text-zinc-400 italic">
                  &ldquo;This is an AI-generated preview and may not reflect exact medical results.&rdquo;
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





