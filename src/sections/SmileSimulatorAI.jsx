import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Camera,
  X,
  CheckCircle2,
  Info,
  Sparkles,
  RefreshCw,
  AlignCenter,
  ShieldPlus,
} from "lucide-react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import ReactCompareImage from "react-compare-image";
import PremiumButton from "../components/PremiumButton";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const IS_LOCAL_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const AI_SMILE_API = import.meta.env.VITE_AI_SMILE_API || (IS_LOCAL_HOST ? "http://localhost:5000/api/smile" : null);

const TREATMENTS = [
  { id: "whitening", label: "Teeth Whitening", icon: Sparkles, desc: "Visible whitening with natural texture" },
  { id: "alignment", label: "Teeth Alignment", icon: AlignCenter, desc: "Slightly straighter, natural spacing" },
  { id: "transformation", label: "Smile Transformation", icon: ShieldPlus, desc: "Whitening + gentle alignment" },
];

const LIP_INDEXES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308,
];

let faceLandmarkerPromise;

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    reader.onload = async (event) => {
      const normalized = await normalizeImage(event.target.result, 1024);
      setBeforeImage(normalized);
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
    } catch (err) {
      setCameraError("Could not access camera. Allow permissions or upload a photo.");
      setStep("upload");
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const maxWidth = 1024;
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const outW = Math.round(video.videoWidth * scale);
    const outH = Math.round(video.videoHeight * scale);

    canvas.width = outW;
    canvas.height = outH;
    ctx.drawImage(video, 0, 0, outW, outH);
    const captured = canvas.toDataURL("image/jpeg", 0.88);

    stopCamera();
    setBeforeImage(captured);
    processWithAI(captured);
  };

  const processWithAI = async (baseImage) => {
    setStep("processing");
    setError(null);
    const requestMode = selectedTreatment;
    setActiveTreatment(requestMode);

    if (!AI_SMILE_API) {
      setError("Backend API is not configured for this domain. Set VITE_AI_SMILE_API to your deployed backend URL.");
      setStep("upload");
      return;
    }

    try {
      const payload = await createMouthPayload(baseImage);
      const response = await fetch(AI_SMILE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: payload.croppedImage,
          mask: payload.mask,
          mode: requestMode,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed");

      const aiCrop = getOutputImageValue(data);
      if (!aiCrop) throw new Error("AI returned an invalid result image.");

      const merged = await mergeRegionIntoOriginal(payload.originalImage, aiCrop, payload.bounds);
      const polished = await enhanceTeethRegion(merged, payload.bounds);
      setAfterImage(polished);
      setStep("result");
    } catch (err) {
      const message = typeof err?.message === "string" ? err.message : "AI Simulation service is unavailable.";
      setError(message);
      setStep("upload");
    }
  };

  const createMouthPayload = async (imageSrc) => {
    const normalized = await normalizeImage(imageSrc, 1024);
    const img = await loadImage(normalized);
    const bounds = await detectMouthBounds(img);
    const croppedImage = cropImage(normalized, bounds);
    const mask = createTeethMask(bounds.width, bounds.height);

    return {
      originalImage: normalized,
      croppedImage,
      mask,
      bounds,
    };
  };

  const detectMouthBounds = async (img) => {
    const width = img.width;
    const height = img.height;

    try {
      const detector = await ensureFaceLandmarker();
      const result = detector.detect(img);
      const face = result?.faceLandmarks?.[0];

      if (face?.length) {
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

        const left = clamp(Math.floor((minX - padX) * width), 0, width - 2);
        const top = clamp(Math.floor((minY - padY) * height), 0, height - 2);
        const right = clamp(Math.ceil((maxX + padX) * width), left + 2, width);
        const bottom = clamp(Math.ceil((maxY + padY) * height), top + 2, height);

        return {
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
        };
      }
    } catch (_err) {
      // Fall back below.
    }

    return {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.55),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.3),
    };
  };

  const createTeethMask = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Required mask semantics: editable teeth area in white, everything else black.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.58, width * 0.32, height * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL("image/png");
  };

  const cropImage = (imageSrc, bounds) => {
    const img = new Image();
    img.src = imageSrc;
    const canvas = document.createElement("canvas");
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext("2d");
    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = reject;
    });
  };

  const mergeRegionIntoOriginal = async (originalSrc, cropSrc, bounds) => {
    const [original, crop] = await Promise.all([loadImage(originalSrc), loadImage(cropSrc)]);
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(original, 0, 0);

    // Feathered blend so only mouth area transitions softly.
    ctx.save();
    const grad = ctx.createRadialGradient(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.6,
      bounds.width * 0.18,
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.6,
      Math.max(bounds.width, bounds.height) * 0.6
    );
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = original.width;
    maskCanvas.height = original.height;
    const mctx = maskCanvas.getContext("2d");
    mctx.fillStyle = "rgba(0,0,0,0)";
    mctx.fillRect(0, 0, original.width, original.height);
    mctx.fillStyle = grad;
    mctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = original.width;
    tempCanvas.height = original.height;
    const tctx = tempCanvas.getContext("2d");
    tctx.drawImage(crop, bounds.x, bounds.y, bounds.width, bounds.height);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(maskCanvas, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.93);
  };

  const enhanceTeethRegion = async (imageSrc, bounds) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.58,
      bounds.width * 0.32,
      bounds.height * 0.2,
      0,
      0,
      Math.PI * 2
    );
    ctx.clip();
    ctx.filter = "brightness(1.05) contrast(1.05)";
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.93);
  };

  const getOutputImageValue = (data) => {
    if (!data) return null;
    if (typeof data.outputDataUrl === "string" && data.outputDataUrl.startsWith("data:image/")) return data.outputDataUrl;
    if (typeof data.output === "string") return data.output;
    if (Array.isArray(data.output) && typeof data.output[0] === "string") return data.output[0];
    return null;
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
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [step]);

  return (
    <section id="simulation" className="py-24 bg-[#F9F9F7]">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 mb-6">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Teeth-only AI preview with strict identity preservation.
          </p>
        </AnimatedSection>

        <AnimatedSection className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TREATMENTS.map((treatment) => {
              const Icon = treatment.icon;
              const active = selectedTreatment === treatment.id;
              return (
                <button
                  key={treatment.id}
                  type="button"
                  onClick={() => setSelectedTreatment(treatment.id)}
                  disabled={step === "processing" || step === "result"}
                  className={cn(
                    "rounded-2xl border p-5 text-left transition-all duration-300 bg-white",
                    active
                      ? "border-brand-gold shadow-md ring-1 ring-brand-gold/20 scale-[1.02]"
                      : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm",
                    (step === "processing" || step === "result") && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-4 mb-3">
                    <span className={cn("p-3 rounded-xl", active ? "bg-brand-blue" : "bg-zinc-100")}>
                      <Icon size={20} className={active ? "text-zinc-800" : "text-zinc-500"} />
                    </span>
                    <span className="text-base font-semibold text-zinc-800">{treatment.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{treatment.desc}</p>
                </button>
              );
            })}
          </div>
        </AnimatedSection>

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-12 rounded-3xl border border-zinc-100 shadow-xl text-center"
              >
                <div className="mb-10 flex justify-center">
                  <div className="w-20 h-20 bg-brand-blue/30 rounded-full flex items-center justify-center text-zinc-600">
                    <Upload size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-serif mb-4">Upload or Capture Smile</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">Keep teeth visible and centered for best mouth detection.</p>

                {error && (
                  <div className="mb-8 p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">{error}</div>
                )}
                {cameraError && !error && (
                  <div className="mb-8 p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">{cameraError}</div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <PremiumButton onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2">
                    <Upload size={18} />
                    Choose File
                  </PremiumButton>
                  <PremiumButton variant="secondary" onClick={startCamera} className="flex items-center justify-center gap-2">
                    <Camera size={18} />
                    Take Photo
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
                  <button type="button" onClick={reset} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white">
                    <X size={22} />
                  </button>
                  <button type="button" onClick={takePhoto} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white">
                    <span className="h-12 w-12 rounded-full bg-zinc-900" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      startCamera();
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white p-20 rounded-3xl border border-zinc-100 shadow-xl text-center">
                <div className="relative w-24 h-24 mx-auto mb-12">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-t-2 border-brand-gold rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-4 bg-brand-blue/30 rounded-full flex items-center justify-center">
                    <Sparkles size={24} className="text-brand-gold" />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-serif text-zinc-800 mb-4">Designing your future smile...</h3>
                <p className="text-zinc-500 text-sm mt-3 capitalize">{activeTreatment} mode in progress</p>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black aspect-video md:aspect-[16/9]">
                  <ReactCompareImage
                    leftImage={beforeImage}
                    rightImage={afterImage}
                    rightImageCss={{ filter: "brightness(1.08) contrast(1.12)" }}
                    sliderLineWidth={2}
                    sliderLineColor="#D4AF37"
                    handleSize={40}
                  />
                </div>

                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif text-xl">Simulation Complete</h4>
                      <p className="text-zinc-400 text-sm capitalize">{activeTreatment} simulation with AI enhancement</p>
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
