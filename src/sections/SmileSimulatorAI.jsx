import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw } from "lucide-react";
import ReactCompareImage from "react-compare-image";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";
import { eraseAboveUpperLip } from "../utils/bracesClipFixed";
import { buildBracesPack } from "../utils/bracesGeometryFixed";
import { applyAlignment as applyProfessionalAlignment } from "../utils/alignmentEngine";
import { applyWhitening as applyProfessionalWhitening } from "../utils/whiteningEngine";
import { applyClinicalZoom } from "../utils/zoomEngine";


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

// ── Processing Utilities ─────────────────────────────────────────────────────
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

// ── Braces Effect Layer ──────────────────────────────────────────────────────
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

/**
 * 🦷 ANATOMICAL TRANSFORMATION MATRIX
 */
function getProperAlignment(landmarks, w, h) {
  if (!landmarks) return null;
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const radians = Math.atan2((rightEye.y - leftEye.y) * h, (rightEye.x - leftEye.x) * w);
  const tiltDegrees = radians * (180 / Math.PI);
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const leftCorner = landmarks[57];
  const rightCorner = landmarks[287];
  const centerX = ((leftCorner.x + rightCorner.x) / 2) * w;
  const centerY = (upperLip.y + (lowerLip.y - upperLip.y) * 0.4) * h;
  const mouthWidth = Math.sqrt(Math.pow((rightCorner.x - leftCorner.x) * w, 2) + Math.pow((rightCorner.y - leftCorner.y) * h, 2));
  return { x: centerX, y: centerY, rotation: radians, rotationDeg: tiltDegrees, scale: (mouthWidth / w) * 1.05 };
}

// ── Whitening Engine ─────────────────────────────────────────────────────────
// (Moved to utils/whiteningEngine.js)

// ── Constants ────────────────────────────────────────────────────────────────
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const MAX_IMAGE_SIZE = IS_MOBILE ? 800 : 1200;

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

