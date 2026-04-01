import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, CheckCircle2, Info, Sparkles, RefreshCw, AlignCenter, ShieldPlus } from "lucide-react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

const TREATMENTS = [
  { id: "whitening", label: "Whitening", icon: Sparkles, desc: "Visible whitening, natural texture" },
  { id: "alignment", label: "Alignment", icon: AlignCenter, desc: "Subtle straightening illusion" },
  { id: "transformation", label: "Full Smile", icon: ShieldPlus, desc: "Whitening + alignment" },
];

const LIP_INDEXES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
];

let faceLandmarkerPromise;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const ensureFaceLandmarker = async () => {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })();
  }
  return faceLandmarkerPromise;
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
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const normalized = await normalizeImage(ev.target.result, 1024);
      setBeforeImage(normalized);
      processWithAI(normalized);
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setError(null);
    setCameraError(null);
    setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
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
    setBeforeImage(captured);
    processWithAI(captured);
  };

  const detectMouth = async (img) => {
    const width = img.width;
    const height = img.height;
    const fallback = {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.55),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.3),
    };

    try {
      const detector = await ensureFaceLandmarker();
      const result = detector.detect(img);
      const face = result?.faceLandmarks?.[0];
      if (!face?.length) return fallback;

      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;

      for (const idx of LIP_INDEXES) {
        const p = face[idx];
        if (!p) continue;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      const padX = (maxX - minX) * 0.35;
      const padY = (maxY - minY) * 0.55;
      let left = Math.floor((minX - padX) * width);
      let top = Math.floor((minY - padY) * height);
      let right = Math.ceil((maxX + padX) * width);
      let bottom = Math.ceil((maxY + padY) * height);

      const minTop = Math.floor(height * 0.5);
      const maxBottom = Math.floor(height * 0.9);
      top = Math.max(top, minTop);
      bottom = Math.min(bottom, maxBottom);

      left = clamp(left, 0, width - 2);
      top = clamp(top, minTop, height - 2);
      right = clamp(right, left + 2, width);
      bottom = clamp(bottom, top + 2, maxBottom);

      const bounds = { x: left, y: top, width: right - left, height: bottom - top };
      const centerY = bounds.y + bounds.height * 0.5;
      if (centerY < height * 0.58 || bounds.height < height * 0.08) return fallback;
      return bounds;
    } catch (_err) {
      return fallback;
    }
  };

  const applyTeethWhitening = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const region = ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
    const data = region.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // +10% brightness and +8% contrast, slight yellow reduction.
      r = (r - 128) * 1.08 + 128;
      g = (g - 128) * 1.08 + 128;
      b = (b - 128) * 1.08 + 128;

      r = r * 1.04 - 4;
      g = g * 1.08 + 3;
      b = b * 1.08 + 4;

      data[i] = clamp(Math.round(r), 0, 255);
      data[i + 1] = clamp(Math.round(g), 0, 255);
      data[i + 2] = clamp(Math.round(b), 0, 255);
    }

    await new Promise((resolve) => requestAnimationFrame(resolve));
    ctx.putImageData(region, bounds.x, bounds.y);
    return canvas.toDataURL("image/jpeg", 0.93);
  };

  const applyAlignmentWarp = async (imageSrc, bounds, scaleX = 0.97) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const mouthCanvas = document.createElement("canvas");
    mouthCanvas.width = bounds.width;
    mouthCanvas.height = bounds.height;
    const mctx = mouthCanvas.getContext("2d");
    mctx.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.58,
      bounds.width * 0.35,
      bounds.height * 0.24,
      0,
      0,
      Math.PI * 2
    );
    ctx.clip();

    const centerX = bounds.x + bounds.width * 0.5;
    const centerY = bounds.y + bounds.height * 0.58;
    ctx.translate(centerX, centerY);
    ctx.scale(scaleX, 1);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(mouthCanvas, bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();

    await new Promise((resolve) => requestAnimationFrame(resolve));
    return canvas.toDataURL("image/jpeg", 0.93);
  };

  const createTeethMask = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // teeth editable = white, rest black
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.58, width * 0.32, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL("image/png");
  };

  const cropImage = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const enhanceWithAI = async (mouthImage, mode, mask) => {
    if (!AI_SMILE_API) return null;
    const response = await fetch(AI_SMILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: mouthImage, mask, mode }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI polish failed");
    return data.outputDataUrl || data.output || null;
  };

  const mergeFinalImage = async (baseImage, mouthImage, bounds) => {
    const [base, mouth] = await Promise.all([loadImage(baseImage), loadImage(mouthImage)]);
    const canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(base, 0, 0);

    // feathered region merge
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.58,
      bounds.width * 0.36,
      bounds.height * 0.24,
      0,
      0,
      Math.PI * 2
    );
    ctx.clip();
    ctx.drawImage(mouth, bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.93);
  };

  const processWithAI = async (baseImage) => {
    setStep("processing");
    setError(null);
    const mode = selectedTreatment;
    setActiveTreatment(mode);

    try {
      const normalized = await normalizeImage(baseImage, 1024);
      const img = await loadImage(normalized);
      const bounds = await detectMouth(img);

      let canvasEnhanced = normalized;
      if (mode === "whitening" || mode === "transformation") {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, bounds);
      }
      if (mode === "alignment" || mode === "transformation") {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds, 0.97);
      }

      const mouthCrop = await cropImage(canvasEnhanced, bounds);
      const mask = createTeethMask(bounds.width, bounds.height);

      let aiPolishedCrop = null;
      try {
        aiPolishedCrop = await enhanceWithAI(mouthCrop, mode, mask);
      } catch (_aiErr) {
        aiPolishedCrop = null;
      }

      const finalMouth = aiPolishedCrop || mouthCrop;
      const merged = await mergeFinalImage(normalized, finalMouth, bounds);
      setAfterImage(merged);
      setBeforeImage(normalized);
      setStep("result");
    } catch (err) {
      const message = typeof err?.message === "string" ? err.message : "Simulation failed. Please retry with a clear smile photo.";
      setError(message);
      setStep("upload");
    }
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
            Hybrid dental preview: canvas enhancement + AI polish for realistic teeth-only results.
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
                  <div className="w-20 h-20 bg-brand-blue/30 rounded-full flex items-center justify-center text-zinc-600">
                    <Upload size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-serif mb-4">Upload or Capture Smile</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">Keep teeth visible and centered for best mouth detection.</p>

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
                    This is an AI-generated preview and may not reflect exact medical results.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative aspect-video overflow-hidden rounded-3xl bg-black shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-24 w-60 rounded-[999px] border-2 border-brand-gold/80 bg-white/10" />
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
                <div className="relative w-24 h-24 mx-auto mb-12">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-t-2 border-brand-gold rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-4 bg-brand-blue/30 rounded-full flex items-center justify-center"><Sparkles size={24} className="text-brand-gold" /></motion.div>
                </div>
                <h3 className="text-2xl font-serif text-zinc-800 mb-4">Designing your future smile...</h3>
                <p className="text-zinc-500 text-sm mt-3 capitalize">{activeTreatment} mode in progress</p>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black aspect-video md:aspect-[16/9]">
                  <ReactCompareImage leftImage={beforeImage} rightImage={afterImage} rightImageCss={{ filter: "brightness(1.06) contrast(1.08)" }} sliderLineWidth={2} sliderLineColor="#D4AF37" handleSize={40} />
                </div>

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
                    <PremiumButton variant="gold" className="shadow-lg shadow-brand-gold/20">Book Consultation</PremiumButton>
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
