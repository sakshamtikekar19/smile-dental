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

/**
 * Dental arches: use **inner mouth** lip lines from FACEMESH_LIPS, NOT the outer contour.
 * The outer lower path (61→…→17→…→291) follows the lower lip skin and chin — braces looked like they sat on the lip.
 * Inner upper: 78→…→308 (MediaPipe segment [78,191]…[415,308]).
 * Inner lower: 78→…→308 ([78,95]…[324,308]).
 */
const UPPER_ARCH_INDICES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const LOWER_ARCH_INDICES = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

/** Mouth-only fallback (user-specified). If ≥4 land inside the guide oval, we still run the sim. */
const MOUTH_FIRST_INDICES = [0, 13, 14, 17, 37, 267];
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
    });
    return faceLandmarkerInstance;
  } catch (_err) {
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
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3,
    });

    faceMeshInstance = faceMesh;
    return faceMeshInstance;
  } catch (_err) {
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
    } catch (_err) {
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

  const tryAnalyzeLandmarksFullOrMouthFirst = (landmarks, iw, ih) =>
    analyzeMouthFromLandmarks(landmarks, iw, ih) || buildAnalysisFromMouthFirstIndices(landmarks, iw, ih);

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
    } catch (_e) {
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
      } catch (_e) {
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
    } catch (_e) {
      lm = null;
    }
    if (lm) {
      return { ok: true, bounds: lm.bounds, oval: lm.oval, confidence: lm.confidence, landmarks: lm.landmarks };
    }

    const mesh = await runFaceMeshOnCanvas(canvas);
    if (mesh.ok && mesh.bounds && mesh.oval) {
      return mesh;
    }

    const h = heuristicMouthRegion(iw, ih);
    return { ok: true, ...h, landmarks: null };
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

  /** Preserves landmark order along the arch (required for U-shaped dental curves). */
  const archPixelPointsInOrder = (landmarks, indices, iw, ih) =>
    indices
      .map((i) => {
        const p = landmarks[i];
        if (!p || typeof p.x !== "number") return null;
        return { x: p.x * iw, y: p.y * ih };
      })
      .filter(Boolean);

  const offsetPointsTowardCenter = (points, cx, cy, frac) =>
    points.map((p) => {
      const dx = cx - p.x;
      const dy = cy - p.y;
      return { x: p.x + dx * frac, y: p.y + dy * frac };
    });

  const densifyPolyline = (points, stepsPerSeg) => {
    if (points.length < 2) return points;
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      out.push(a);
      for (let s = 1; s < stepsPerSeg; s++) {
        const t = s / stepsPerSeg;
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
      }
    }
    out.push(points[points.length - 1]);
    return out;
  };

  const drawBracket = (ctx, x, y, tangentRad, w, h) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tangentRad + Math.PI / 2);
    const g = ctx.createLinearGradient(-w, -h * 0.5, w * 0.7, h * 0.45);
    g.addColorStop(0, "#e8eaee");
    g.addColorStop(0.35, "#b8bcc4");
    g.addColorStop(0.55, "#9ca3a8");
    g.addColorStop(1, "#787f8a");
    ctx.fillStyle = g;
    ctx.strokeStyle = "rgba(45,48,55,0.65)";
    ctx.lineWidth = Math.max(0.4, w * 0.12);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-w * 0.5, -h * 0.5, w, h, Math.min(0.8, w * 0.2));
    } else {
      ctx.rect(-w * 0.5, -h * 0.5, w, h);
    }
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(0.25, w * 0.08);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-w * 0.48, -h * 0.48, w * 0.96, h * 0.96, Math.min(0.7, w * 0.18));
    } else {
      ctx.rect(-w * 0.48, -h * 0.48, w * 0.96, h * 0.96);
    }
    ctx.stroke();
    ctx.restore();
  };

  const drawWireAndBracketsOnArch = (ctx, points, scale) => {
    if (points.length < 2) return;
    const spacing = clamp(scale * 0.014, 7, 22);
    const bracketW = clamp(scale * 0.0065, 2.5, 5);
    const bracketH = clamp(scale * 0.012, 4, 10);
    const lineW = clamp(scale * 0.0018, 0.9, 2.2);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(190, 196, 206, 0.98)";
    ctx.lineWidth = lineW;
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = 1.2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(140, 145, 155, 0.75)";
    ctx.lineWidth = lineW * 0.45;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();

    let distAlong = 0;
    let nextBracket = spacing * 0.35;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const start = distAlong;
      const end = distAlong + segLen;
      if (segLen < 0.25) {
        distAlong = end;
        continue;
      }
      while (nextBracket <= end + 0.01) {
        const t = (nextBracket - start) / segLen;
        if (t >= 0 && t <= 1) {
          const px = a.x + t * (b.x - a.x);
          const py = a.y + t * (b.y - a.y);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          drawBracket(ctx, px, py, ang, bracketW, bracketH);
        }
        nextBracket += spacing;
      }
      distAlong = end;
    }
  };

  /**
   * Draws fixed orthodontic-style wire + brackets on upper and lower arches.
   * Clipped to the mouth oval so nothing renders on lips/cheeks/skin outside the teeth band.
   */
  const applyBracesOverlay = async (imageSrc, landmarks, iw, ih, oval) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = iw;
        canvas.height = ih;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, iw, ih);

        const upperRaw = archPixelPointsInOrder(landmarks, UPPER_ARCH_INDICES, iw, ih);
        const lowerRaw = archPixelPointsInOrder(landmarks, LOWER_ARCH_INDICES, iw, ih);
        if (upperRaw.length < 3 || lowerRaw.length < 3) {
          resolve(canvas.toDataURL("image/jpeg", 0.95));
          return;
        }

        const { cx, cy, rx, ry } = oval;
        /* Inner-lip landmarks sit slightly inside the visible row; nudge outward (away from oval center) toward enamel. */
        const upper = offsetPointsTowardCenter(upperRaw, cx, cy, -0.052);
        const lower = offsetPointsTowardCenter(lowerRaw, cx, cy, -0.058);
        const uDense = densifyPolyline(upper, 4);
        const lDense = densifyPolyline(lower, 4);
        const scale = Math.max(iw, ih);

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.992, ry * 0.992, 0, 0, Math.PI * 2);
        ctx.clip();

        drawWireAndBracketsOnArch(ctx, uDense, scale);
        drawWireAndBracketsOnArch(ctx, lDense, scale);

        ctx.restore();
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("Could not load image for braces overlay"));
      img.src = imageSrc;
    });
  };

  /** CSS-style soft-light: backdrop Cb, blend layer Cs (0–1). */
  const softLightChannel = (cb, cs) => {
    if (cs <= 0.5) {
      return cb - (1 - 2 * cs) * cb * (1 - cb);
    }
    const D = cb < 0.25 ? ((16 * cb - 12) * cb + 4) * cb : Math.sqrt(cb);
    return cb + (2 * cs - 1) * (D - cb);
  };

  /**
   * Photorealistic whitening: blurred mask, BC lift, ivory soft-light tint, max 40% blend, highlights preserved.
   */
  const applyTeethWhitening = async (imageSrc, oval) => {
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

        const BLUR_MASK_PX = 4;
        const WHITEN_MAX_OPACITY = 0.4;
        const BRIGHTNESS_MULT = 1.125;
        const CONTRAST_MULT = 1.05;
        const IVORY = { r: 249 / 255, g: 249 / 255, b: 249 / 255 };

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mctx = maskCanvas.getContext("2d");
        mctx.fillStyle = "#000";
        mctx.fillRect(0, 0, w, h);
        mctx.fillStyle = "#fff";
        mctx.beginPath();
        mctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
        mctx.fill();

        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = w;
        blurCanvas.height = h;
        const bctx = blurCanvas.getContext("2d");
        bctx.filter = `blur(${BLUR_MASK_PX}px)`;
        bctx.drawImage(maskCanvas, 0, 0);
        bctx.filter = "none";
        const blurredMask = bctx.getImageData(0, 0, w, h).data;

        const margin = Math.ceil(BLUR_MASK_PX * 2 + 8);
        const x0 = clamp(Math.floor(oval.cx - oval.rx - margin), 0, w - 1);
        const y0 = clamp(Math.floor(oval.cy - oval.ry - margin), 0, h - 1);
        const x1 = clamp(Math.ceil(oval.cx + oval.rx + margin), 0, w);
        const y1 = clamp(Math.ceil(oval.cy + oval.ry + margin), 0, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const mi = (py * w + px) * 4;
            const mStrength = blurredMask[mi] / 255;
            if (mStrength < 0.002) continue;

            const idx = mi;
            const r0 = data[idx];
            const g0 = data[idx + 1];
            const b0 = data[idx + 2];

            let r = (r0 - 128) * CONTRAST_MULT + 128;
            let g = (g0 - 128) * CONTRAST_MULT + 128;
            let b = (b0 - 128) * CONTRAST_MULT + 128;
            r = clamp(r * BRIGHTNESS_MULT, 0, 255);
            g = clamp(g * BRIGHTNESS_MULT, 0, 255);
            b = clamp(b * BRIGHTNESS_MULT, 0, 255);

            const rb = r / 255;
            const gb = g / 255;
            const bb = b / 255;
            let tr = softLightChannel(rb, IVORY.r) * 255;
            let tg = softLightChannel(gb, IVORY.g) * 255;
            let tb = softLightChannel(bb, IVORY.b) * 255;

            let t = mStrength * WHITEN_MAX_OPACITY;
            const peak = Math.max(r0, g0, b0);
            if (peak > 250) t *= 0.42;
            else if (peak > 242) t *= 0.65;
            else if (peak > 232) t *= 0.82;

            const outR = r0 + (tr - r0) * t;
            const outG = g0 + (tg - g0) * t;
            const outB = b0 + (tb - b0) * t;

            data[idx] = Math.round(clamp(outR, 0, 255));
            data[idx + 1] = Math.round(clamp(outG, 0, 255));
            data[idx + 2] = Math.round(clamp(outB, 0, 255));
          }
        }

        ctx.putImageData(imageData, 0, 0);
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

  /** Soft oval mask in crop pixel space (white = edit region for inpainting) */
  const createTeethMaskForCrop = (cw, ch, ovalInCrop) => {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);

    const { cx, cy, rx, ry } = ovalInCrop;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) + OVAL_FEATHER_PX);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.72, "rgba(255,255,255,0.92)");
    grd.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + OVAL_FEATHER_PX * 0.5, ry + OVAL_FEATHER_PX * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL("image/png");
  };

  const enhanceWithAI = async (mouthImage, mask) => {
    if (!AI_SMILE_API) throw new Error("Backend API is not configured.");

    const response = await fetch(AI_SMILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: mouthImage, mask }),
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

      let canvasEnhanced = normalized;

      if (selectedTreatment === "whitening" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, oval);
      }
      if (selectedTreatment === "alignment" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds);
      }

      const mouthCrop = await cropMouthRegion(canvasEnhanced, bounds);

      /**
       * Replicate/SDXL inpainting on small mouth crops often produces cyan/blue glow or wrong colors.
       * Whitening/alignment use the canvas-enhanced mouthCrop only (natural, stable). Re-enable polish later with a teeth-specific model if needed.
       */
      const useReplicatePolish = false;

      let aiPolishedCrop = null;
      if (useReplicatePolish && AI_SMILE_API) {
        const ovalInCrop = {
          cx: oval.cx - bounds.x,
          cy: oval.cy - bounds.y,
          rx: oval.rx,
          ry: oval.ry,
        };
        const mask = createTeethMaskForCrop(bounds.width, bounds.height, ovalInCrop);
        try {
          aiPolishedCrop = await enhanceWithAI(mouthCrop, mask);
        } catch (_err) {
          aiPolishedCrop = null;
        }
      }

      let merged = await mergeFinalImage(normalized, aiPolishedCrop || mouthCrop, bounds, oval);

      const imgRef = await loadImage(normalized);
      if (selectedTreatment === "braces" && landmarks) {
        merged = await applyBracesOverlay(merged, landmarks, imgRef.width, imgRef.height, oval);
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
            Professional canvas preview: whitening, alignment, and braces overlay—tuned for natural tooth color without generative color shifts.
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
                {/* 1:1 mouth-centered crops — teeth stay the hero on all screen sizes */}
                <div className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/20 bg-black w-full max-w-lg mx-auto aspect-square max-h-[min(92vw,560px)]">
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
                </div>
                <p className="text-center text-xs text-zinc-500 md:hidden">Drag the gold line to compare — preview is zoomed on your smile.</p>

                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center"><CheckCircle2 size={24} /></div>
                    <div>
                      <h4 className="font-serif text-xl">Simulation Complete</h4>
                      <p className="text-zinc-400 text-sm capitalize">{activeTreatment} simulation with hybrid enhancement</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <PremiumButton variant="outline" onClick={reset}>Try Another</PremiumButton>
                    <PremiumButton className="text-black" style={{ background: "linear-gradient(135deg, #D4AF37, #F5E6C5)" }}>Book Consultation</PremiumButton>
                  </div>
                </div>

                <p className="text-center text-xs text-zinc-400 italic">
                  "This is an AI-generated preview and may not reflect exact medical results."
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





