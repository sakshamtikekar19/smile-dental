import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, CheckCircle2, Info, Sparkles, RefreshCw, AlignCenter, ShieldPlus } from "lucide-react";

import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

const TREATMENTS = [
  { id: "whitening", label: "Whitening", icon: Sparkles, desc: "Visible whitening" },
  { id: "alignment", label: "Alignment", icon: AlignCenter, desc: "Subtle straightening" },
  { id: "transformation", label: "Full Smile", icon: ShieldPlus, desc: "Whitening + alignment" },
];

/** Lip / mouth perimeter only — do not use eye indices for mouth geometry */
const MOUTH_PERIMETER_INDICES = [61, 291, 0, 17, 13, 14, 78, 308];
/** Used only for sanity (eyes should sit above the mouth), not for mouth box math */
const EYE_SANITY_INDICES = [33, 133, 362, 263];
const MOUTH_CONFIDENCE_MIN = 0.8;
const OVAL_FEATHER_PX = 16;

let faceMeshInstance;
let faceMeshLoadFailed = false;

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
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
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
   * Mouth geometry from mouth-only landmarks. Eyes are not used for the box;
   * optional sanity: eyes above mouth.
   */
  const analyzeMouthFromLandmarks = (landmarks, iw, ih) => {
    for (const i of MOUTH_PERIMETER_INDICES) {
      const p = landmarks[i];
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    MOUTH_PERIMETER_INDICES.forEach((i) => {
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
    const eyeAbove = avgEyeY < mouthCenterY - 0.025 ? 1 : 0.55;

    const wScore = mouthWidthNorm > 0.11 && mouthWidthNorm < 0.55 ? 1 : Math.max(0, 1 - Math.abs(mouthWidthNorm - 0.3) * 5);
    const yScore = mouthCenterY > 0.36 && mouthCenterY < 0.92 ? 1 : 0.35;
    const hScore = lipSep > 0.006 ? 1 : 0.45;
    const posScore = cy / ih > 0.34 && cy / ih < 0.9 ? 1 : 0.4;

    const confidence = clamp(
      (0.32 * wScore + 0.28 * yScore + 0.22 * hScore + 0.18 * posScore) * eyeAbove,
      0,
      1
    );

    return {
      confidence,
      bounds: { x, y, width, height },
      oval: { cx, cy, rx, ry },
    };
  };

  /**
   * @returns {Promise<{ ok: boolean, confidence?: number, bounds?: object, oval?: object }>}
   */
  const detectMouth = async (imageSrc) => {
    const img = await loadImage(imageSrc);
    const fail = { ok: false, confidence: 0 };

    const faceMesh = await initFaceMesh();
    if (!faceMesh) return fail;

    return new Promise((resolve) => {
      let settled = false;
      const finish = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      faceMesh.onResults((results) => {
        const landmarks = results?.multiFaceLandmarks?.[0];
        if (!landmarks) {
          finish(fail);
          return;
        }
        const analysis = analyzeMouthFromLandmarks(landmarks, img.width, img.height);
        if (!analysis) {
          finish(fail);
          return;
        }
        const ok = analysis.confidence >= MOUTH_CONFIDENCE_MIN;
        finish({ ok, ...analysis });
      });

      faceMesh.send({ image: img }).catch(() => finish(fail));
    });
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

  const applyTeethWhitening = async (imageSrc, oval) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const pad = OVAL_FEATHER_PX + 6;
        const x0 = clamp(Math.floor(oval.cx - oval.rx - pad), 0, canvas.width - 1);
        const x1 = clamp(Math.ceil(oval.cx + oval.rx + pad), 0, canvas.width);
        const y0 = clamp(Math.floor(oval.cy - oval.ry - pad), 0, canvas.height - 1);
        const y1 = clamp(Math.ceil(oval.cy + oval.ry + pad), 0, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let py = y0; py < y1; py++) {
          for (let px = x0; px < x1; px++) {
            const wMouth = ellipseFeatherWeight(px, py, oval, OVAL_FEATHER_PX);
            if (wMouth <= 0) continue;

            const idx = (py * canvas.width + px) * 4;
            let r = data[idx];
            let g = data[idx + 1];
            let b = data[idx + 2];

            const brightness = (r + g + b) / 3;
            const yellowBias = r - b;
            const isToothLike = brightness > 65 && brightness < 245 && yellowBias > -22;
            if (!isToothLike) continue;

            const w = wMouth;
            r = r * (1 - w) + w * (r * 0.84 + 6);
            g = g * (1 - w) + w * (g * 1.14 + 10);
            b = b * (1 - w) + w * (b * 1.2 + 14);

            const contrast = 1.06;
            r = (r - 128) * contrast + 128;
            g = (g - 128) * contrast + 128;
            b = (b - 128) * contrast + 128;

            data[idx] = Math.min(255, Math.max(0, Math.round(r)));
            data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
            data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
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

      if (!mouth.ok || !mouth.bounds || !mouth.oval) {
        setBeforeImage(null);
        setAfterImage(null);
        setError("Please center your smile in the frame");
        setStep("upload");
        return;
      }

      const { bounds, oval } = mouth;

      let canvasEnhanced = normalized;

      if (selectedTreatment === "whitening" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, oval);
      }
      if (selectedTreatment === "alignment" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds);
      }

      const mouthCrop = await cropMouthRegion(canvasEnhanced, bounds);
      const ovalInCrop = {
        cx: oval.cx - bounds.x,
        cy: oval.cy - bounds.y,
        rx: oval.rx,
        ry: oval.ry,
      };
      const mask = createTeethMaskForCrop(bounds.width, bounds.height, ovalInCrop);

      let aiPolishedCrop = null;
      try {
        aiPolishedCrop = await enhanceWithAI(mouthCrop, mask);
      } catch (_err) {
        aiPolishedCrop = null;
      }

      const merged = await mergeFinalImage(normalized, aiPolishedCrop || mouthCrop, bounds, oval);

      const imgRef = await loadImage(normalized);
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
    <section id="simulation" className="py-24 bg-[#F9F9F7]">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 mb-6">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Hybrid dental preview: canvas enhancement + AI polish.
          </p>
        </AnimatedSection>

        <AnimatedSection className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">Keep teeth visible and centered for best mouth detection.</p>

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
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-24 w-60 rounded-[999px] border-2 border-brand-gold/80 bg-white/10" /></div>
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





