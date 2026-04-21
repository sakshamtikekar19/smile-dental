import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Layers, ShieldCheck, Zap, Activity, ChevronRight, RotateCcw, Sliders, Info, CheckCircle2 } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";
import { eraseAboveUpperLip } from "../utils/bracesClipFixed";
import { buildBracesPack } from "../utils/bracesGeometryFixed";
import { applyAlignment as applyProfessionalAlignment } from "../utils/alignmentEngine";
import { applyWhitening as applyProfessionalWhitening } from "../utils/whiteningEngine";
import { applyClinicalZoom } from "../utils/zoomEngine";

// ── Constants & Design System ────────────────────────────────────────────────
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MAX_IMAGE_SIZE = IS_MOBILE ? 800 : 1200;
const ACCENT_CYAN = "#00D1FF";

const TREATMENTS = [
  { id: "whitening", label: "Whitening", desc: "Advanced enamel sheen enhancement.", icon: Zap },
  { id: "alignment", label: "Alignment", desc: "Surgical-grade dental rectification.", icon: Layers },
  { id: "braces", label: "Braces", desc: "Precision bracket simulation.", icon: ShieldCheck },
  { id: "transformation", label: "Full Smile", desc: "Hollywood-style reconstruction.", icon: Activity },
];

const PRESETS = [
  { id: "natural", label: "Natural Balance", intensity: 50 },
  { id: "bright", label: "Clinical Bright", intensity: 85 },
  { id: "perfect", label: "Maximum Impact", intensity: 100 },
];

// ── MediaPipe Singleton ──────────────────────────────────────────────────────
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
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
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

// ── Processing Utilities (ENGINE LOCK INTACT) ────────────────────────────────
async function detectLandmarks(imageUrl) {
  const landmarker = await initFaceLandmarker();
  if (!landmarker) return null;
  const img = await loadImage(imageUrl);
  const result = landmarker.detect(img);
  return result.faceLandmarks?.[0] || null;
}

async function resizeImage(url, maxDim) {
  const img = await loadImage(url);
  let { width: w, height: h } = img;
  if (w > maxDim || h > maxDim) {
    if (w > h) { h = (h / w) * maxDim; w = maxDim; }
    else { w = (w / h) * maxDim; h = maxDim; }
  }
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return { url: c.toDataURL("image/jpeg", 0.94), w, h };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function applyBracesEffect(ctx, landmarks, w, h, bracesImage) {
  if (!landmarks || !bracesImage) return;
  const pack = buildBracesPack(landmarks, w, h);
  const lipMidY = landmarks[13].y * h;
  ctx.save();
  eraseAboveUpperLip(ctx, landmarks, w, h);
  const drawBrackets = (anchors) => {
    anchors.forEach(a => {
      const yDistFromMid = Math.abs(a.y - lipMidY) / (h * 0.1);
      const verticalPerspective = Math.max(0.8, Math.min(1.1, 1 - yDistFromMid * 0.15));
      const side = pack.baseW * (a.wMult || 1) * verticalPerspective;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.ang || 0);
      ctx.shadowBlur = 5; ctx.shadowColor = "rgba(0,0,0,0.42)";
      ctx.drawImage(bracesImage, -side / 2, -side / 2, side, side);
      ctx.restore();
    });
  };
  drawBrackets(pack.upperAnchors || []);
  drawBrackets(pack.lowerAnchors || []);
  ctx.restore();
}

// ── Premium UI Components ────────────────────────────────────────────────────

