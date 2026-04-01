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

  const detectMouthBounds = (landmarks, imageWidth, imageHeight) => {
    const mouthPoints = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = 0;
    let maxY = 0;

    mouthPoints.forEach((i) => {
      const point = landmarks[i];
      const x = point.x * imageWidth;
      const y = point.y * imageHeight;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    const bounds = {
      x: Math.max(0, Math.floor(minX - 10)),
      y: Math.max(Math.floor(imageHeight * 0.5), Math.floor(minY - 10)),
      width: Math.floor(maxX - minX + 20),
      height: Math.floor(maxY - minY + 20),
    };

    if (bounds.height < imageHeight * 0.08) {
      return {
        x: Math.floor(imageWidth * 0.25),
        y: Math.floor(imageHeight * 0.55),
        width: Math.floor(imageWidth * 0.5),
        height: Math.floor(imageHeight * 0.3),
      };
    }

    return bounds;
  };

  const detectMouth = async (imageSrc) => {
    const img = await loadImage(imageSrc);

    const faceMesh = await initFaceMesh();
    if (!faceMesh) {
      return {
        x: Math.floor(img.width * 0.25),
        y: Math.floor(img.height * 0.55),
        width: Math.floor(img.width * 0.5),
        height: Math.floor(img.height * 0.3),
      };
    }

    return new Promise(async (resolve) => {
      const fallback = {
        x: Math.floor(img.width * 0.25),
        y: Math.floor(img.height * 0.55),
        width: Math.floor(img.width * 0.5),
        height: Math.floor(img.height * 0.3),
      };

      faceMesh.onResults((results) => {
        const landmarks = results?.multiFaceLandmarks?.[0];
        if (!landmarks) {
          resolve(fallback);
          return;
        }
        resolve(detectMouthBounds(landmarks, img.width, img.height));
      });

      try {
        await faceMesh.send({ image: img });
      } catch (_e) {
        resolve(fallback);
      }
    });
  };

  const applyTeethWhitening = async (imageSrc, bounds) => {
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

        const imageData = ctx.getImageData(x, y, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          const isToothLike = r > 120 && g > 120 && b < 160;

          if (isToothLike) {
            r *= 0.92;
            g *= 1.08;
            b *= 1.12;

            data[i] = Math.min(255, r);
            data[i + 1] = Math.min(255, g);
            data[i + 2] = Math.min(255, b);
          }
        }

        ctx.putImageData(imageData, x, y);
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

  const createTeethMask = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(width * 0.5, height * 0.58, width * 0.32, height * 0.2, 0, 0, Math.PI * 2);
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

  const mergeFinalImage = async (originalSrc, mouthEnhancedSrc, bounds) => {
    const [original, mouth] = await Promise.all([loadImage(originalSrc), loadImage(mouthEnhancedSrc)]);
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(original, 0, 0);

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

    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const processWithAI = async (baseImage) => {
    setStep("processing");
    setError(null);
    setActiveTreatment(selectedTreatment);

    try {
      const normalized = await normalizeImage(baseImage, 1024);
      const bounds = await detectMouth(normalized);

      let canvasEnhanced = normalized;

      if (selectedTreatment === "whitening" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyTeethWhitening(canvasEnhanced, bounds);
      }
      if (selectedTreatment === "alignment" || selectedTreatment === "transformation") {
        canvasEnhanced = await applyAlignmentWarp(canvasEnhanced, bounds);
      }

      const mouthCrop = await cropMouthRegion(canvasEnhanced, bounds);
      const mask = createTeethMask(bounds.width, bounds.height);

      let aiPolishedCrop = null;
      try {
        aiPolishedCrop = await enhanceWithAI(mouthCrop, mask);
      } catch (_err) {
        aiPolishedCrop = null;
      }

      const merged = await mergeFinalImage(normalized, aiPolishedCrop || mouthCrop, bounds);

      setBeforeImage(normalized);
      setAfterImage(merged);
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
                <div className="rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/20 bg-black aspect-video md:aspect-[16/9]">
                  <ReactCompareImage
                    leftImage={beforeImage}
                    rightImage={afterImage}
                    sliderLineWidth={2}
                    sliderLineColor="#D4AF37"
                    handleSize={40}
                  />
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



