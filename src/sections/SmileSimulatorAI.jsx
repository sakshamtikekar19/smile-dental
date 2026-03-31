import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Camera,
  X,
  CheckCircle2,
  Info,
  Sparkles,
  RefreshCw,
  WandSparkles,
  AlignCenter,
  ShieldPlus,
} from "lucide-react";
import PremiumButton from "../components/PremiumButton";
import ReactCompareImage from "react-compare-image";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const AI_SMILE_API = "http://localhost:5000/api/smile";
const TREATMENTS = [
  { id: "whitening", label: "Teeth Whitening", icon: Sparkles, desc: "Brighten your natural smile" },
  { id: "alignment", label: "Teeth Alignment", icon: AlignCenter, desc: "Perfectly straight teeth" },
  { id: "transformation", label: "Smile Transformation", icon: ShieldPlus, desc: "Complete aesthetic makeover" },
];

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("upload"); // upload, camera, processing, result
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
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBeforeImage(event.target.result);
        processWithAI(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Could not access the camera. Allow permissions or use “Choose File”.");
      setStep("upload");
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setBeforeImage(dataUrl);
    stopCamera();
    processWithAI(dataUrl);
  };

  const processWithAI = async (base64Image) => {
    setStep("processing");
    setError(null);
    const requestTreatment = selectedTreatment;
    setActiveTreatment(requestTreatment);
    try {
      const mask = await createTeethMask(base64Image);
      const response = await fetch(AI_SMILE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mask,
          mode: requestTreatment,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI request failed");
      }
      if (data.output) {
        setAfterImage(data.output);
        setStep("result");
      } else {
        throw new Error(data.error || "Failed to process image");
      }
    } catch (err) {
      console.error("AI Error:", err);
      const retryHint =
        typeof err.message === "string" && err.message.includes("429")
          ? " You are currently rate-limited by Replicate. Please wait about 10 seconds and try again."
          : "";
      setError(
        (err.message || "AI Simulation service is currently unavailable. Please try again later.") + retryHint
      );
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
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [step]);

  const createTeethMask = async (imageSrc) => {
    const img = await loadImage(imageSrc);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");

    // Black background means "preserve"; white area means "inpaint".
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { centerX, centerY, clipRx, clipRy } = estimateSmileBandForMask(img);

    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, clipRx, clipRy, 0, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL("image/png");
  };

  const estimateSmileBandForMask = (img) => {
    const width = img.width;
    const height = img.height;
    
    // Heuristic for smile position in a standard portrait/selfie
    const centerX = width * 0.5;
    const centerY = height * 0.62; // Positioned slightly lower for mouth
    const clipRx = width * 0.18;   // Horizontal spread of smile
    const clipRy = height * 0.07;  // Vertical height of teeth area

    return { centerX, centerY, clipRx, clipRy };
  };

  const addBracesOverlay = async (imageSrc) => {
    try {
      const img = await loadImage(imageSrc);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const { centerX, centerY, clipRx, clipRy } = estimateSmileBandForMask(img);
      const bracketCount = 6;
      const spacing = (clipRx * 1.4) / (bracketCount - 1);
      const startX = centerX - (spacing * (bracketCount - 1)) / 2;
      const upperY = centerY - clipRy * 0.45;
      const lowerY = centerY + clipRy * 0.3;
      const bracketW = Math.max(10, Math.round(canvas.width * 0.012));
      const bracketH = Math.max(8, Math.round(canvas.height * 0.014));

      ctx.strokeStyle = "rgba(170, 176, 186, 0.95)";
      ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.003));

      ctx.beginPath();
      ctx.moveTo(startX - bracketW * 0.5, upperY);
      ctx.quadraticCurveTo(centerX, upperY - clipRy * 0.25, startX + spacing * (bracketCount - 1) + bracketW * 0.5, upperY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX - bracketW * 0.5, lowerY);
      ctx.quadraticCurveTo(centerX, lowerY + clipRy * 0.2, startX + spacing * (bracketCount - 1) + bracketW * 0.5, lowerY);
      ctx.stroke();

      for (let i = 0; i < bracketCount; i += 1) {
        const x = startX + i * spacing;
        const upperX = x - bracketW / 2;
        const upperTop = upperY - bracketH / 2;
        const lowerX = x - bracketW / 2;
        const lowerTop = lowerY - bracketH / 2;

        const gradient = ctx.createLinearGradient(upperX, upperTop, upperX + bracketW, upperTop + bracketH);
        gradient.addColorStop(0, "rgba(232, 235, 239, 0.95)");
        gradient.addColorStop(1, "rgba(130, 138, 150, 0.95)");

        ctx.fillStyle = gradient;
        ctx.strokeStyle = "rgba(86, 94, 108, 0.85)";
        ctx.lineWidth = 1.2;

        roundRect(ctx, upperX, upperTop, bracketW, bracketH, 2.5);
        ctx.fill();
        ctx.stroke();

        roundRect(ctx, lowerX, lowerTop, bracketW, bracketH, 2.5);
        ctx.fill();
        ctx.stroke();
      }

      return canvas.toDataURL("image/jpeg", 0.95);
    } catch (_error) {
      return imageSrc;
    }
  };

  const roundRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  return (
    <section id="simulation" className="py-24 bg-[#F9F9F7]">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 mb-6">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Choose your treatment mode and visualize your transformation with medical-grade AI accuracy.
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
                <h3 className="text-2xl font-serif mb-4">Upload Your Photo</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">
                  For the best simulation, ensure your teeth are clearly visible and the lighting is even.
                </p>
                
                <div className="mb-8 mx-auto max-w-md rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8">
                  <div className="mx-auto flex h-24 w-56 items-center justify-center rounded-[999px] border-2 border-brand-gold/70 bg-white/80">
                    <span className="text-xs uppercase tracking-widest text-zinc-500">
                      Place teeth here
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-zinc-400">
                    Keep your mouth centered inside this guide for better AI results.
                  </p>
                </div>
                
                {error && (
                  <div className="mb-8 p-4 bg-red-50 text-red-500 text-sm rounded-xl border border-red-100">
                    {error}
                  </div>
                )}
                {cameraError && !error && (
                  <div className="mb-8 p-4 bg-amber-50 text-amber-800 text-sm rounded-xl border border-amber-100">
                    {cameraError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
                  <PremiumButton
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2"
                  >
                    <Upload size={18} />
                    Choose File
                  </PremiumButton>
                  <PremiumButton
                    variant="secondary"
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2"
                  >
                    <Camera size={18} />
                    Take Photo
                  </PremiumButton>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                
                <div className="mt-12 flex items-start gap-3 text-left p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <Info size={18} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Privacy Note: Your photos are processed securely and are not stored. 
                    This is an AI-generated visualization and may not reflect exact medical results.
                  </p>
                </div>
              </motion.div>
            )}

            {step === "camera" && (
              <motion.div
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative aspect-video md:aspect-[16/9] overflow-hidden rounded-3xl bg-black shadow-2xl"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/10" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-24 w-60 rounded-[999px] border-2 border-brand-gold/80 bg-white/10 backdrop-blur-[1px]" />
                  <span className="absolute mt-36 text-[10px] uppercase tracking-[0.2em] text-white/80">
                    Place teeth inside guide
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-4 p-6 sm:gap-6">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
                    aria-label="Cancel"
                  >
                    <X size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white shadow-2xl transition hover:scale-[1.03] active:scale-[0.98]"
                    aria-label="Capture photo"
                  >
                    <span className="h-12 w-12 rounded-full bg-zinc-900" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setCameraError(null);
                      startCamera();
                    }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"
                    aria-label="Restart camera"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white p-20 rounded-3xl border border-zinc-100 shadow-xl text-center"
              >
                <div className="relative w-24 h-24 mx-auto mb-12">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t-2 border-brand-gold rounded-full"
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-4 bg-brand-blue/30 rounded-full flex items-center justify-center"
                  >
                    <Sparkles size={24} className="text-brand-gold" />
                  </motion.div>
                </div>
                <h3 className="text-2xl font-serif text-zinc-800 mb-4">
                  Designing your future smile...
                </h3>
                <p className="text-zinc-400 font-sans tracking-wide uppercase text-xs">AI Engine Processing</p>
                <p className="text-zinc-500 text-sm mt-3 capitalize">{activeTreatment.replace('-', ' ')} simulation in progress</p>
                
                <div className="mt-12 max-w-xs mx-auto h-1 bg-zinc-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-1/2 h-full bg-brand-gold"
                  />
                </div>
              </motion.div>
            )}

            {step === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-black aspect-video md:aspect-[16/9]">
                  <ReactCompareImage 
                    leftImage={beforeImage} 
                    rightImage={afterImage}
                    rightImageCss={{ filter: "brightness(1.05) contrast(1.08) saturate(1.03)" }}
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
                      <p className="text-zinc-400 text-sm capitalize">
                        {activeTreatment.replace('-', ' ')} simulation with AI enhancement
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <PremiumButton variant="outline" onClick={reset}>
                      Try Another
                    </PremiumButton>
                    <PremiumButton variant="gold" className="shadow-lg shadow-brand-gold/20">
                      Book Consultation
                    </PremiumButton>
                  </div>
                </div>
                
                <p className="text-center text-xs text-zinc-400 italic">
                  "This is an AI-generated visualization and may not reflect exact medical results."
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