const MedicalSlider = ({ label, value, onChange }) => (
  <div className="mb-6 group">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[#6B7280] font-bold group-hover:text-white transition-colors">{label}</span>
      <span className="text-[11px] font-mono text-accent-blue glow-blue">{value}%</span>
    </div>
    <div className="relative h-1.5 w-full bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5">
      <motion.div 
        initial={false}
        animate={{ width: `${value}%` }}
        className="absolute h-full bg-accent-blue shadow-[0_0_12px_#00D1FF]" 
      />
      <input 
        type="range" min="0" max="100" value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
    </div>
  </div>
);

const TreatmentModule = ({ treatment, active, onSelect }) => {
  const Icon = treatment.icon;
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full p-4 mb-3 rounded-2xl border transition-all duration-500 flex items-center gap-4 relative overflow-hidden group",
        active 
          ? "bg-[#111111] border-accent-blue/50 shadow-[0_0_25px_rgba(0,209,255,0.15)]" 
          : "bg-[#0A0A0A] border-[#1F1F1F] hover:border-white/10"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
        active ? "bg-accent-blue text-black shadow-[0_0_15px_#00D1FF]" : "bg-[#1A1A1A] text-[#6B7280] group-hover:text-white"
      )}>
        <Icon size={18} />
      </div>
      <div className="text-left">
        <h4 className={cn("text-[13px] font-bold tracking-tight mb-0.5 transition-colors", active ? "text-white" : "text-[#A0A0A0]")}>
          {treatment.label}
        </h4>
        <p className="text-[9px] text-[#6B7280] uppercase tracking-widest font-medium opacity-80">{active ? "System Active" : "Diagnostic Ready"}</p>
      </div>
      {active && (
        <motion.div layoutId="nav-glow" className="absolute right-0 top-0 bottom-0 w-1 bg-accent-blue shadow-[0_0_15px_#00D1FF]" />
      )}
    </button>
  );
};

// ── Main Controller ──────────────────────────────────────────────────────────

