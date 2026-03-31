import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, CheckCircle2, Info, RefreshCw, Sparkles, ShieldCheck, HeartPulse } from "lucide-react";
import PremiumButton from "../components/PremiumButton";
import AIProcessingLoader from "../components/AIProcessingLoader";
import BeforeAfterSlider from "../components/BeforeAfterSlider";
import AnimatedSection from "../components/AnimatedSection";
import { cn } from "../utils/cn";

const SmileSimulator = () => {
  const [step, setStep] = useState("upload"); // upload, camera, processing, result
  const [image, setImage] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const [activeTreatment, setActiveTreatment] = useState("whitening"); // whitening, alignment, braces
  const [cameraError, setCameraError] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const treatments = [
    { id: "whitening", label: "Whitening", icon: Sparkles, desc: "Professional grade brightening" },
    { id: "alignment", label: "Alignment", icon: HeartPulse, desc: "Perfectly straight smile" },
    { id: "braces", label: "Braces", icon: ShieldCheck, desc: "Orthodontic transformation" }
  ];

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        processImage(event.target.result, activeTreatment);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setStep("camera");
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL("image/jpeg");
      setImage(dataUrl);
      stopCamera();
      processImage(dataUrl, activeTreatment);
    }
  };

  const processImage = (originalImage, treatmentType) => {
    setStep("processing");
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 1. Draw original
      ctx.drawImage(img, 0, 0);
      
      if (treatmentType === "whitening") {
        // Aggressive whitening
        ctx.filter = 'brightness(1.2) contrast(1.1) saturate(0.8)';
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (treatmentType === "alignment") {
        // Simulate alignment using subtle mesh warping/liquify effect
        // In a real app, this would be a complex AI model. 
        // Here we simulate it by slightly scaling and smoothing the center area
        ctx.filter = 'contrast(1.05) saturate(0.95)';
        ctx.drawImage(img, 0, 0);
        
        // Mock alignment: We apply a very subtle blur and redraw to "smooth" edges
        // and a slight horizontal stretch in the middle to simulate straighter teeth
        const midX = canvas.width / 2;
        const midY = canvas.height / 2;
        const w = canvas.width * 0.4;
        const h = canvas.height * 0.3;
        
        ctx.save();
        ctx.filter = 'brightness(1.1) blur(0.5px)';
        // Draw a slightly "perfected" version in the center
        ctx.drawImage(img, midX - w/2, midY - h/2, w, h, midX - (w*1.02)/2, midY - h/2, w*1.02, h);
        ctx.restore();
      } else if (treatmentType === "braces") {
        // Simulate braces by adding small metallic-like dots in a grid pattern over the smile area
        ctx.drawImage(img, 0, 0);
        const midX = canvas.width / 2;
        const midY = canvas.height / 2;
        
        ctx.fillStyle = "#A0A0A0"; // Metallic silver
        ctx.shadowBlur = 2;
        ctx.shadowColor = "black";
        
        // Draw mock braces brackets
        for(let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.roundRect(midX + (i * 30) - 5, midY - 5, 10, 10, 2);
          ctx.fill();
        }
        // Draw wire
        ctx.strokeStyle = "#C0C0C0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(midX - 100, midY);
        ctx.lineTo(midX + 100, midY);
        ctx.stroke();
      }
      
      setAfterImage(canvas.toDataURL("image/jpeg", 1.0));
      
      setTimeout(() => {
        setStep("result");
      }, 3000);
    };
    img.src = originalImage;
  };

  const reset = () => {
    stopCamera();
    setStep("upload");
    setImage(null);
    setAfterImage(null);
    setCameraError(null);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <section id="simulation" className="py-24 bg-[#F9F9F7]">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-serif text-zinc-900 mb-6">Experience Your Transformation</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
            Select a treatment and upload your photo to see your future smile.
          </p>
        </AnimatedSection>

        {/* Treatment Selection */}
        <div className="max-w-3xl mx-auto mb-12 flex flex-wrap justify-center gap-4">
          {treatments.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTreatment(t.id)}
              className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 text-left",
                activeTreatment === t.id 
                  ? "bg-white border-brand-gold shadow-lg shadow-brand-gold/10 scale-105" 
                  : "bg-zinc-50 border-zinc-100 text-zinc-400 hover:bg-white hover:border-zinc-200"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                activeTreatment === t.id ? "bg-brand-gold text-white" : "bg-zinc-100 text-zinc-400"
              )}>
                <t.icon size={20} />
              </div>
              <div>
                <div className={cn("font-bold text-sm", activeTreatment === t.id ? "text-zinc-900" : "text-zinc-500")}>{t.label}</div>
                <div className="text-[10px] uppercase tracking-widest opacity-60">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {step === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-12 rounded-3xl border border-zinc-100 shadow-xl text-center"
              >
                <div className="mb-10 flex justify-center">
                  <div className="w-20 h-20 bg-brand-blue/30 rounded-full flex items-center justify-center text-zinc-600">
                    <Camera size={32} />
                  </div>
                </div>
                <h3 className="text-2xl font-serif mb-4">Upload Your Photo</h3>
                <p className="text-zinc-400 mb-10 max-w-sm mx-auto">
                  For best results, ensure your teeth are clearly visible and the lighting is natural.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <PremiumButton 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload size={18} />
                    Choose File
                  </PremiumButton>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                  <PremiumButton 
                    variant="secondary" 
                    className="flex items-center gap-2"
                    onClick={startCamera}
                  >
                    <Camera size={18} />
                    Take Photo
                  </PremiumButton>
                </div>
                
                <div className="mt-12 flex items-start gap-3 text-left p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <Info size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    This is an AI-generated simulation and may not reflect exact medical results. 
                    Consult with our specialists for a personalized treatment plan.
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
                className="bg-black rounded-3xl overflow-hidden shadow-2xl relative aspect-video flex items-center justify-center"
              >
                {cameraError ? (
                  <div className="text-white text-center p-8">
                    <p className="mb-6">{cameraError}</p>
                    <PremiumButton onClick={reset}>Go Back</PremiumButton>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                      <div className="w-full h-full border-2 border-white/20 rounded-2xl flex items-center justify-center">
                        <div className="w-48 h-24 border-2 border-brand-gold rounded-[50%] opacity-50" />
                      </div>
                    </div>
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 px-6">
                      <button 
                        onClick={reset}
                        className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                      >
                        <X size={24} />
                      </button>
                      <button 
                        onClick={takePhoto}
                        className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-2xl hover:scale-110 transition-all active:scale-95"
                      >
                        <div className="w-16 h-16 border-4 border-black/5 rounded-full flex items-center justify-center">
                          <div className="w-12 h-12 bg-black rounded-full" />
                        </div>
                      </button>
                      <button 
                        onClick={startCamera}
                        className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                      >
                        <RefreshCw size={24} />
                      </button>
                    </div>
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AIProcessingLoader text={`Simulating ${activeTreatment}...`} />
              </motion.div>
            )}

            {step === "result" && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <BeforeAfterSlider 
                  before={image} 
                  after={afterImage} 
                />
                
                <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-serif text-xl">{activeTreatment.charAt(0).toUpperCase() + activeTreatment.slice(1)} Ready</h4>
                      <p className="text-zinc-400 text-sm">Based on your unique facial structure</p>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default SmileSimulator;