const ICON_MAP = {
  whitening: () => (
    <svg className="w-6 h-6 md:w-8 md:h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  alignment: () => (
    <svg className="w-6 h-6 md:w-8 md:h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  braces: () => (
    <svg className="w-6 h-6 md:w-8 md:h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 7h10v10H7zM7 12h10M12 7v10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  transformation: () => (
    <svg className="w-6 h-6 md:w-8 md:h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3l1.912 5.885h6.188l-5.007 3.638 1.913 5.885-5.006-3.637-5.006 3.637 1.912-5.885-5.006-3.638h6.188z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function TreatmentDockButton({ treatment, active, onSelect }) {
  const Icon = ICON_MAP[treatment.id] ?? (() => null);
  const theme = TREATMENT_THEME[treatment.id] ?? TREATMENT_THEME.whitening;
  return (
    <motion.button type="button" onClick={onSelect}
      className={cn("relative h-16 w-16 md:h-[74px] md:w-[74px] rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition-all flex items-center justify-center")}
      style={{ borderColor: active ? theme.ring : "rgba(255,255,255,0.1)", boxShadow: active ? theme.glow : "none" }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br", theme.tint)} />
      <span className="relative z-10"><Icon /></span>
    </motion.button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
const SmileSimulatorAI = () => {
  const [step, setStep] = useState("entry");
  const [selectedTreatment, setSelectedTreatment] = useState("whitening");
  const [activeTreatment, setActiveTreatment] = useState("whitening");
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [error, setError] = useState(null);
  const [processingLog, setProcessingLog] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [rawImageUrl, setRawImageUrl] = useState(null);
  const [zoomedBeforeImage, setZoomedBeforeImage] = useState(null);
  const [zoomedAfterImage, setZoomedAfterImage] = useState(null);
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
  const zoomCanvasRef = useRef(null);
  const mainCanvasRef = useRef(null);
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
        if (t === "alignment" || t === "transformation") applyProfessionalAlignment(sctx, marks, vw, vh, opts);
        if (t === "whitening" || t === "alignment" || t === "transformation") applyProfessionalWhitening(sctx, marks, vw, vh, opts);
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
    } catch { setError("Camera access denied."); setStep("entry"); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraStream(null);
  };

  const reset = () => {
    setStep("entry");
    setRawImageUrl(null);
    setBeforeImage(null);
    setAfterImage(null);
    setZoomedBeforeImage(null);
    setZoomedAfterImage(null);
    setError(null);
    setIsProcessing(false);
    stopCamera();
  };

  const startHeavyProcessingPipeline = useCallback(async (imageUrl) => {
    const treatment = pendingTreatmentRef.current;
    const generation = ++generationRef.current;
    try {
      setProcessingLog("Landmarking facial anatomy...");
      let landmarks = await detectLandmarks(imageUrl);
      if (!landmarks && latestLandmarksRef.current) landmarks = latestLandmarksRef.current;
      if (generation !== generationRef.current) return;
      if (!landmarks) throw new Error("Face not detected.");

      const { url: snapshotUrl, w: iw, h: ih } = await resizeImage(imageUrl, MAX_IMAGE_SIZE);
      
      // 🔥 STEP 2 — PERSISTENT CANVAS ALLOCATION
      if (!mainCanvasRef.current) {
        mainCanvasRef.current = document.createElement("canvas");
      }
      const procCanvas = mainCanvasRef.current;
      procCanvas.width = iw; procCanvas.height = ih;
      procCanvas.id = "mainCanvas"; // Diagnostic ID for Zoom verification
      
      const pctx = procCanvas.getContext("2d", { willReadFrequently: true });
      const img = await loadImage(snapshotUrl);
      pctx.drawImage(img, 0, 0, iw, ih);


      // 🔥 ANCHOR SYNC: Calculate the exact mouth-local center for static processing
      const anchor = {
        x: landmarks[168].x * iw,
        y: landmarks[13].y * ih
      };

      if (treatment === "whitening" || treatment === "alignment" || treatment === "transformation") {
        const rotationDeg = getProperAlignment(landmarks, iw, ih).rotationDeg;
        const opts = { anchor, rotation: rotationDeg };
        
        // 🦷 WHIETENING FIRST (Step 1: whiten on original pixels)
        applyProfessionalWhitening(pctx, landmarks, iw, ih);
      }
      if (treatment === "braces" || treatment === "transformation") {
        applyBracesEffect(pctx, landmarks, iw, ih, bracesImageRef.current);
      }

      // 🧠 STEP 5: ALIGNMENT before zoom
      if (treatment === "alignment" || treatment === "transformation") {
        const rotationDeg = getProperAlignment(landmarks, iw, ih).rotationDeg;
        const opts = { anchor, rotation: rotationDeg };
        applyProfessionalAlignment(pctx, landmarks, iw, ih, opts);
      }

      // 🔍 STEP 6: INSTANT ZOOM GENERATION (Locked Snapshot Fix)
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = iw; finalCanvas.height = ih;
      const fctx = finalCanvas.getContext("2d", { willReadFrequently: true });
      fctx.drawImage(procCanvas, 0, 0);

      const zoomCanvas = document.createElement("canvas");
      zoomCanvas.width = 1200; zoomCanvas.height = 600;
      const zctx = zoomCanvas.getContext("2d", { willReadFrequently: true });
      
      // 1. Generate After Zoom (Final Result)
      applyClinicalZoom(zctx, landmarks, iw, ih, finalCanvas);
      
      // 🔥 SAFE EXPORT: Force CPU bitmap copy
      const exportZoomAfter = document.createElement("canvas");
      exportZoomAfter.width = 1200; exportZoomAfter.height = 600;
      exportZoomAfter.getContext("2d", { willReadFrequently: true }).drawImage(zoomCanvas, 0, 0);
      setZoomedAfterImage(exportZoomAfter.toDataURL("image/jpeg", 0.92));
      
      // 2. Generate Before Zoom (Original Photo)
      const beforeFinal = document.createElement("canvas");
      beforeFinal.width = iw; beforeFinal.height = ih;
      beforeFinal.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);

      zctx.clearRect(0, 0, 1200, 600);
      applyClinicalZoom(zctx, landmarks, iw, ih, beforeFinal);
      
      const exportZoomBefore = document.createElement("canvas");
      exportZoomBefore.width = 1200; exportZoomBefore.height = 600;
      exportZoomBefore.getContext("2d", { willReadFrequently: true }).drawImage(zoomCanvas, 0, 0);
      setZoomedBeforeImage(exportZoomBefore.toDataURL("image/jpeg", 0.92));

      // 🔍 FINAL EXPORT (Guaranteed Pixels)
      console.log("FINAL IMAGE LOG:", procCanvas.toDataURL("image/jpeg", 0.1).slice(0, 100));
      
      const mainExport = document.createElement("canvas");
      mainExport.width = iw; mainExport.height = ih;
      mainExport.getContext("2d", { willReadFrequently: true }).drawImage(procCanvas, 0, 0);
      
      setBeforeImage(snapshotUrl);
      setAfterImage(mainExport.toDataURL("image/jpeg", 0.93));
      
      setFinalLandmarks(landmarks); 
      setStep("result"); 
      setIsProcessing(false); 
      stopCamera();
    } catch (err) { setError(`Simulation Failed: ${err.message}`); setIsProcessing(false); }
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
        video.onloadedmetadata = () => video.play().catch(e => console.error(e));
      }
    }
  }, [step, cameraStream]);


  return (
    <section id="simulator" className="relative py-12 md:py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <AnimatedSection className="text-center mb-8">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-3xl md:text-5xl lg:text-6xl mb-4">AI Smile Simulation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-sm md:text-lg italic mb-6 md:mb-10 px-4">
            {TREATMENTS.find(t => t.id === selectedTreatment)?.desc}
          </p>

          <div className="flex flex-col items-center gap-4 md:gap-6 mt-4 mb-8 md:mb-12">
            <div className="bg-zinc-900/95 backdrop-blur-2xl px-4 py-3 rounded-[28px] md:rounded-[32px] border border-white/10 flex items-center gap-3 md:gap-6">
              {TREATMENTS.map(t => (
                <TreatmentDockButton key={t.id} treatment={t} active={selectedTreatment === t.id}
                  onSelect={() => { setSelectedTreatment(t.id); pendingTreatmentRef.current = t.id; if (step === "result") setIsProcessing(true); }} />
              ))}
            </div>
          </div>
        </AnimatedSection>
        <div className="max-w-4xl mx-auto rounded-[32px] md:rounded-[40px] relative flex flex-col justify-center min-h-[400px]">
          <AnimatePresence mode="wait">
            {step === "entry" && (
              <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button onClick={startCamera} className="w-full h-[400px] bg-white rounded-[32px] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-4 group">
                  <Camera size={44} className="text-zinc-400 group-hover:text-brand-gold transition-colors" />
                  <span className="font-serif text-3xl text-zinc-800">Take Photo</span>
                </button>
              </motion.div>
            )}
            {step === "camera" && (
              <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative aspect-[4/5] md:aspect-video bg-black rounded-[32px] overflow-hidden">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" />

                {/* 🦷 Anatomical Teeth Placement Guidance (The 'Oval') */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="relative w-[50%] md:w-[32%] aspect-[1.8/1] border-[3px] border-dashed border-white/50 rounded-[500px] flex items-center justify-center">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-white/20 rounded-[500px] animate-pulse" />
                    <span className="text-white/60 text-[8px] md:text-[9px] uppercase tracking-[0.3em] font-bold mt-20 md:mt-24">Align Teeth</span>
                  </div>
                </div>

                <div ref={stabilizerRef} id="alignment-stabilizer" className="absolute z-20 pointer-events-none" style={{ clipPath: 'ellipse(50% 45% at 50% 50%)' }}>
                  <canvas ref={localCanvasRef} className="w-full h-full" />
                </div>
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
                  <button onClick={() => {
                    if (videoRef.current) {
                      setIsProcessing(true);
                      const c = document.createElement("canvas");
                      c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
                      c.getContext("2d").drawImage(videoRef.current, 0, 0);
                      setRawImageUrl(c.toDataURL("image/jpeg", 0.95));
                    }
                  }} className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center group">
                    <div className="h-14 w-14 rounded-full bg-white group-hover:bg-brand-gold transition-colors" />
                  </button>
                </div>
              </motion.div>
            )}
            {step === "result" && afterImage && (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-8">
                <ReactCompareImage leftImage={beforeImage} rightImage={afterImage} sliderLineColor="#D4AF37" />
                
                <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 mt-4 overflow-hidden relative shadow-2xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 blur-[80px] rounded-full pointer-events-none" />
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div>
                      <h4 className="font-serif text-2xl text-zinc-100 italic">Anatomical Zoom</h4>
                      <p className="text-zinc-500 text-sm tracking-tight">3.0x Whole Smile & Dental HD Magnification</p>
                    </div>
                    <div className="px-3 py-1 bg-brand-gold/10 border border-brand-gold/20 rounded-full flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                      <span className="text-brand-gold text-[10px] uppercase tracking-widest font-bold">Clinical View</span>
                    </div>
                  </div>
                  
                  <div className="relative aspect-[2.2/1] bg-black rounded-2xl overflow-hidden border border-white/5 group">
                    {zoomLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
                        <RefreshCw size={24} className="text-brand-gold animate-spin" />
                      </div>
                    )}
                    {/* Viewport Corners */}
                    <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/20 z-10" />
                    <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/20 z-10" />
                    <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/20 z-10" />
                    <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/20 z-10" />
                    
                    <canvas ref={zoomCanvasRef} className="w-full h-full object-contain scale-[1.02]" />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5 group hover:border-brand-gold/20 transition-colors">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Enamel Profile</p>
                      <p className="text-xs text-zinc-300 font-medium">Radiance Optimized</p>
                    </div>
                    <div className="p-4 bg-white/[0.03] rounded-xl border border-white/5 group hover:border-brand-gold/20 transition-colors">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Anatomical Sync</p>
                      <p className="text-xs text-zinc-300 font-medium">Position Locked</p>
                    </div>
                  </div>
                </div>

                <button onClick={reset} className="py-5 bg-zinc-950 text-white rounded-2xl font-bold">New Simulation</button>
              </motion.div>
            )}
          </AnimatePresence>
          {isProcessing && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-[32px]">
              <div className="w-20 h-20 border-4 border-brand-gold rounded-full border-t-transparent animate-spin mb-4" />
              <h3 className="text-xl font-serif text-zinc-900">{processingLog}</h3>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SmileSimulatorAI;