const SmileSimulatorAI = () => {
  const [step, setStep] = useState("entry");
  const [selectedTreatment, setSelectedTreatment] = useState("whitening");
  const [intensities, setIntensities] = useState({ whitening: 80, alignment: 100, braces: 100, transformation: 100 });
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [error, setError] = useState(null);
  const [processingLog, setProcessingLog] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [rawImageUrl, setRawImageUrl] = useState(null);
  const [finalLandmarks, setFinalLandmarks] = useState(null);
  
  const pendingTreatmentRef = useRef("whitening");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const generationRef = useRef(0);
  const requestRef = useRef(null);
  const renderRequestRef = useRef(null);
  const bracesImageRef = useRef(null);
  const localCanvasRef = useRef(null);
  const mainCanvasRef = useRef(null);
  const zoomAfterRef = useRef(null);
  const zoomBeforeRef = useRef(null);
  const stabilizerRef = useRef(null);
  const lerpState = useRef({ x: 0, y: 0, ang: 0, w: 0 });

  useEffect(() => {
    const img = new Image();
    const base = import.meta.env.BASE_URL || "/";
    img.src = `${base}assets/bracket.png`.replace(/\/\//g, '/');
    img.onload = () => { bracesImageRef.current = img; };
    initFaceLandmarker().catch(() => { });
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraStream(null);
  };

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
    const bgCanvas = canvasRef.current;
    if (!video || !bgCanvas || video.videoWidth === 0) {
      if (step === "camera") renderRequestRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    if (bgCanvas.width !== video.videoWidth) { bgCanvas.width = video.videoWidth; bgCanvas.height = video.videoHeight; }
    const bgCtx = bgCanvas.getContext("2d");
    bgCtx.drawImage(video, 0, 0, bgCanvas.width, bgCanvas.height);

    if (latestLandmarksRef.current && stabilizerRef.current) {
      const marks = latestLandmarksRef.current;
      const vw = bgCanvas.width, vh = bgCanvas.height;
      const anchorX = marks[168].x * vw;
      const anchorY = marks[13].y * vh;
      const p1 = marks[33], p2 = marks[263];
      const rawAng = Math.atan2((p2.y - p1.y) * vh, (p2.x - p1.x) * vw) * (180 / Math.PI);
      const mLeft = marks[61], mRight = marks[291];
      const rawW = Math.sqrt(Math.pow((mRight.x - mLeft.x) * vw, 2) + Math.pow((mRight.y - mLeft.y) * vh, 2));
      const mouthW = rawW * 1.35;

      const lerp = (a, b, f) => a + (b - a) * f;
      const s = lerpState.current;
      s.x = lerp(s.x || anchorX, anchorX, 0.35);
      s.y = lerp(s.y || anchorY, anchorY, 0.35);
      s.ang = lerp(s.ang || rawAng, rawAng, 0.25);
      s.w = lerp(s.w || mouthW, mouthW, 0.32);

      const div = stabilizerRef.current;
      div.style.left = `${s.x}px`; div.style.top = `${s.y}px`;
      div.style.width = `${s.w}px`; div.style.height = `${s.w * 0.75}px`;
      div.style.transform = `translate(-50%, -10%) rotate(${s.ang}deg)`;

      const sCanvas = localCanvasRef.current;
      if (sCanvas) {
        if (sCanvas.width !== Math.floor(s.w)) { sCanvas.width = Math.floor(s.w); sCanvas.height = Math.floor(s.w * 0.75); }
        const sctx = sCanvas.getContext("2d");
        sctx.clearRect(0, 0, sCanvas.width, sCanvas.height);
        sctx.save();
        sctx.translate(sCanvas.width / 2, sCanvas.height * 0.1);
        sctx.rotate(-s.ang * Math.PI / 180);
        sctx.drawImage(video, -s.x, -s.y, vw, vh);
        sctx.restore();

        const t = selectedTreatment;
        const opts = { anchor: { x: s.x, y: s.y }, rotation: s.ang };
        if (t === "whitening" || t === "alignment" || t === "transformation") applyProfessionalWhitening(sctx, marks, vw, vh, opts);
        if (t === "alignment" || t === "transformation") applyProfessionalAlignment(sctx, marks, vw, vh, opts);
      }
    }
    if (step === "camera") renderRequestRef.current = requestAnimationFrame(renderLoop);
  }, [step, selectedTreatment]);

  const startCamera = async () => {
    stopCamera();
    setError(null); setStep("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1200 }, height: { ideal: 800 } },
        audio: false
      });
      streamRef.current = stream; setCameraStream(stream);
    } catch { setError("Optical hardware access denied."); setStep("entry"); }
  };

  const startHeavyProcessingPipeline = useCallback(async (imageUrl) => {
    const treatment = pendingTreatmentRef.current;
    const generation = ++generationRef.current;
    try {
      setProcessingLog("Scanning anatomical structure...");
      let landmarks = await detectLandmarks(imageUrl);
      if (!landmarks && latestLandmarksRef.current) landmarks = latestLandmarksRef.current;
      if (generation !== generationRef.current) return;
      if (!landmarks) throw new Error("Anatomical detection failed.");

      const { url: snapshotUrl, w: iw, h: ih } = await resizeImage(imageUrl, MAX_IMAGE_SIZE);
      
      if (!mainCanvasRef.current) mainCanvasRef.current = document.createElement("canvas");
      const procCanvas = mainCanvasRef.current;
      procCanvas.width = iw; procCanvas.height = ih;
      
      const pctx = procCanvas.getContext("2d", { willReadFrequently: true });
      const img = await loadImage(snapshotUrl);
      pctx.drawImage(img, 0, 0, iw, ih);

      // 🦷 ENGINE PIPELINE (STRICT ENGINE LOCK INTACT)
      if (treatment === "whitening" || treatment === "alignment" || treatment === "transformation") {
        applyProfessionalWhitening(pctx, landmarks, iw, ih);
      }
      if (treatment === "braces" || treatment === "transformation") {
        applyBracesEffect(pctx, landmarks, iw, ih, bracesImageRef.current);
      }
      if (treatment === "alignment" || treatment === "transformation") {
        applyProfessionalAlignment(pctx, landmarks, iw, ih);
      }

      // 🔍 CLINICAL ZOOM RENDER
      requestAnimationFrame(() => {
        const screenCanvas = zoomAfterRef.current;
        if (!screenCanvas) return;
        const isMobileDevice = window.innerWidth < 768;
        screenCanvas.width = isMobileDevice ? 800 : 1200;
        screenCanvas.height = isMobileDevice ? 400 : 600;
        const ctx = screenCanvas.getContext("2d", { alpha: false });
        applyClinicalZoom(ctx, landmarks, iw, ih, procCanvas);
        const screenBefore = zoomBeforeRef.current;
        if (screenBefore) {
          screenBefore.width = screenCanvas.width; screenBefore.height = screenCanvas.height;
          const bCtx = screenBefore.getContext("2d", { alpha: false });
          applyClinicalZoom(bCtx, landmarks, iw, ih, img);
        }
        window.dispatchEvent(new Event("resize"));
      });

      const mainExport = document.createElement("canvas");
      mainExport.width = iw; mainExport.height = ih;
      mainExport.getContext("2d").drawImage(procCanvas, 0, 0);
      
      setBeforeImage(snapshotUrl);
      setAfterImage(mainExport.toDataURL("image/jpeg", 0.93));
      setFinalLandmarks(landmarks); 
      setStep("result"); 
      setIsProcessing(false); 
      stopCamera();
    } catch (err) { setError(`System Latency Error: ${err.message}`); setIsProcessing(false); }
  }, []);

  useEffect(() => {
    if (!rawImageUrl || !isProcessing) return;
    const timer = setTimeout(() => startHeavyProcessingPipeline(rawImageUrl), 150);
    return () => clearTimeout(timer);
  }, [rawImageUrl, isProcessing, startHeavyProcessingPipeline]);

  useEffect(() => {
    if (step === "camera" && cameraStream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== cameraStream) {
        video.srcObject = cameraStream;
        video.onloadedmetadata = () => video.play();
      }
      requestRef.current = requestAnimationFrame(detectionLoop);
      renderRequestRef.current = requestAnimationFrame(renderLoop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (renderRequestRef.current) cancelAnimationFrame(renderRequestRef.current);
    };
  }, [step, cameraStream, detectionLoop, renderLoop]);

  return (
    <section id="simulator" className="relative min-h-screen bg-[#050505] overflow-hidden flex flex-col pt-20">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[50%] bg-accent-blue blur-[200px] rounded-full opacity-20" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-accent-blue/40 blur-[180px] rounded-full opacity-10" />
      </div>

      <div className="container mx-auto px-6 max-w-[1440px] relative z-10 flex flex-col flex-grow">
        {/* Header System */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse shadow-[0_0_8px_#00D1FF]" />
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-accent-blue">Aesthetic Intelligence</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-7xl font-serif leading-none tracking-tight">
              Smile <span className="text-[#6B7280]">Studio</span>
            </h2>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-bold mb-1">Optical Engine</p>
              <p className="text-xs font-mono text-white">V3.3 CALIBRATED</p>
            </div>
            <button 
              onClick={() => { setStep("entry"); setBeforeImage(null); setAfterImage(null); stopCamera(); }}
              className="w-14 h-14 bg-[#111111] border border-[#1F1F1F] rounded-2xl flex items-center justify-center text-[#A0A0A0] hover:text-white hover:border-white/20 transition-all duration-300 group"
            >
              <RotateCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* 3-Panel Professional Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-grow pb-16">
          
          {/* LEFT PANEL: Treatment Modular Cards */}
          <div className="lg:col-span-3">
            <div className="glass-medical p-8 rounded-[40px] h-full flex flex-col">
              <div className="flex items-center gap-3 mb-10 pb-6 border-b border-[#1F1F1F]">
                <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                  <Sliders size={16} />
                </div>
                <h3 className="text-[11px] uppercase tracking-[0.25em] font-black text-white">Modality</h3>
              </div>
              
              <div className="space-y-1 mb-10 overflow-y-auto no-scrollbar flex-grow">
                {TREATMENTS.map(t => (
                  <TreatmentModule 
                    key={t.id} 
                    treatment={t} 
                    active={selectedTreatment === t.id}
                    onSelect={() => { 
                      setSelectedTreatment(t.id); 
                      pendingTreatmentRef.current = t.id; 
                      if (step === "result") setIsProcessing(true); 
                    }}
                  />
                ))}
              </div>

              <div className="border-t border-[#1F1F1F] pt-10">
                <MedicalSlider 
                  label="Chrominance Lift" 
                  value={intensities.whitening} 
                  onChange={(v) => setIntensities({...intensities, whitening: v})} 
                />
                <MedicalSlider 
                  label="Orthodontic Tension" 
                  value={intensities.alignment} 
                  onChange={(v) => setIntensities({...intensities, alignment: v})} 
                />
              </div>

              <div className="mt-10">
                <h4 className="text-[9px] uppercase tracking-[0.3em] text-[#6B7280] font-black mb-6">Expert Presets</h4>
                <div className="space-y-2">
                  {PRESETS.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setIntensities({...intensities, whitening: p.intensity})}
                      className="w-full text-left p-4 rounded-2xl bg-[#0A0A0A] border border-[#1F1F1F] text-[11px] font-bold text-[#A0A0A0] hover:border-accent-blue/40 hover:text-white hover:bg-[#111111] transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <span>{p.label}</span>
                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-accent-blue" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER PANEL: Hero Anatomy Preview */}
          <div className="lg:col-span-6">
            <div className="relative aspect-[3/4] lg:aspect-square rounded-[60px] overflow-hidden glass-medical border-white/5 shadow-2xl group">
              <AnimatePresence mode="wait">
                {step === "entry" && (
                  <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                    <button onClick={startCamera} className="w-full h-full bg-[#050505] flex flex-col items-center justify-center gap-8 group">
                      <div className="relative">
                        <div className="absolute inset-0 bg-accent-blue blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="w-32 h-32 rounded-full bg-[#111111] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-all duration-700 relative z-10">
                          <Camera size={48} className="text-accent-blue shadow-[0_0_20px_#00D1FF]" />
                        </div>
                      </div>
                      <div className="text-center relative z-10">
                        <h3 className="font-serif text-4xl text-white mb-3">Begin Anatomy Scan</h3>
                        <p className="text-[10px] text-[#6B7280] tracking-[0.4em] uppercase font-bold">Precision Optical Hardware</p>
                      </div>
                    </button>
                  </motion.div>
                )}

                {step === "camera" && (
                  <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[0.2]" playsInline muted autoPlay />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* UI Layer: Scanner & Vignette */}
                    <div className="absolute inset-0 vignette-overlay" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[45%] h-[15%] border border-dashed border-white/40 rounded-[100px] relative -translate-y-20">
                         <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-4 w-full text-center">
                           <span className="text-[9px] text-white/60 uppercase tracking-[0.3em] font-bold">
                             Align Teeth Here
                           </span>
                         </div>
                         <div className="w-full h-[1px] bg-white/20 absolute top-1/2 -translate-y-1/2 animate-scanner opacity-40" />
                      </div>
                    </div>

                    <div ref={stabilizerRef} className="absolute z-20 pointer-events-none" style={{ clipPath: 'ellipse(50% 45% at 50% 50%)' }}>
                      <canvas ref={localCanvasRef} className="w-full h-full opacity-90 blur-[0.3px]" />
                    </div>

                    {/* Capture Trigger */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40">
                      <button 
                        onClick={() => {
                          if (videoRef.current) {
                            setIsProcessing(true);
                            const c = document.createElement("canvas");
                            c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
                            c.getContext("2d").drawImage(videoRef.current, 0, 0);
                            setRawImageUrl(c.toDataURL("image/jpeg", 0.95));
                          }
                        }}
                        className="relative w-24 h-24 flex items-center justify-center group"
                      >
                        <div className="absolute inset-0 border-2 border-white/20 rounded-full group-hover:border-accent-blue group-hover:scale-110 transition-all duration-500" />
                        <div className="absolute inset-2 border border-white/10 rounded-full" />
                        <div className="w-16 h-16 rounded-full bg-white group-hover:bg-accent-blue shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:shadow-accent-blue transition-all duration-300 group-active:scale-90" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "result" && afterImage && (
                  <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black">
                    <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[9px] uppercase tracking-[0.2em] font-black text-white/40">Before</div>
                    <div className="absolute top-8 right-8 bg-accent-blue/10 backdrop-blur-md px-3 py-1 rounded-full border border-accent-blue/20 text-[9px] uppercase tracking-[0.2em] font-black text-accent-blue">After</div>
                    <ReactCompareImage 
                      leftImage={beforeImage} 
                      rightImage={afterImage} 
                      sliderLineColor={ACCENT_CYAN}
                      handle={<div className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl flex items-center justify-center text-accent-blue"><Layers size={24} className="glow-blue" /></div>}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* High-End Loader */}
              {isProcessing && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-3xl">
                  <div className="relative w-40 h-40 mb-10">
                    <div className="absolute inset-0 border-[0.5px] border-white/5 rounded-full" />
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-t border-accent-blue rounded-full shadow-[0_0_15px_#00D1FF]" 
                    />
                    <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent-blue animate-pulse-medical" size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-3xl font-serif text-white mb-3 tracking-tight">{processingLog}</h3>
                    <p className="text-[10px] text-[#6B7280] uppercase tracking-[0.5em] font-bold">Synchronizing Dental Data</p>
                  </div>
                </div>
              )}
            </div>

            {/* NEW POSITION: High-Resolution Anatomical Zoom (Center Panel) */}
            <AnimatePresence>
              {step === "result" && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-10 glass-medical p-8 rounded-[40px]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] uppercase tracking-[0.3em] font-black text-white">Anatomical Zoom Analytics</h4>
                    <span className="px-3 py-1 rounded-full bg-accent-blue/10 text-[9px] text-accent-blue font-black tracking-widest uppercase border border-accent-blue/20">3.0x Clinical</span>
                  </div>
                  <div className="relative aspect-[21/9] bg-[#0A0A0A] rounded-[24px] overflow-hidden border border-[#1F1F1F] glow-blue">
                    <canvas ref={zoomAfterRef} className="w-full h-full object-cover" />
                    <canvas ref={zoomBeforeRef} className="hidden" />
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '15px 15px' }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT PANEL: Clinical Analytics */}
          <div className="lg:col-span-3">
            <div className="glass-medical p-8 rounded-[40px] h-full flex flex-col">
              <div className="flex items-center gap-3 mb-10 pb-6 border-b border-[#1F1F1F]">
                <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                  <Info size={16} />
                </div>
                <h3 className="text-[11px] uppercase tracking-[0.25em] font-black text-white">Diagnostics</h3>
              </div>

              <div className="flex-grow space-y-8">
                <div className="bg-[#0A0A0A] rounded-3xl p-6 border border-[#1F1F1F] shadow-inner">
                  <h4 className="text-[9px] text-[#6B7280] uppercase tracking-[0.3em] font-black mb-6">Treatment Summary</h4>
                  <div className="space-y-5">
                    <div className="flex items-start gap-4">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shadow-[0_0_8px_currentColor]", selectedTreatment === "whitening" || selectedTreatment === "transformation" ? "bg-accent-blue text-accent-blue" : "bg-[#1F1F1F] text-[#1F1F1F]")} />
                      <div>
                        <p className="text-[12px] font-bold text-white mb-0.5">Enamel Reconstruction</p>
                        <p className="text-[10px] text-[#A0A0A0] font-medium leading-relaxed">Intensity calibrated at {intensities.whitening}%</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shadow-[0_0_8px_currentColor]", selectedTreatment === "alignment" || selectedTreatment === "transformation" ? "bg-accent-blue text-accent-blue" : "bg-[#1F1F1F] text-[#1F1F1F]")} />
                      <div>
                        <p className="text-[12px] font-bold text-white mb-0.5">Orthodontic Arch V3.3</p>
                        <p className="text-[10px] text-[#A0A0A0] font-medium leading-relaxed">Magnetic leveling system active</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shadow-[0_0_8px_currentColor]", selectedTreatment === "braces" || selectedTreatment === "transformation" ? "bg-accent-blue text-accent-blue" : "bg-[#1F1F1F] text-[#1F1F1F]")} />
                      <div>
                        <p className="text-[12px] font-bold text-white mb-0.5">Metallic Integration</p>
                        <p className="text-[10px] text-[#A0A0A0] font-medium leading-relaxed">Precision bracket mapping enabled</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
