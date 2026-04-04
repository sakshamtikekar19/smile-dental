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
  { id: "braces", label: "Braces", icon: Link2, desc: "Structural wire preview" },
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
/** Nose–chin axis (facial midline X); bracket columns spread ±n×this from center. */
const NOSE_MIDLINE_IDX = 4;
const CHIN_MIDLINE_IDX = 152;
const MIDLINE_BRACKET_SPACING_PX = 28;
/** Fixed odd count: one column on nose–chin midline; independent of mouth-width heuristics (geometric guarantee). */
const GEOMETRIC_BRACKET_COUNT = 11;
/** Mean Y of these FaceMesh points → upper lip band (occlusal anchor, not generic mid-face). */
const BRACES_UPPER_LIP_Y_INDICES = [61, 185, 40, 39, 37, 267, 269, 270, 409, 78, 191, 80, 81, 82, 312, 311, 310];
/** Mean Y of these → lower lip band; with upper mean, defines enamel vertical span for bracket rows. */
const BRACES_LOWER_LIP_Y_INDICES = [146, 91, 181, 84, 17, 314, 405, 321, 375, 14, 87, 178, 88, 95, 308, 324, 318];
/** Subtle labial parabola only — keeps wire on enamel, not bowed into lips. */
const LABIAL_BOW_STRENGTH = 0.42;
/** Archwire + bracket hardware: strong float shadow (medical overlay readability). */
const ARCHWIRE_LINE_WIDTH_PX = 3;
const ARCHWIRE_SHADOW_BLUR_PX = 5;
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

  /** Ray-cast point-in-polygon for inner-lip / teeth mask (occlusion rule for brackets). */
  const pointInPolygon = (x, y, poly) => {
    if (poly.length < 3) return true;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const cross = (yi > y) !== (yj > y);
      if (cross && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
    }
    return inside;
  };

  const buildTeethPolygonPx = (landmarks, iw, ih) =>
    TEETH_WHITEN_MASK_INDICES.map((idx) => {
      const p = landmarks[idx];
      if (!p || typeof p.x !== "number") return null;
      return { x: p.x * iw, y: p.y * ih };
    }).filter(Boolean);

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
   * 1:1 rounded-rect bracket: radial charcoal → #0a0a0a, pure #ffffff top-left glint, charcoal horizontal wire slot, 5px float shadow.
   */
  const drawReflectiveMetalStud = (ctx, x, y, tangentRad, w, h, starFlare = false, omitDropShadow = false) => {
    const side = Math.min(w, h);
    const r = Math.min(side * 0.24, side * 0.4);
    const hw = side * 0.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tangentRad + Math.PI / 2);
    if (!omitDropShadow) {
      ctx.shadowColor = HARDWARE_SHADOW_COLOR;
      ctx.shadowBlur = ARCHWIRE_SHADOW_BLUR_PX;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1.5;
    }
    const body = ctx.createRadialGradient(-hw * 0.42, -hw * 0.42, side * 0.04, 0, 0, hw * 1.12);
    body.addColorStop(0, "#6a6e76");
    body.addColorStop(0.35, "#3a3d44");
    body.addColorStop(0.7, "#1a1c20");
    body.addColorStop(1, "#0a0a0a");
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-hw, -hw, side, side, r);
    } else {
      ctx.rect(-hw, -hw, side, side);
    }
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = Math.max(0.25, side * 0.055);
    ctx.stroke();
    const glint = ctx.createRadialGradient(-hw * 0.55, -hw * 0.55, 0, -hw * 0.36, -hw * 0.36, side * 0.34);
    glint.addColorStop(0, "#ffffff");
    glint.addColorStop(0.22, "#ffffff");
    glint.addColorStop(0.5, "rgba(255,255,255,0.45)");
    glint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.ellipse(-hw * 0.34, -hw * 0.34, side * 0.11, side * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a2c30";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
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

  /** Nose–chin axis → midline X in pixels (stable vs per-tooth blur). */
  const getFacialMidlineXPx = (landmarks, iw) => {
    const n = landmarks?.[NOSE_MIDLINE_IDX];
    const c = landmarks?.[CHIN_MIDLINE_IDX];
    if (!n || !c || typeof n.x !== "number" || typeof c.x !== "number") return null;
    return ((n.x + c.x) / 2) * iw;
  };

  /** Mean landmark Y in pixels; drives enamel vertical anchoring vs lip tissue. */
  const meanLandmarkYpx = (landmarks, indices, ih) => {
    const ys = indices.map((i) => landmarks[i]?.y).filter((y) => typeof y === "number");
    if (ys.length < 2) return null;
    return (ys.reduce((a, b) => a + b, 0) / ys.length) * ih;
  };

  /**
   * Iron-arch: nose–chin midline X; bracket Y from upper/lower lip mean Y (enamel band), not lip-biased bulge.
   * Upper row sits occlusal-ward in the upper half of the lip opening; lower row in the lower half — subtle parabola only.
   */
  const getMidlineBracketRows = (landmarks, iw, ih, oval) => {
    const midX = getFacialMidlineXPx(landmarks, iw) ?? oval.cx;
    const nTarget = GEOMETRIC_BRACKET_COUNT;

    const upperMeanY = meanLandmarkYpx(landmarks, BRACES_UPPER_LIP_Y_INDICES, ih);
    const lowerMeanY = meanLandmarkYpx(landmarks, BRACES_LOWER_LIP_Y_INDICES, ih);
    const p13 = landmarks[13];
    const p14 = landmarks[14];

    let lipTop;
    let lipBot;
    if (upperMeanY != null && lowerMeanY != null) {
      lipTop = Math.min(upperMeanY, lowerMeanY);
      lipBot = Math.max(upperMeanY, lowerMeanY);
    } else if (p13 && p14) {
      lipTop = Math.min(p13.y, p14.y) * ih;
      lipBot = Math.max(p13.y, p14.y) * ih;
    } else {
      lipTop = oval.cy - oval.ry * 0.55;
      lipBot = oval.cy + oval.ry * 0.55;
    }
    const lipSpan = Math.max(lipBot - lipTop, 20);
    const enamelMidY = (lipTop + lipBot) / 2;

    const upperBaseY = clamp(lipTop + (enamelMidY - lipTop) * 0.58, 4, ih - 4);
    const lowerBaseY = clamp(enamelMidY + (lipBot - enamelMidY) * 0.42, 4, ih - 4);

    const bowScale = lipSpan * 0.09;
    const upperBulge = Math.max(4, bowScale) * LABIAL_BOW_STRENGTH;
    const lowerBulge = Math.max(5, bowScale * 1.05) * LABIAL_BOW_STRENGTH;

    const makeRow = (baseY, isUpper) => {
      const row = [];
      const half = (nTarget - 1) / 2;
      const margin = 6;
      for (let i = 0; i < nTarget; i++) {
        const offset = (i - half) * MIDLINE_BRACKET_SPACING_PX;
        let cx = midX + offset;
        cx = clamp(cx, margin, iw - margin);
        const t = half > 1e-6 ? (i - half) / half : 0;
        const curve = 1 - t * t;
        const cy = isUpper ? baseY - upperBulge * curve : baseY + lowerBulge * curve;
        row.push({
          peak: { x: cx, y: cy },
          bottom: { x: cx, y: cy },
          bbox: {
            minX: cx - MIDLINE_BRACKET_SPACING_PX * 0.48,
            maxX: cx + MIDLINE_BRACKET_SPACING_PX * 0.48,
            minY: cy - 12,
            maxY: cy + 12,
          },
          center: { x: cx, y: cy },
          toothHeight: 12,
          toothWidth: MIDLINE_BRACKET_SPACING_PX,
        });
      }
      return row;
    };

    return {
      upperTeeth: makeRow(upperBaseY, true),
      lowerTeeth: makeRow(lowerBaseY, false),
      upperCount: nTarget,
      lowerCount: nTarget,
    };
  };

  /**
   * Parabolic anchors only — never drop a stud for “in frame” / tooth mask; clamp to canvas so hardware always draws.
   */
  const computeBracesAnchors = (landmarks, iw, ih, oval) => {
    const scale = Math.max(iw, ih);
    /** ~1:1 medical bracket footprint (reads as a block, not a dot). */
    const baseS = clamp(scale * 0.0062, 2.1, 4.6);
    const baseW = baseS;
    const baseH = baseS;
    const biometric = getMidlineBracketRows(landmarks, iw, ih, oval);
    if (!biometric.upperCount && !biometric.lowerCount) return null;

    const buildAnchors = (teeth) => {
      if (!teeth.length) return [];
      const heights = teeth.map((t) => t.toothHeight).sort((a, b) => a - b);
      const widths = teeth.map((t) => t.toothWidth).sort((a, b) => a - b);
      const medianH = heights[Math.floor(heights.length / 2)] || 8;
      const medianW = widths[Math.floor(widths.length / 2)] || 8;
      return teeth
        .map((tooth) => {
          const cx = clamp(tooth.center.x, 4, iw - 5);
          const cy = clamp(tooth.center.y, 4, ih - 5);
          const edge = clamp(Math.abs((cx - oval.cx) / Math.max(oval.rx, 1)), 0, 1);
          const perspective = 0.6 + 0.4 * (1 - edge);
          const sizeByTooth = clamp(((tooth.toothWidth / medianW) * 0.65 + (tooth.toothHeight / medianH) * 0.35) * 0.95, 0.7, 1.25);
          return {
            x: cx,
            y: cy,
            wMult: perspective * sizeByTooth,
            star: false,
          };
        })
        .sort((a, b) => a.x - b.x);
    };

    const addTangents = (anchors) => {
      if (!anchors.length) return anchors;
      const withAng = anchors.map((a, i) => {
        const prev = anchors[Math.max(0, i - 1)];
        const next = anchors[Math.min(anchors.length - 1, i + 1)];
        const ang = Math.atan2(next.y - prev.y, next.x - prev.x);
        return { ...a, ang };
      });
      return withAng;
    };

    const upperAnchors = addTangents(buildAnchors(biometric.upperTeeth));
    const lowerAnchors = addTangents(buildAnchors(biometric.lowerTeeth));
    return { upperAnchors, lowerAnchors, baseW, baseH };
  };

  /** Soft contact shadows drawn with destination-over so they sit under studs/wire (overlay pass). */
  const drawBracesContactShadows = (landmarks, ctx, iw, ih, oval) => {
    const pack = computeBracesAnchors(landmarks, iw, ih, oval);
    if (!pack) return;
    const { upperAnchors, lowerAnchors, baseW, baseH } = pack;
    const all = [...upperAnchors, ...lowerAnchors];
    ctx.save();
    ctx.filter = "blur(3.5px)";
    all.forEach(({ x, y, wMult }) => {
      const rw = baseW * wMult * 1.45;
      const rh = baseH * wMult * 1.2;
      const g = ctx.createRadialGradient(x, y + 1.5, 0, x, y + 1.5, Math.max(rw, rh) * 1.15);
      g.addColorStop(0, "rgba(0,0,0,0.34)");
      g.addColorStop(0.55, "rgba(0,0,0,0.1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y + 0.5, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.filter = "none";
    ctx.restore();
  };

  /**
   * Parabolic-arch wire + studs. `layers`: 'wire' | 'studs' | 'both' (overlay can paint wire → flush → studs).
   * @param {{ omitStudShadow?: boolean, omitWireShadow?: boolean, layers?: 'wire' | 'studs' | 'both' }} opts
   */
  const renderBraces = (landmarks, ctx, iw, ih, oval, opts = {}) => {
    const { omitStudShadow = false, omitWireShadow = false, layers = "both" } = opts;
    const wireDarkW = ARCHWIRE_LINE_WIDTH_PX;
    const pack = computeBracesAnchors(landmarks, iw, ih, oval);
    if (!pack) return;
    const { upperAnchors, lowerAnchors, baseW, baseH } = pack;

    ctx.save();
    /** No teeth-polygon clip: AI whitening changes enamel pixels; landmark-based clip was hiding studs (wire still drew). */

    /**
     * Catmull–Rom → cubic Béziers. Second arch must NOT call beginPath() or the first subpath is erased.
     */
    const appendCatmullRomArchWire = (anchors, startNewPath) => {
      if (anchors.length < 2) return;
      const pts = anchors.map((a) => ({ x: a.x, y: a.y }));
      const n = pts.length;
      const get = (i) => {
        if (i < 0) return pts[0];
        if (i >= n) return pts[n - 1];
        return pts[i];
      };
      if (startNewPath) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
      }
      for (let i = 0; i < n - 1; i++) {
        const p0 = get(i - 1);
        const p1 = get(i);
        const p2 = get(i + 1);
        const p3 = get(i + 2);
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    };

    const charcoalWire = ctx.createLinearGradient(0, oval.cy - oval.ry, 0, oval.cy + oval.ry);
    charcoalWire.addColorStop(0, "#4a4a4a");
    charcoalWire.addColorStop(0.5, "#2c2c2c");
    charcoalWire.addColorStop(1, "#0a0a0a");

    const drawWire = () => {
      ctx.save();
      if (!omitWireShadow) {
        ctx.shadowColor = HARDWARE_SHADOW_COLOR;
        ctx.shadowBlur = ARCHWIRE_SHADOW_BLUR_PX;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1.5;
      }
      appendCatmullRomArchWire(upperAnchors, true);
      appendCatmullRomArchWire(lowerAnchors, false);
      ctx.strokeStyle = charcoalWire;
      ctx.lineWidth = wireDarkW;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    };

    const drawAnchors = (anchors) => {
      anchors.forEach(({ x, y, ang, wMult, star }) => {
        drawReflectiveMetalStud(ctx, x, y, ang, baseW * wMult, baseH * wMult, star, omitStudShadow);
      });
    };

    if (layers === "wire" || layers === "both") {
      drawWire();
    }
    if (layers === "studs" || layers === "both") {
      drawAnchors(upperAnchors);
      drawAnchors(lowerAnchors);
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

  /**
   * AI enamel → mouth pop on base only → triple-flush commits pixels → wire/stroke on a separate overlay (never filtered by pop).
   * Composite last so archwires stay sharp; rgba(0,0,0,0.8) @ 5px shadow on overlay paths only.
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

    const overlay = document.createElement("canvas");
    overlay.width = iw;
    overlay.height = ih;
    const octx = overlay.getContext("2d");
    if (!octx) throw new Error("Could not get overlay context for braces");

    await flushPaintBeforeVectorHardware();
    renderBraces(lm, octx, iw, ih, ov, { omitStudShadow: true, omitWireShadow: false, layers: "wire" });
    await flushPaintBeforeVectorHardware();
    octx.save();
    octx.globalCompositeOperation = "destination-over";
    drawBracesContactShadows(lm, octx, iw, ih, ov);
    octx.restore();
    renderBraces(lm, octx, iw, ih, ov, { omitStudShadow: false, omitWireShadow: true, layers: "studs" });

    bctx.save();
    bctx.globalCompositeOperation = "source-over";
    bctx.drawImage(overlay, 0, 0);
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
      if (selectedTreatment === "alignment" || selectedTreatment === "transformation") {
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
        /** Braces use the same enamel-only whitening pass on the API (metal is drawn locally). */
        const replicateTreatment = selectedTreatment === "braces" ? "whitening" : selectedTreatment;
        const midlineXNorm = getFacialMidlineXNorm(landmarks);
        const midlineFullX =
          midlineXNorm != null ? midlineXNorm * fullFrame.width : null;
        let ovalInCrop = {
          cx: oval.cx - bounds.x,
          cy: oval.cy - bounds.y,
          rx: oval.rx,
          ry: oval.ry,
        };
        if (selectedTreatment === "alignment" && midlineFullX != null) {
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





